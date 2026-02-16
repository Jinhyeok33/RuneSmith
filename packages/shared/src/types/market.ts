import type { SkillBlueprint } from './skill';

export interface MarketListing {
  id: string;
  skill: SkillBlueprint;
  sellerId: string;
  sellerName: string;
  price: number;           // 포인트
  rating: number;          // 1~5
  ratingCount: number;
  purchaseCount: number;
  createdAt: string;       // ISO date
  isLocked: boolean;       // 구매자 worldTier < skill.worldTier
  unlockCostRC?: number;   // RC로 조기 해금 비용
}

export interface MarketFilter {
  element?: string;
  delivery?: string;
  worldTier?: number;
  minRating?: number;
  maxPrice?: number;
  sortBy: 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
}

// ── Currency ──
export interface PlayerWallet {
  points: number;          // 게임 내 포인트 (전투 보상)
  runeCrystals: number;    // 과금 통화 (RC)
}

export interface PurchaseResult {
  success: boolean;
  error?: 'insufficient_points' | 'insufficient_rc' | 'world_locked' | 'already_owned';
  skill?: SkillBlueprint;
}
