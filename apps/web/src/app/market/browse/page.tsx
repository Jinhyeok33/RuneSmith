'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SkillBlueprint } from '@runesmith/shared';
import type { MarketListing } from '@runesmith/shared';
import { useGameStore } from '@/lib/store/game-store';
import { apiClient } from '@/lib/api/client';

const ELEM_COLORS: Record<string, string> = {
  Fire: '#f97316', Ice: '#38bdf8', Lightning: '#facc15', Water: '#0ea5e9',
  Nature: '#22c55e', Earth: '#d97706', Wind: '#94a3b8', Void: '#a855f7',
  Arcane: '#c084fc', Holy: '#fef08a', Shadow: '#404040', Blood: '#dc2626',
  Metal: '#d4d4d8', Crystal: '#e879f9',
};

interface ApiMarketListing {
  id: number;
  skill: {
    id: number;
    skill_id: string;
    name: string;
    world_tier: number;
    combat_budget: number;
    vfx_budget: number;
    mechanics: any;
    vfx: any;
    stats: any;
    times_used: number;
  };
  seller_username: string;
  seller_id: number;
  price: number;
  currency_type: string;
  status: string;
  views: number;
  purchases: number;
  average_rating: number;
  rating_count: number;
  created_at: string;
}

function convertApiListingToLocal(apiListing: ApiMarketListing, currentWorldTier: number): MarketListing & { isLocked: boolean; unlockCostRC?: number } {
  const skill: SkillBlueprint = {
    id: apiListing.skill.skill_id,
    name: apiListing.skill.name,
    description: apiListing.skill.mechanics?.intent?.description || '',
    seed: 0,
    worldTier: apiListing.skill.world_tier,
    combatBudget: apiListing.skill.combat_budget,
    combatBudgetMax: 100 * Math.pow(1.5, apiListing.skill.world_tier - 1),
    vfxBudget: apiListing.skill.vfx_budget,
    vfxBudgetBase: 100 + (apiListing.skill.world_tier - 1) * 25,
    vfxBudgetPaid: 0,
    mechanics: apiListing.skill.mechanics,
    vfx: apiListing.skill.vfx,
    stats: apiListing.skill.stats || {},
  };

  const isLocked = apiListing.skill.world_tier > currentWorldTier;
  const unlockCostRC = isLocked ? 100 * (apiListing.skill.world_tier - currentWorldTier) : undefined;

  return {
    id: `listing_${apiListing.id}`,
    skill,
    sellerId: apiListing.seller_id.toString(),
    sellerName: apiListing.seller_username,
    price: apiListing.price,
    rating: apiListing.average_rating,
    ratingCount: apiListing.rating_count,
    purchaseCount: apiListing.purchases,
    createdAt: apiListing.created_at,
    isLocked,
    unlockCostRC,
  };
}

type SortBy = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';

