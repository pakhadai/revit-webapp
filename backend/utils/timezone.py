# backend/utils/timezone.py
# ВИДАЛІТЬ ПЕРШИЙ РЯДОК і замініть весь файл на цей код:

from datetime import datetime, timezone, timedelta
import pytz
from config import settings

# Отримуємо часову зону Києва
KYIV_TZ = pytz.timezone(settings.DAILY_RESET_TIMEZONE)


def get_kyiv_time() -> datetime:
    """Отримати поточний час в Києві"""
    return datetime.now(KYIV_TZ)


def get_kyiv_midnight() -> datetime:
    """Отримати наступну північ за київським часом"""
    kyiv_now = get_kyiv_time()
    kyiv_midnight = kyiv_now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Якщо вже після півночі, беремо наступний день
    if kyiv_now >= kyiv_midnight:
        kyiv_midnight += timedelta(days=1)

    return kyiv_midnight


def utc_to_kyiv(utc_dt: datetime) -> datetime:
    """Конвертувати UTC час в київський"""
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(KYIV_TZ)


def kyiv_to_utc(kyiv_dt: datetime) -> datetime:
    """Конвертувати київський час в UTC"""
    if kyiv_dt.tzinfo is None:
        kyiv_dt = KYIV_TZ.localize(kyiv_dt)
    return kyiv_dt.astimezone(timezone.utc)


def seconds_until_kyiv_midnight() -> int:
    """Скільки секунд до наступної півночі за київським часом"""
    kyiv_now = get_kyiv_time()
    kyiv_midnight = get_kyiv_midnight()
    delta = kyiv_midnight - kyiv_now
    return int(delta.total_seconds())