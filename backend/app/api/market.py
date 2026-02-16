"""
Market API routes for skill marketplace
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.database.session import get_db
from app.models import User, Skill, MarketListing, Transaction, ListingStatus, TransactionType
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/market", tags=["market"])


# ── Schemas ──

class ListSkillRequest(BaseModel):
    skill_id: str  # User's skill ID
    price: int
    currency_type: str = "points"  # "points" or "rune_crystals"


class BuySkillRequest(BaseModel):
    listing_id: int


class RateSkillRequest(BaseModel):
    listing_id: int
    rating: float  # 1.0 to 5.0


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


class MarketListingResponse(BaseModel):
    id: int
    skill: SkillResponse
    seller_username: str
    seller_id: int
    price: int
    currency_type: str
    status: str
    views: int
    purchases: int
    average_rating: float
    rating_count: int
    created_at: datetime


class PurchasedSkillResponse(BaseModel):
    transaction_id: int
    skill: SkillResponse
    amount_paid: int
    currency_type: str
    purchased_at: datetime


# ── Routes ──

@router.post("/list", response_model=MarketListingResponse, status_code=status.HTTP_201_CREATED)
async def list_skill(
    request: ListSkillRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List a skill for sale on the marketplace"""

    # Find user's skill
    result = await db.execute(
        select(Skill).where(
            and_(
                Skill.skill_id == request.skill_id,
                Skill.owner_id == current_user.id
            )
        )
    )
    skill = result.scalar_one_or_none()

    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found or you don't own this skill"
        )

    # Check if already listed
    result = await db.execute(
        select(MarketListing).where(MarketListing.skill_id == skill.id)
    )
    existing_listing = result.scalar_one_or_none()

    if existing_listing and existing_listing.status == ListingStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill is already listed"
        )

    # Validate price
    if request.price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Price must be positive"
        )

    # Create listing
    listing = MarketListing(
        skill_id=skill.id,
        seller_id=current_user.id,
        price=request.price,
        currency_type=request.currency_type,
        status=ListingStatus.ACTIVE,
    )

    db.add(listing)
    await db.commit()
    await db.refresh(listing)

    # Build response
    return MarketListingResponse(
        id=listing.id,
        skill=SkillResponse(
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
        ),
        seller_username=current_user.username,
        seller_id=current_user.id,
        price=listing.price,
        currency_type=listing.currency_type,
        status=listing.status.value,
        views=listing.views,
        purchases=listing.purchases,
        average_rating=listing.average_rating,
        rating_count=listing.rating_count,
        created_at=listing.created_at,
    )