export default function MarketBrowsePage() {
  const worldTier = useGameStore((s) => s.worldTier);
  const points = useGameStore((s) => s.points);
  const runeCrystals = useGameStore((s) => s.runeCrystals);
  const isAuthenticated = useGameStore((s) => s.isAuthenticated);
  const user = useGameStore((s) => s.user);
  const syncFromUser = useGameStore((s) => s.syncFromUser);
  const addSkill = useGameStore((s) => s.addSkill);
  const mySkills = useGameStore((s) => s.skills);

  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [elementFilter, setElementFilter] = useState('all');
  const [listings, setListings] = useState<(MarketListing & { isLocked: boolean; unlockCostRC?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Fetch listings from API
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError(null);
      try {
        const sortMap: Record<SortBy, string> = {
          popular: 'popular',
          newest: 'newest',
          rating: 'rating',
          price_asc: 'price_asc',
          price_desc: 'price_desc',
        };

        const response = await apiClient.browseMarket({
          element: elementFilter !== 'all' ? elementFilter : undefined,
          sort_by: sortMap[sortBy],
          limit: 50,
        });

        const converted = response.map((listing: ApiMarketListing) =>
          convertApiListingToLocal(listing, worldTier)
        );
        setListings(converted);
      } catch (err: any) {
        setError(err.message || '마켓 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [sortBy, elementFilter, worldTier]);

  const handlePurchase = useCallback(async (listing: MarketListing & { isLocked: boolean }) => {
    if (!isAuthenticated || !user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (listing.isLocked) {
      alert(`World ${listing.skill.worldTier}에 도달해야 구매할 수 있습니다.`);
      return;
    }
    if (mySkills.some((s) => s.name === listing.skill.name)) {
      alert('이미 보유 중인 스킬입니다.');
      return;
    }
    if (points < listing.price) {
      alert('포인트가 부족합니다.');
      return;
    }

    const listingId = parseInt(listing.id.replace('listing_', ''), 10);
    setPurchasing(listing.id);

    try {
      const purchasedSkill = await apiClient.buySkill(listingId);

      // Update local state
      addSkill(listing.skill);

      // Sync user data (points/rune crystals updated by backend)
      const updatedUser = await apiClient.getMe();
      syncFromUser(updatedUser);

      alert(`${listing.skill.name} 구매 완료!`);

      // Refresh listings to update purchase count
      const response = await apiClient.browseMarket({
        element: elementFilter !== 'all' ? elementFilter : undefined,
        sort_by: sortBy,
        limit: 50,
      });
      const converted = response.map((l: ApiMarketListing) =>
        convertApiListingToLocal(l, worldTier)
      );
      setListings(converted);
    } catch (err: any) {
      alert(err.message || '구매에 실패했습니다.');
    } finally {
      setPurchasing(null);
    }
  }, [isAuthenticated, user, mySkills, points, addSkill, syncFromUser, sortBy, elementFilter, worldTier]);

  const elements = ['all', 'Fire', 'Ice', 'Lightning', 'Water', 'Nature', 'Earth', 'Wind', 'Void', 'Arcane', 'Holy', 'Shadow', 'Blood', 'Metal', 'Crystal'];

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">로그인이 필요합니다</h2>
          <p className="text-[var(--text-secondary)] mb-6">마켓플레이스를 이용하려면 로그인해주세요.</p>
          <a
            href="/auth/login"
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] text-white font-bold"
          >
            로그인하기
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">← 홈</a>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] bg-clip-text text-transparent">
            Market — 마켓플레이스
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/market/sell"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--accent-heal)] to-[var(--accent-arcane)] text-white font-bold hover:opacity-90 transition"
          >
            스킬 판매하기
          </a>
          <span className="text-[var(--text-secondary)]">{user?.username}</span>
          <span className="text-[var(--text-secondary)]">World <span className="text-[var(--accent-lightning)] font-bold">{worldTier}</span></span>
          <span className="text-[var(--text-secondary)]">Points <span className="text-[var(--accent-heal)] font-bold">{points}</span></span>
          <span className="text-[var(--text-secondary)]">RC <span className="text-[var(--accent-arcane)] font-bold">{runeCrystals}</span></span>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-[var(--border)] flex items-center gap-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {elements.map((el) => (
            <button
              key={el}
              onClick={() => setElementFilter(el)}
              className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
              style={{
                borderColor: elementFilter === el ? (ELEM_COLORS[el] || 'var(--accent-arcane)') + '80' : 'var(--border)',
                background: elementFilter === el ? (ELEM_COLORS[el] || 'var(--accent-arcane)') + '15' : 'transparent',
                color: elementFilter === el ? (ELEM_COLORS[el] || 'var(--accent-arcane)') : 'var(--text-secondary)',
              }}
            >
              {el === 'all' ? '전체' : el}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="ml-auto text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text-primary)]"
        >
          <option value="popular">인기순</option>
          <option value="newest">최신순</option>
          <option value="rating">평점순</option>
          <option value="price_asc">가격 낮은순</option>
          <option value="price_desc">가격 높은순</option>
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-[var(--accent-arcane)] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[var(--text-secondary)]">마켓 데이터 로딩 중...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[var(--accent-arcane)] text-white rounded-lg"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {listings.map((listing) => {
                const skill = listing.skill;
                const elemColor = ELEM_COLORS[skill.vfx.material] || '#fff';
                const owned = mySkills.some((s) => s.name === skill.name);
                const canAfford = points >= listing.price;
                const isPurchasing = purchasing === listing.id;

                return (
                  <div key={listing.id} className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-white/10">
                    <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${elemColor}, transparent)` }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">{skill.name}</h3>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{skill.description}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 ml-2" style={{ color: elemColor, borderColor: elemColor + '40' }}>
                          {skill.vfx.material}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        <MiniStat label="Delivery" value={skill.mechanics.delivery} />
                        <MiniStat label="Budget" value={`${Math.round(skill.combatBudget)}`} />
                        <MiniStat label="World" value={`Tier ${skill.worldTier}`} />
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {skill.mechanics.effects?.map((e: any, i: number) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-[var(--text-secondary)]">{e.type}</span>
                        ))}
                        {skill.mechanics.keywords?.map((kw: any, i: number) => (
                          <span key={`kw-${i}`} className="text-[8px] px-1.5 py-0.5 rounded-full border border-[var(--accent-arcane)]/20 text-[var(--accent-arcane)]">
                            {kw.keyword}{kw.n ? ` ×${kw.n}` : ''}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mb-3">
                        <span>by {listing.sellerName}</span>
                        <span>{'★'.repeat(Math.round(listing.rating))}{'☆'.repeat(5 - Math.round(listing.rating))} {listing.rating.toFixed(1)}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[var(--accent-heal)]">{listing.price} pts</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{listing.purchaseCount} 구매</span>
                      </div>

                      <button
                        onClick={() => handlePurchase(listing)}
                        disabled={listing.isLocked || owned || !canAfford || isPurchasing}
                        className="w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: owned ? 'var(--bg-secondary)' : listing.isLocked ? 'rgba(239,68,68,0.1)' : `linear-gradient(90deg, ${elemColor}20, ${elemColor}10)`,
                          border: `1px solid ${owned ? 'var(--border)' : listing.isLocked ? 'rgba(239,68,68,0.3)' : elemColor + '40'}`,
                          color: owned ? 'var(--text-secondary)' : listing.isLocked ? '#ef4444' : elemColor,
                        }}
                      >
                        {isPurchasing ? '구매 중...' : owned ? '보유 중' : listing.isLocked ? `🔒 World ${skill.worldTier} 도달 시 해금` : !canAfford ? '포인트 부족' : '구매하기'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {listings.length === 0 && (
              <div className="text-center py-20 text-[var(--text-secondary)]">해당 필터에 맞는 스킬이 없습니다.</div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-md p-1.5 text-center">
      <div className="text-[8px] text-[var(--text-secondary)]">{label}</div>
      <div className="text-[10px] font-mono text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
