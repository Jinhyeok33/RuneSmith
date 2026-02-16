"""
User model for authentication and profile
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Game progression
    world_tier = Column(Integer, default=1, nullable=False)
    current_stage = Column(Integer, default=1, nullable=False)
    player_level = Column(Integer, default=1, nullable=False)
    xp = Column(Integer, default=0, nullable=False)

    # Currency
    points = Column(Integer, default=0, nullable=False)  # Free currency
    rune_crystals = Column(Integer, default=0, nullable=False)  # Premium currency

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    skills = relationship("Skill", back_populates="owner", cascade="all, delete-orphan")
    market_listings = relationship("MarketListing", back_populates="seller", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="buyer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username} (World {self.world_tier})>"
