"""
Skill model for storing player-created skills
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Skill identity
    skill_id = Column(String(100), unique=True, nullable=False, index=True)  # UUID
    name = Column(String(100), nullable=False)
    user_input = Column(String(500), nullable=False)  # Original natural language input
    seed = Column(Integer, nullable=False)

    # World & Budget metadata
    world_tier = Column(Integer, nullable=False, index=True)
    combat_budget = Column(Float, nullable=False)
    combat_budget_max = Column(Float, nullable=False)
    vfx_budget = Column(Float, nullable=False)
    vfx_budget_base = Column(Float, nullable=False)
    vfx_budget_paid = Column(Float, default=0, nullable=False)

    # Mechanics (JSON)
    mechanics = Column(JSON, nullable=False)  # delivery, effects[], keywords[]
    vfx = Column(JSON, nullable=False)  # material, geometry, motion, rhythm, blocks[]
    stats = Column(JSON, nullable=False)  # cooldown, manaCost, castTime, risk

    # Usage tracking
    times_used = Column(Integer, default=0, nullable=False)
    total_damage = Column(Float, default=0, nullable=False)
    times_evolved = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="skills")
    market_listing = relationship("MarketListing", back_populates="skill", uselist=False)

    def __repr__(self):
        return f"<Skill {self.name} (World {self.world_tier}, Owner: {self.owner_id})>"
