from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    # Base
    APP_NAME: str = "RevitBot Web API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./database/database.db"
    DATABASE_ECHO: bool = False

    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Telegram
    BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "revitbot"

    # Payment
    CRYPTOMUS_MERCHANT_UUID: Optional[str] = None
    CRYPTOMUS_API_KEY: Optional[str] = None

    # Development
    DEV_MODE: bool = True

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent
    STATIC_DIR: Path = BASE_DIR / "static"
    MEDIA_DIR: Path = BASE_DIR / "media"
    PREMIUM_ARCHIVES_DIR: Path = BASE_DIR / "data" / "premium"
    FREE_ARCHIVES_DIR: Path = BASE_DIR / "data" / "free"

    # Prices (раніше були окремо)
    SUBSCRIPTION_PRICE_MONTHLY: float = 5.0
    SUBSCRIPTION_PRICE_YEARLY: float = 50.0

    # Bonuses (оновлені значення)
    BONUS_PER_REFERRAL: int = 20
    BONUSES_PER_USD: int = 100
    BONUS_PURCHASE_CAP: float = 0.7
    WELCOME_BONUS_AMOUNT: int = 0

    # Cashback rates by VIP level
    VIP_BRONZE_CASHBACK: float = 0.03
    VIP_SILVER_CASHBACK: float = 0.05
    VIP_GOLD_CASHBACK: float = 0.07
    VIP_DIAMOND_CASHBACK: float = 0.10

    # VIP thresholds
    VIP_SILVER_THRESHOLD: float = 100.0
    VIP_GOLD_THRESHOLD: float = 500.0
    VIP_DIAMOND_THRESHOLD: float = 1000.0

    # Daily bonus
    DAILY_BONUS_STREAK_RESTORE_COST: int = 30
    DAILY_BONUS_SLOT_JACKPOT: int = 100
    DAILY_BONUS_SLOT_JACKPOT_CHANCE: float = 0.005

    # Referral system
    REFERRAL_PURCHASE_PERCENT: float = 0.05

    # Timezone for daily reset
    DAILY_RESET_TIMEZONE: str = "Europe/Kiev" # <-- Тепер це частина класу!

    class Config:
        env_file = ".env"
        case_sensitive = False

# Створюємо екземпляр налаштувань
settings = Settings()

# Створюємо директорії, якщо їх немає
settings.STATIC_DIR.mkdir(exist_ok=True)
settings.MEDIA_DIR.mkdir(exist_ok=True)
settings.PREMIUM_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
settings.FREE_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)