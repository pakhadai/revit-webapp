from pydantic_settings import BaseSettings
from pathlib import Path
import os
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

    # Prices
    PRICE_SUB_1_MONTH: float = 5.0
    PRICE_SUB_6_MONTHS: float = 25.0
    PRICE_SUB_12_MONTHS: float = 50.0

    # Bonuses
    BONUS_PER_REFERRAL: int = 200
    BONUSES_PER_USD: int = 100
    BONUS_PURCHASE_CAP: float = 0.7
    WELCOME_BONUS_AMOUNT: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = False


# Create settings instance
settings = Settings()

# Create directories if they don't exist
settings.STATIC_DIR.mkdir(exist_ok=True)
settings.MEDIA_DIR.mkdir(exist_ok=True)
settings.PREMIUM_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
settings.FREE_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)