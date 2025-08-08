from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class Payment(Base):
    __tablename__ = 'payments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(String(100), unique=True, nullable=False, index=True)
    order_id = Column(Integer, ForeignKey('orders.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default='USD')

    # Status
    status = Column(String(50), default='pending')  # pending, processing, completed, failed

    # Payment method
    payment_method = Column(String(50))  # cryptomus, dev_mode

    # Payment data
    payment_data = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Payment {self.payment_id}>"