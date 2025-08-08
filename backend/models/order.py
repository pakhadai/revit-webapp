from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    # Status
    status = Column(String(50), default='pending')  # pending, processing, completed, cancelled

    # Pricing
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    bonuses_used = Column(Integer, default=0)
    total = Column(Float, nullable=False)

    # Promo
    promo_code = Column(String(50), nullable=True)

    # Extra data (змінено з metadata на extra_data)
    extra_data = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Order {self.order_id}>"


class OrderItem(Base):
    __tablename__ = 'order_items'

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.id'), nullable=False)
    archive_id = Column(Integer, ForeignKey('archives.id'), nullable=False)

    quantity = Column(Integer, default=1)
    price = Column(Float, nullable=False)

    def __repr__(self):
        return f"<OrderItem order={self.order_id} archive={self.archive_id}>"