@router.get("/browse", response_model=List[MarketListingResponse])
async def browse_market(
    world_tier: Optional[int] = Query(None, ge=1, le=5),
    element: Optional[str] = Query(None),
    sort_by: str = Query("popular", regex="^(popular|newest|rating|price_asc|price_desc)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Browse marketplace listings with filters"""

    # Base query
    query = select(MarketListing, Skill, User).join(
        Skill, MarketListing.skill_id == Skill.id
    ).join(
        User, MarketListing.seller_id == User.id
    ).where(
        MarketListing.status == ListingStatus.ACTIVE
    )

    # Apply filters
    if world_tier:
        query = query.where(Skill.world_tier == world_tier)

    if element:
        # Filter by VFX material element (stored in JSON)
        query = query.where(Skill.vfx["material"].astext == element)

    # Apply sorting
    if sort_by == "popular":
        query = query.order_by(MarketListing.purchases.desc(), MarketListing.views.desc())
    elif sort_by == "newest":
        query = query.order_by(MarketListing.created_at.desc())
    elif sort_by == "rating":
        query = query.order_by(
            (MarketListing.total_rating / func.greatest(MarketListing.rating_count, 1)).desc()
        )
    elif sort_by == "price_asc":
        query = query.order_by(MarketListing.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(MarketListing.price.desc())

    # Apply pagination
    query = query.limit(limit).offset(offset)

    # Execute
    result = await db.execute(query)
    rows = result.all()

    # Build response
    listings = []
    for listing, skill, seller in rows:
        listings.append(MarketListingResponse(
            id=listing.id,
            skill=SkillResponse(
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
            ),
            seller_username=seller.username,
            seller_id=seller.id,
            price=listing.price,
            currency_type=listing.currency_type,
            status=listing.status.value,
            views=listing.views,
            purchases=listing.purchases,
            average_rating=listing.average_rating,
            rating_count=listing.rating_count,
            created_at=listing.created_at,
        ))

    return listings


@router.post("/buy", response_model=PurchasedSkillResponse)
async def buy_skill(
    request: BuySkillRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Purchase a skill from the marketplace"""

    # Get listing with skill
    result = await db.execute(
        select(MarketListing, Skill).join(
            Skill, MarketListing.skill_id == Skill.id
        ).where(
            MarketListing.id == request.listing_id
        )
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )

    listing, original_skill = row

    # Check if listing is active
    if listing.status != ListingStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing is not active"
        )

    # Check if buyer is trying to buy their own skill
    if listing.seller_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot buy your own skill"
        )

    # Check if buyer has enough currency
    if listing.currency_type == "points":
        if current_user.points < listing.price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient points"
            )
    elif listing.currency_type == "rune_crystals":
        if current_user.rune_crystals < listing.price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient rune crystals"
            )

    # Check world tier restriction
    if current_user.world_tier < original_skill.world_tier:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You need to reach World {original_skill.world_tier} to purchase this skill"
        )

    # Create a copy of the skill for the buyer
    new_skill_id = str(uuid.uuid4())
    copied_skill = Skill(
        owner_id=current_user.id,
        skill_id=new_skill_id,
        name=original_skill.name,
        user_input=original_skill.user_input,
        seed=original_skill.seed,
        world_tier=original_skill.world_tier,
        combat_budget=original_skill.combat_budget,
        combat_budget_max=original_skill.combat_budget_max,
        vfx_budget=original_skill.vfx_budget,
        vfx_budget_base=original_skill.vfx_budget_base,
        vfx_budget_paid=original_skill.vfx_budget_paid,
        mechanics=original_skill.mechanics,
        vfx=original_skill.vfx,
        stats=original_skill.stats,
    )

    db.add(copied_skill)
    await db.flush()

    # Deduct currency from buyer
    if listing.currency_type == "points":
        current_user.points -= listing.price
    else:
        current_user.rune_crystals -= listing.price

    # Add currency to seller
    result = await db.execute(
        select(User).where(User.id == listing.seller_id)
    )
    seller = result.scalar_one()

    if listing.currency_type == "points":
        seller.points += listing.price
    else:
        seller.rune_crystals += listing.price

    # Create transaction record
    transaction = Transaction(
        listing_id=listing.id,
        buyer_id=current_user.id,
        transaction_type=TransactionType.PURCHASE,
        amount=listing.price,
        currency_type=listing.currency_type,
        buyer_skill_id=copied_skill.id,
        is_successful=True,
    )

    db.add(transaction)

    # Update listing stats
    listing.purchases += 1

    await db.commit()
    await db.refresh(copied_skill)
    await db.refresh(transaction)

    # Return purchased skill
    return PurchasedSkillResponse(
        transaction_id=transaction.id,
        skill=SkillResponse(
            id=copied_skill.id,
            skill_id=copied_skill.skill_id,
            name=copied_skill.name,
            world_tier=copied_skill.world_tier,
            combat_budget=copied_skill.combat_budget,
            vfx_budget=copied_skill.vfx_budget,
            mechanics=copied_skill.mechanics,
            vfx=copied_skill.vfx,
            stats=copied_skill.stats,
            times_used=copied_skill.times_used,
        ),
        amount_paid=transaction.amount,
        currency_type=transaction.currency_type,
        purchased_at=transaction.created_at,
    )


@router.get("/my-listings", response_model=List[MarketListingResponse])
async def get_my_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's market listings"""

    result = await db.execute(
        select(MarketListing, Skill).join(
            Skill, MarketListing.skill_id == Skill.id
        ).where(
            MarketListing.seller_id == current_user.id
        ).order_by(
            MarketListing.created_at.desc()
        )
    )

    rows = result.all()

    listings = []
    for listing, skill in rows:
        listings.append(MarketListingResponse(
            id=listing.id,
            skill=SkillResponse(
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
            ),
            seller_username=current_user.username,
            seller_id=current_user.id,
            price=listing.price,
            currency_type=listing.currency_type,
            status=listing.status.value,
            views=listing.views,
            purchases=listing.purchases,
            average_rating=listing.average_rating,
            rating_count=listing.rating_count,
            created_at=listing.created_at,
        ))

    return listings
