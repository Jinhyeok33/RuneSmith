"""
Skills API routes - save/load skills to database
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.database.session import get_db
from app.models import User, Skill
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/skills", tags=["skills"])


# ── Schemas ──

class SaveSkillRequest(BaseModel):
    skill_id: str  # Frontend-generated ID (e.g. skill_1234567_abc123)
    name: str
    user_input: str
    seed: int
    world_tier: int
    combat_budget: float
    combat_budget_max: float
    vfx_budget: float
    vfx_budget_base: float
    vfx_budget_paid: float = 0
    mechanics: dict
    vfx: dict
    stats: dict


class SkillResponse(BaseModel):
    id: int
    skill_id: str
    name: str
    world_tier: int
    combat_budget: float
    vfx_budget: float
    mechanics: dict
    vfx: dict
    stats: dict
    times_used: int


# ── Routes ──

@router.post("/save", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def save_skill(
    request: SaveSkillRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a compiled skill to the database"""
    # Check if skill already saved (idempotent)
    existing = await db.execute(
        select(Skill).where(Skill.skill_id == request.skill_id, Skill.owner_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Skill already saved")

    skill = Skill(
        owner_id=current_user.id,
        skill_id=request.skill_id,
        name=request.name,
        user_input=request.user_input,
        seed=request.seed,
        world_tier=request.world_tier,
        combat_budget=request.combat_budget,
        combat_budget_max=request.combat_budget_max,
        vfx_budget=request.vfx_budget,
        vfx_budget_base=request.vfx_budget_base,
        vfx_budget_paid=request.vfx_budget_paid,
        mechanics=request.mechanics,
        vfx=request.vfx,
        stats=request.stats,
    )

    db.add(skill)
    await db.commit()
    await db.refresh(skill)

    return SkillResponse(
        id=skill.id,
        skill_id=skill.skill_id,
        name=skill.name,
        world_tier=skill.world_tier,
        combat_budget=skill.combat_budget,
        vfx_budget=skill.vfx_budget,
        mechanics=skill.mechanics,
        vfx=skill.vfx,
        stats=skill.stats,
        times_used=skill.times_used,
    )


@router.get("/my", response_model=List[SkillResponse])
async def get_my_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all skills owned by the current user"""
    result = await db.execute(
        select(Skill).where(Skill.owner_id == current_user.id).order_by(Skill.created_at.desc())
    )
    skills = result.scalars().all()

    return [
        SkillResponse(
            id=s.id,
            skill_id=s.skill_id,
            name=s.name,
            world_tier=s.world_tier,
            combat_budget=s.combat_budget,
            vfx_budget=s.vfx_budget,
            mechanics=s.mechanics,
            vfx=s.vfx,
            stats=s.stats,
            times_used=s.times_used,
        )
        for s in skills
    ]
