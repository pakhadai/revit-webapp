# backend/models/__init__.py (ПОВНА І ВИПРАВЛЕНА ВЕРСІЯ)

from .user import User
from .archive import Archive, ArchivePurchase
from .order import Order, OrderItem
from .payment import Payment
from .subscription import Subscription, SubscriptionArchive, SubscriptionStatus, SubscriptionPlan
from .bonus import BonusTransaction, DailyBonus, UserReferral, VipLevel, BonusTransactionType
from .favorite import Favorite
from .view_history import ViewHistory
from .archive_rating import ArchiveRating
from .notification import Notification

__all__ = [
    'User',
    'Archive',
    'ArchivePurchase',
    'Order',
    'OrderItem',
    'Payment',
    'Subscription',
    'SubscriptionArchive',
    'BonusTransaction',
    'DailyBonus',
    'UserReferral',
    'VipLevel',
    'Favorite',
    'ViewHistory',
    'ArchiveRating',
    'Notification'
]