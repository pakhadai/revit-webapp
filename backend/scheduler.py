import asyncio
from datetime import datetime, timedelta
from utils.timezone import get_kyiv_midnight, seconds_until_kyiv_midnight
import logging

logger = logging.getLogger(__name__)


class DailyScheduler:
    def __init__(self):
        self.running = False

    async def start(self):
        """Запустити планувальник"""
        self.running = True
        logger.info("Daily scheduler started")

        while self.running:
            try:
                # Чекаємо до наступної півночі за київським часом
                seconds_to_wait = seconds_until_kyiv_midnight()
                logger.info(f"Waiting {seconds_to_wait} seconds until Kyiv midnight")

                await asyncio.sleep(seconds_to_wait)

                # Виконуємо щоденні завдання
                await self.run_daily_tasks()

                # Чекаємо 1 хвилину щоб не запустити двічі
                await asyncio.sleep(60)

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)

    async def run_daily_tasks(self):
        """Виконати щоденні завдання о 00:00 за київським часом"""
        logger.info("Running daily tasks at Kyiv midnight")

        # Тут можна додати:
        # - Скидання денних лімітів
        # - Відправку нагадувань про бонуси
        # - Архівування старих даних
        # - Інші щоденні завдання

    def stop(self):
        """Зупинити планувальник"""
        self.running = False
        logger.info("Daily scheduler stopped")


scheduler = DailyScheduler()