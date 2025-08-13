# backend/limiter.py
from slowapi import Limiter
from slowapi.util import get_remote_address

# Створюємо limiter для обмеження кількості запитів
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300 per minute"],  # Глобальний ліміт
    storage_uri="memory://"  # Використовуємо in-memory storage
)

# Експортуємо для використання в інших модулях
__all__ = ["limiter"]