# backend/api/__init__.py
from .auth import router as auth_router
from .archives import router as archives_router
from .orders import router as orders_router
from .admin import router as admin_router
from .subscriptions import router as subscriptions_router
from .bonuses import router as bonuses_router
from .referrals import router as referrals_router
from .vip import router as vip_router
from .payments import router as payments_router
from .downloads import router as downloads_router
from .favorites import router as favorites_router
from .history import router as history_router
from .ratings import router as ratings_router
from .notifications import router as notifications_router
from .comments import router as comments_router
from .promo_codes import router as promo_codes_router

__all__ = [
    'auth_router',
    'archives_router',
    'orders_router',
    'admin_router',
    'subscriptions_router',
    'bonuses_router',
    'referrals_router',
    'vip_router',
    'payments_router',
    'downloads_router',
    'favorites_router',
    'history_router',
    'ratings_router',
    'notifications_router',
    'comments_router',
    'promo_codes_router'
]