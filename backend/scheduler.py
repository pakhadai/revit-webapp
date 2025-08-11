# backend/scheduler.py
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from database import async_session
from models.user import User
from models.subscription import Subscription, SubscriptionStatus
from models.bonus import DailyBonus
from services.telegram import telegram_service
import logging

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Планувальник для автоматичних повідомлень"""

    def __init__(self):
        self.running = False

    async def start(self):
        """Запустити планувальник"""
        self.running = True
        logger.info("Notification scheduler started")

        while self.running:
            try:
                # Запускаємо перевірки
                await self.check_subscription_reminders()
                await self.check_daily_bonus_reminders()

                # Чекаємо годину до наступної перевірки
                await asyncio.sleep(3600)

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)  # При помилці чекаємо хвилину

    async def check_subscription_reminders(self):
        """Перевірити і відправити нагадування про закінчення підписки"""
        async with async_session() as session:
            # Знаходимо підписки що закінчуються через 3 дні
            three_days_from_now = datetime.utcnow() + timedelta(days=3)

            result = await session.execute(
                select(Subscription, User)
                .join(User, Subscription.user_id == User.id)
                .where(
                    and_(
                        Subscription.status == SubscriptionStatus.ACTIVE,
                        Subscription.end_date <= three_days_from_now,
                        Subscription.end_date > datetime.utcnow(),
                        Subscription.reminder_sent == False
                    )
                )
            )

            for subscription, user in result.all():
                days_left = (subscription.end_date - datetime.utcnow()).days

                # Відправляємо повідомлення
                success = await telegram_service.send_subscription_reminder(
                    user_id=user.user_id,
                    days_left=days_left,
                    lang=user.language_code
                )

                if success:
                    # Позначаємо що нагадування відправлено
                    subscription.reminder_sent = True
                    await session.commit()
                    logger.info(f"Sent subscription reminder to user {user.user_id}")

    async def check_daily_bonus_reminders(self):
        """Нагадування про щоденний бонус (о 20:00 за Києвом)"""
        from pytz import timezone
        kyiv_tz = timezone('Europe/Kiev')
        now_kyiv = datetime.now(kyiv_tz)

        # Перевіряємо чи зараз 20:00
        if now_kyiv.hour != 20:
            return

        async with async_session() as session:
            # Знаходимо користувачів які не отримали бонус сьогодні
            today = now_kyiv.date()

            result = await session.execute(
                select(DailyBonus, User)
                .join(User, DailyBonus.user_id == User.id)
                .where(
                    DailyBonus.last_claim_date < today
                )
            )

            for daily_bonus, user in result.all():
                # Відправляємо нагадування
                await telegram_service.send_daily_bonus_reminder(
                    user_id=user.user_id,
                    streak=daily_bonus.streak_count,
                    lang=user.language_code
                )

                await asyncio.sleep(0.1)  # Невелика затримка між повідомленнями

    def stop(self):
        """Зупинити планувальник"""
        self.running = False
        logger.info("Notification scheduler stopped")


# Створюємо екземпляр
scheduler = NotificationScheduler()


# Функція для запуску в окремому процесі
async def run_scheduler():
    """Запустити планувальник в окремому процесі"""
    await scheduler.start()


if __name__ == "__main__":
    # Запуск планувальника
    asyncio.run(run_scheduler())