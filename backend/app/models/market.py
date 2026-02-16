"""
Market models for skill marketplace
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from app.database.session import Base


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    SOLD = "sold"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class TransactionType(str, enum.Enum):
    PURCHASE = "purchase"
    SALE = "sale"
    REFUND = "refund"


class MarketListing(Base):
    __tablename__ = "market_listings"

    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), unique=True, nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Listing details
    price = Column(Integer, nullable=False)  # In points
    currency_type = Column(String(20), default="points", nullable=False)  # "points" or "rune_crystals"

    # Status
    status = Column(Enum(ListingStatus), default=ListingStatus.ACTIVE, nullable=False, index=True)
    views = Column(Integer, default=0, nullable=False)
    purchases = Column(Integer, default=0, nullable=False)

    # Ratings (added after purchases)
    total_rating = Column(Float, default=0, nullable=False)
    rating_count = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    sold_at = Column(DateTime, nullable=True)

    # Relationships
    skill = relationship("Skill", back_populates="market_listing")
    seller = relationship("User", back_populates="market_listings")
    transactions = relationship("Transaction", back_populates="listing", cascade="all, delete-orphan")

    @property
    def average_rating(self) -> float:
        if self.rating_count == 0:
            return 0.0
        return self.total_rating / self.rating_count

    def __repr__(self):
        return f"<MarketListing {self.id} ({self.status.value}, {self.price} {self.currency_type})>"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("market_listings.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Transaction details
    transaction_type = Column(Enum(TransactionType), default=TransactionType.PURCHASE, nullable=False)
    amount = Column(Integer, nullable=False)
    currency_type = Column(String(20), nullable=False)

    # Buyer's skill instance (copied from listing)
    buyer_skill_id = Column(Integer, nullable=True)  # Reference to buyer's copied skill

    # Status
    is_successful = Column(Boolean, default=True, nullable=False)
    error_message = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    listing = relationship("MarketListing", back_populates="transactions")
    buyer = relationship("User", back_populates="transactions")

    def __repr__(self):
        return f"<Transaction {self.id} ({self.transaction_type.value}, {self.amount} {self.currency_type})>"
