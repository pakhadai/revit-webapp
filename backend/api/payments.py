# backend/api/payments.py
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_session
from models.user import User
from models.payment import Payment
from models.order import Order, OrderItem
# --- ОСЬ ТУТ ВИПРАВЛЕННЯ ---
from models.archive import Archive, ArchivePurchase
from models.subscription import Subscription, SubscriptionStatus
from models.bonus import BonusTransaction, BonusTransactionType, VipLevel
from models.notification import Notification
from services.cryptomus import cryptomus_service
from config import settings
from .dependencies import get_current_user_dependency
from datetime import datetime, timedelta, timezone
import uuid
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/create")
async def create_payment(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Створити платіж для замовлення або підписки"""

    payment_type = data.get("type")  # order, subscription
    payment_method = data.get("method", "cryptomus")
    currency = data.get("currency", "USD")

    if payment_type not in ["order", "subscription"]:
        raise HTTPException(status_code=400, detail="Invalid payment type")

    # Генеруємо унікальний ID платежу
    payment_id = str(uuid.uuid4())

    if payment_type == "order":
        # Оплата замовлення
        order_id = data.get("order_id")

        result = await session.execute(
            select(Order).where(
                Order.id == order_id,
                Order.user_id == current_user.id
            )
        )
        order = result.scalar_one_or_none()

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.status != "pending":
            raise HTTPException(status_code=400, detail="Order already processed")

        amount = order.total
        description = f"Order #{order.order_id}"
        metadata = {
            "type": "order",
            "order_id": order.id,
            "user_id": current_user.id
        }

    elif payment_type == "subscription":
        # Оплата підписки
        plan = data.get("plan", "monthly")

        if plan == "yearly":
            amount = settings.SUBSCRIPTION_PRICE_YEARLY
            months = 12
        else:
            amount = settings.SUBSCRIPTION_PRICE_MONTHLY
            months = 1

        description = f"Subscription {plan}"
        metadata = {
            "type": "subscription",
            "plan": plan,
            "months": months,
            "user_id": current_user.id
        }

    # Створюємо запис платежу в БД
    new_payment = Payment(
        payment_id=payment_id,
        user_id=current_user.id,
        amount=amount,
        currency=currency,
        status="pending",
        payment_method=payment_method,
        payment_data=metadata
    )

    if payment_type == "order":
        new_payment.order_id = order.id

    session.add(new_payment)
    await session.commit()

    # Створюємо платіж в Cryptomus
    if payment_method == "cryptomus":
        result = await cryptomus_service.create_payment(
            order_id=payment_id,
            amount=amount,
            currency=currency,
            customer_id=current_user.id,
            metadata=metadata
        )

        if result["success"]:
            # Оновлюємо платіж
            new_payment.payment_data["cryptomus_id"] = result["payment_id"]
            new_payment.payment_data["payment_url"] = result["payment_url"]
            await session.commit()

            return {
                "success": True,
                "payment_id": payment_id,
                "payment_url": result["payment_url"],
                "amount": amount,
                "currency": currency,
                "expires_at": (datetime.now(timezone.utc) + timedelta(
                    minutes=settings.PAYMENT_TIMEOUT_MINUTES)).isoformat()
            }
        else:
            new_payment.status = "failed"
            await session.commit()
            raise HTTPException(status_code=400, detail=result["error"])

    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")


@router.post("/cryptomus/webhook")
async def cryptomus_webhook(
        request: Request,
        background_tasks: BackgroundTasks,
        session: AsyncSession = Depends(get_session)
):
    """Обробка webhook від Cryptomus"""

    try:
        # Отримуємо дані
        body = await request.body()
        data = json.loads(body)

        # Перевіряємо підпис
        signature = request.headers.get("sign")
        if not signature:
            logger.warning("Webhook without signature")
            raise HTTPException(status_code=401, detail="No signature")

        if not cryptomus_service._verify_webhook_signature(data, signature):
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

        # Обробляємо webhook
        payment_uuid = data.get("uuid")
        order_id = data.get("order_id")  # Це наш payment_id
        status = data.get("status")
        amount = float(data.get("amount", 0))
        currency = data.get("currency")
        txid = data.get("txid")

        logger.info(f"Webhook received: {order_id} - {status}")

        # Знаходимо платіж
        result = await session.execute(
            select(Payment).where(Payment.payment_id == order_id)
        )
        payment = result.scalar_one_or_none()

        if not payment:
            logger.error(f"Payment not found: {order_id}")
            return {"status": "error", "message": "Payment not found"}

        # Оновлюємо статус
        old_status = payment.status
        new_status = cryptomus_service._map_status(status)

        payment.status = new_status
        payment.payment_data["cryptomus_status"] = status
        payment.payment_data["txid"] = txid
        payment.payment_data["last_webhook"] = datetime.utcnow().isoformat()

        # Якщо платіж успішний
        if new_status == "completed" and old_status != "completed":
            payment.completed_at = datetime.now(timezone.utc)

            # Обробляємо залежно від типу
            metadata = payment.payment_data

            if metadata.get("type") == "order":
                # Оплата замовлення
                await process_order_payment(payment, session)

            elif metadata.get("type") == "subscription":
                # Оплата підписки
                await process_subscription_payment(payment, session)

        await session.commit()

        return {"status": "success"}

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_order_payment(payment: Payment, session: AsyncSession):
    """Обробка оплати замовлення"""
    order = await session.get(Order, payment.order_id)
    if not order: return

    order.status = "completed"
    order.completed_at = datetime.utcnow()

    # 1. Надаємо користувачу доступ до куплених товарів
    items_result = await session.execute(
        select(OrderItem).where(OrderItem.order_id == order.id)
    )
    order_items = items_result.scalars().all()

    for item in order_items:
        # Перевіряємо, чи вже є доступ, щоб уникнути дублікатів
        existing_purchase = await session.execute(
            select(ArchivePurchase).where(
                ArchivePurchase.user_id == payment.user_id,
                ArchivePurchase.archive_id == item.archive_id
            )
        )
        if not existing_purchase.scalar_one_or_none():
            new_purchase = ArchivePurchase(
                user_id=payment.user_id,
                archive_id=item.archive_id,
                price_paid=item.price  # Можна зберегти ціну
            )
            session.add(new_purchase)

    # 2. Створюємо повідомлення для кожного товару в замовленні
    for item in order_items:
        archive = await session.get(Archive, item.archive_id)
        if archive:
            notification = Notification(
                user_id=payment.user_id,
                message=f"Будь ласка, оцініть ваш новий архів: {archive.title.get('ua', 'архів')}",
                type="rate_reminder",
                related_archive_id=item.archive_id
            )
            session.add(notification)

    # Отримуємо користувача
    user_result = await session.execute(
        select(User).where(User.id == payment.user_id)
    )
    user = user_result.scalar_one_or_none()

    if user:
        # Оновлюємо VIP статус
        await update_vip_status(user, payment.amount, session)

        # Нараховуємо кешбек
        await process_cashback(user, order, session)

        # Обробляємо реферальні бонуси
        if user.referred_by:
            from api.referrals import process_referral_first_purchase
            await process_referral_first_purchase(order.id, session)

    logger.info(f"Order {order.order_id} completed via payment {payment.payment_id}")


async def process_subscription_payment(payment: Payment, session: AsyncSession):
    """Обробка оплати підписки"""

    metadata = payment.payment_data
    plan = metadata.get("plan", "monthly")
    months = metadata.get("months", 1)

    # Створюємо або оновлюємо підписку
    result = await session.execute(
        select(Subscription).where(
            Subscription.user_id == payment.user_id,
            Subscription.status == SubscriptionStatus.PENDING
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        # Активуємо існуючу
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.payment_method = "cryptomus"
        subscription.amount_paid = payment.amount
    else:
        # Створюємо нову
        now = datetime.utcnow()
        subscription = Subscription(
            user_id=payment.user_id,
            plan=plan,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            end_date=now + timedelta(days=30 * months),
            payment_method="cryptomus",
            amount_paid=payment.amount
        )
        session.add(subscription)

    # Оновлюємо користувача
    user_result = await session.execute(
        select(User).where(User.id == payment.user_id)
    )
    user = user_result.scalar_one_or_none()

    if user:
        user.has_active_subscription = True
        user.subscription_start = subscription.start_date
        user.subscription_until = subscription.end_date

    logger.info(f"Subscription activated for user {payment.user_id}")


async def update_vip_status(user: User, amount: float, session: AsyncSession):
    """Оновлення VIP статусу користувача"""

    # Отримуємо або створюємо VIP рівень
    result = await session.execute(
        select(VipLevel).where(VipLevel.user_id == user.id)
    )
    vip = result.scalar_one_or_none()

    if not vip:
        vip = VipLevel(user_id=user.id)
        session.add(vip)

    # Оновлюємо загальну суму
    vip.total_spent += amount
    vip.purchases_count += 1

    # Визначаємо новий рівень
    old_level = vip.current_level

    if vip.total_spent >= settings.VIP_DIAMOND_THRESHOLD:
        vip.current_level = "diamond"
        vip.cashback_rate = settings.VIP_DIAMOND_CASHBACK
    elif vip.total_spent >= settings.VIP_GOLD_THRESHOLD:
        vip.current_level = "gold"
        vip.cashback_rate = settings.VIP_GOLD_CASHBACK
    elif vip.total_spent >= settings.VIP_SILVER_THRESHOLD:
        vip.current_level = "silver"
        vip.cashback_rate = settings.VIP_SILVER_CASHBACK
    else:
        vip.current_level = "bronze"
        vip.cashback_rate = settings.VIP_BRONZE_CASHBACK

    # Якщо рівень підвищився
    if old_level != vip.current_level:
        vip.level_updated_at = datetime.utcnow()
        logger.info(f"User {user.id} VIP level upgraded: {old_level} -> {vip.current_level}")


async def process_cashback(user: User, order: Order, session: AsyncSession):
    """Нарахування кешбеку за покупку"""

    # Отримуємо VIP рівень
    result = await session.execute(
        select(VipLevel).where(VipLevel.user_id == user.id)
    )
    vip = result.scalar_one_or_none()

    if not vip:
        return

    # Розраховуємо кешбек
    cashback_amount = int(order.total * vip.cashback_rate)

    if cashback_amount > 0:
        # Нараховуємо бонуси
        user.bonuses += cashback_amount
        user.total_bonuses_earned += cashback_amount

        # Оновлюємо VIP статистику
        vip.total_cashback_earned += cashback_amount

        # Записуємо транзакцію
        transaction = BonusTransaction(
            user_id=user.id,
            amount=cashback_amount,
            balance_after=user.bonuses,
            type=BonusTransactionType.PURCHASE_CASHBACK,
            description=f"Cashback {int(vip.cashback_rate * 100)}% from order #{order.order_id}",
            order_id=order.id
        )
        session.add(transaction)

        logger.info(f"Cashback {cashback_amount} bonuses for user {user.id}")


@router.get("/status/{payment_id}")
async def check_payment_status(
        payment_id: str,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Перевірити статус платежу"""

    result = await session.execute(
        select(Payment).where(
            Payment.payment_id == payment_id,
            Payment.user_id == current_user.id
        )
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Якщо платіж ще pending - перевіряємо в Cryptomus
    if payment.status == "pending" and payment.payment_method == "cryptomus":
        cryptomus_id = payment.payment_data.get("cryptomus_id")

        if cryptomus_id:
            status_result = await cryptomus_service.check_payment_status(cryptomus_id)

            if status_result["success"]:
                return {
                    "payment_id": payment_id,
                    "status": status_result["payment_status"],
                    "amount": payment.amount,
                    "currency": payment.currency,
                    "network": status_result.get("network"),
                    "address": status_result.get("address"),
                    "txid": status_result.get("txid")
                }

    return {
        "payment_id": payment_id,
        "status": payment.status,
        "amount": payment.amount,
        "currency": payment.currency,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
        "completed_at": payment.completed_at.isoformat() if payment.completed_at else None
    }


@router.get("/history")
async def get_payment_history(
        limit: int = 20,
        offset: int = 0,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Історія платежів користувача"""

    result = await session.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    payments = result.scalars().all()

    return {
        "payments": [
            {
                "payment_id": p.payment_id,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "method": p.payment_method,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None
            }
            for p in payments
        ]
    }


@router.post("/simulate")
async def simulate_payment(
        data: dict,
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Симуляція оплати для тестування (тільки в DEV режимі)"""

    # Дозволяємо тільки в режимі розробки
    if not settings.DEV_MODE:
        raise HTTPException(status_code=403, detail="Simulation only available in dev mode")

    payment_id = data.get("payment_id")
    status = data.get("status", "completed")

    # Знаходимо платіж
    result = await session.execute(
        select(Payment).where(
            Payment.payment_id == payment_id,
            Payment.user_id == current_user.id
        )
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Оновлюємо статус
    old_status = payment.status
    payment.status = status

    if status == "completed" and old_status != "completed":
        payment.completed_at = datetime.now(timezone.utc)

        # Обробляємо залежно від типу
        if payment.payment_data.get("type") == "order":
            # Надаємо доступ до архівів
            order = await session.get(Order, payment.order_id)
            if order:
                order.status = "completed"
                order.completed_at = datetime.utcnow()

                # Надаємо доступ до товарів
                items_result = await session.execute(
                    select(OrderItem).where(OrderItem.order_id == order.id)
                )
                for item in items_result.scalars().all():
                    # Перевіряємо чи вже є доступ
                    existing = await session.execute(
                        select(ArchivePurchase).where(
                            ArchivePurchase.user_id == current_user.id,
                            ArchivePurchase.archive_id == item.archive_id
                        )
                    )
                    if not existing.scalar_one_or_none():
                        purchase = ArchivePurchase(
                            user_id=current_user.id,
                            archive_id=item.archive_id,
                            price_paid=item.price
                        )
                        session.add(purchase)

    await session.commit()

    return {
        "success": True,
        "status": status,
        "message": f"Payment simulated as {status}"
    }