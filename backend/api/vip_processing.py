from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from models.user import User
from models.bonus import VipLevel, BonusTransaction, BonusTransactionType
from models.order import Order
from config import settings

async def update_vip_status_after_purchase(
    user_id: int,
    order: Order,
    session: AsyncSession
):
    """
    Оновлює VIP-статус користувача, рівень та нараховує кешбек після покупки.
    Викликається, коли статус замовлення стає 'completed'.
    """
    # 1. Отримуємо користувача та його VIP-рівень
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()

    vip_result = await session.execute(select(VipLevel).where(VipLevel.user_id == user_id))
    vip_level = vip_result.scalar_one_or_none()

    if not vip_level:
        vip_level = VipLevel(
            user_id=user_id,
            current_level='bronze',
            cashback_rate=settings.VIP_BRONZE_CASHBACK
        )
        session.add(vip_level)
        await session.flush()

    # 2. Оновлюємо загальну суму витрат
    order_total = order.total
    vip_level.total_spent += order_total
    vip_level.purchases_count += 1
    user.total_purchases_amount += order_total

    # 3. Перевіряємо на підвищення рівня
    new_level = vip_level.current_level
    new_cashback_rate = vip_level.cashback_rate

    if vip_level.current_level == 'bronze' and vip_level.total_spent >= settings.VIP_SILVER_THRESHOLD:
        new_level = 'silver'
        new_cashback_rate = settings.VIP_SILVER_CASHBACK
    if vip_level.current_level == 'silver' and vip_level.total_spent >= settings.VIP_GOLD_THRESHOLD:
        new_level = 'gold'
        new_cashback_rate = settings.VIP_GOLD_CASHBACK
    if vip_level.current_level == 'gold' and vip_level.total_spent >= settings.VIP_DIAMOND_THRESHOLD:
        new_level = 'diamond'
        new_cashback_rate = settings.VIP_DIAMOND_CASHBACK

    if new_level != vip_level.current_level:
        vip_level.current_level = new_level
        vip_level.cashback_rate = new_cashback_rate
        vip_level.level_updated_at = datetime.utcnow()

    # 4. Розраховуємо та нараховуємо кешбек
    cashback_amount = int(order_total * new_cashback_rate)

    if cashback_amount > 0:
        user.bonuses += cashback_amount
        user.total_bonuses_earned += cashback_amount
        vip_level.total_cashback_earned += cashback_amount

        # 5. Створюємо транзакцію для бонусу
        transaction = BonusTransaction(
            user_id=user_id,
            amount=cashback_amount,
            balance_after=user.bonuses,
            type=BonusTransactionType.PURCHASE_CASHBACK,
            description=f"Cashback for order #{order.order_id} (VIP {vip_level.current_level.capitalize()})",
            order_id=order.id
        )
        session.add(transaction)

    await session.commit()
