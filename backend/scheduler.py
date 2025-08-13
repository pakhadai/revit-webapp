# backend/scheduler.py
import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import List, Callable, Any
import pytz
from config import settings

logger = logging.getLogger(__name__)


class Scheduler:
    """Простий планувальник задач для виконання періодичних операцій"""

    def __init__(self):
        self.tasks = []
        self.running = False
        self.timezone = pytz.timezone(settings.DAILY_RESET_TIMEZONE)

    async def start(self):
        """Запустити планувальник"""
        self.running = True
        logger.info("Scheduler started")

        # Реєструємо задачі
        self.register_daily_tasks()
        self.register_periodic_tasks()

        # Запускаємо основний цикл
        while self.running:
            try:
                await self.run_pending_tasks()
                await asyncio.sleep(60)  # Перевіряємо кожну хвилину
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)

    def stop(self):
        """Зупинити планувальник"""
        self.running = False
        logger.info("Scheduler stopped")

    def register_daily_tasks(self):
        """Реєструємо щоденні задачі"""

        # Скидання щоденних бонусів о 00:00 за київським часом
        self.schedule_daily(
            time(0, 0),
            self.reset_daily_bonuses,
            "Reset daily bonuses"
        )

        # Нагадування про закінчення підписки о 10:00
        self.schedule_daily(
            time(10, 0),
            self.check_expiring_subscriptions,
            "Check expiring subscriptions"
        )

        # Очищення старих записів о 03:00
        self.schedule_daily(
            time(3, 0),
            self.cleanup_old_records,
            "Cleanup old records"
        )

    def register_periodic_tasks(self):
        """Реєструємо періодичні задачі"""

        # Очищення прострочених токенів кожні 30 хвилин
        self.schedule_periodic(
            30,
            self.cleanup_expired_tokens,
            "Cleanup expired tokens"
        )

        # Оновлення статистики кожні 5 хвилин
        self.schedule_periodic(
            5,
            self.update_statistics,
            "Update statistics"
        )

    def schedule_daily(self, at_time: time, func: Callable, name: str):
        """Запланувати щоденну задачу"""
        self.tasks.append({
            "type": "daily",
            "time": at_time,
            "func": func,
            "name": name,
            "last_run": None
        })
        logger.info(f"Scheduled daily task: {name} at {at_time}")

    def schedule_periodic(self, minutes: int, func: Callable, name: str):
        """Запланувати періодичну задачу"""
        self.tasks.append({
            "type": "periodic",
            "interval": timedelta(minutes=minutes),
            "func": func,
            "name": name,
            "last_run": None
        })
        logger.info(f"Scheduled periodic task: {name} every {minutes} minutes")

    async def run_pending_tasks(self):
        """Виконати заплановані задачі"""
        now = datetime.now(self.timezone)

        for task in self.tasks:
            try:
                should_run = False

                if task["type"] == "daily":
                    # Перевіряємо чи вже виконували сьогодні
                    if task["last_run"] is None or task["last_run"].date() < now.date():
                        # Перевіряємо чи настав час
                        scheduled_time = self.timezone.localize(
                            datetime.combine(now.date(), task["time"])
                        )
                        if now >= scheduled_time:
                            should_run = True

                elif task["type"] == "periodic":
                    # Перевіряємо чи пройшов інтервал
                    if task["last_run"] is None:
                        should_run = True
                    else:
                        time_passed = now - task["last_run"]
                        if time_passed >= task["interval"]:
                            should_run = True

                if should_run:
                    logger.info(f"Running task: {task['name']}")
                    await task["func"]()
                    task["last_run"] = now

            except Exception as e:
                logger.error(f"Error running task {task['name']}: {e}")

    # --- ЗАДАЧІ ---

    async def reset_daily_bonuses(self):
        """Скидання щоденних бонусів"""
        try:
            from database import async_session
            from models.bonus import DailyBonus
            from sqlalchemy import update

            async with async_session() as session:
                # Скидаємо streak для тих хто не забрав бонус вчора
                yesterday = datetime.now(self.timezone) - timedelta(days=1)

                await session.execute(
                    update(DailyBonus)
                    .where(DailyBonus.last_claim_date < yesterday.date())
                    .values(streak=0)
                )
                await session.commit()

            logger.info("Daily bonuses reset completed")

        except Exception as e:
            logger.error(f"Error resetting daily bonuses: {e}")

    async def check_expiring_subscriptions(self):
        """Перевірка підписок що закінчуються"""
        try:
            from database import async_session
            from models.subscription import Subscription, SubscriptionStatus
            from models.user import User
            from services.telegram import telegram_service
            from sqlalchemy import select

            async with async_session() as session:
                # Знаходимо підписки що закінчуються через 3 дні
                check_date = datetime.now(self.timezone) + timedelta(days=3)

                result = await session.execute(
                    select(Subscription, User)
                    .join(User, Subscription.user_id == User.id)
                    .where(
                        Subscription.status == SubscriptionStatus.ACTIVE,
                        Subscription.end_date <= check_date,
                        Subscription.end_date > datetime.now(self.timezone)
                    )
                )

                for subscription, user in result:
                    days_left = (subscription.end_date - datetime.now(self.timezone)).days

                    # Відправляємо нагадування
                    await telegram_service.send_subscription_reminder(
                        user.user_id,
                        days_left,
                        user.language_code
                    )

            logger.info("Subscription check completed")

        except Exception as e:
            logger.error(f"Error checking subscriptions: {e}")

    async def cleanup_old_records(self):
        """Очищення старих записів"""
        try:
            from database import async_session
            from models.notification import Notification
            from models.view_history import ViewHistory
            from sqlalchemy import delete

            async with async_session() as session:
                # Видаляємо старі прочитані повідомлення (старші 30 днів)
                cutoff_date = datetime.now(self.timezone) - timedelta(days=30)

                await session.execute(
                    delete(Notification)
                    .where(
                        Notification.is_read == True,
                        Notification.created_at < cutoff_date
                    )
                )

                # Видаляємо стару історію переглядів (старші 90 днів)
                history_cutoff = datetime.now(self.timezone) - timedelta(days=90)

                await session.execute(
                    delete(ViewHistory)
                    .where(ViewHistory.viewed_at < history_cutoff)
                )

                await session.commit()

            logger.info("Old records cleanup completed")

        except Exception as e:
            logger.error(f"Error cleaning old records: {e}")

    async def cleanup_expired_tokens(self):
        """Очищення прострочених токенів"""
        try:
            from services.file_service import file_service

            file_service.cleanup_expired_tokens()
            file_service.cleanup_temp_files()

            logger.info("Token cleanup completed")

        except Exception as e:
            logger.error(f"Error cleaning tokens: {e}")

    async def update_statistics(self):
        """Оновлення статистики"""
        # Тут можна додати оновлення кешованої статистики
        pass


# Створюємо глобальний екземпляр
scheduler = Scheduler()