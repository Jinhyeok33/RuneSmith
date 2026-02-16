'use client';

import { useState, useMemo, useCallback } from 'react';
import type { SkillBlueprint } from '@runesmith/shared';
import { compileBlueprint } from '@runesmith/shared';
import type { LLMParserOutput, MarketListing } from '@runesmith/shared';
import { useGameStore } from '@/lib/store/game-store';

const ELEM_COLORS: Record<string, string> = {
  Fire: '#f97316', Ice: '#38bdf8', Lightning: '#facc15', Water: '#0ea5e9',
  Nature: '#22c55e', Earth: '#d97706', Wind: '#94a3b8', Void: '#a855f7',
  Arcane: '#c084fc', Holy: '#fef08a', Shadow: '#404040', Blood: '#dc2626',
  Metal: '#d4d4d8', Crystal: '#e879f9',
};

function generateListings(): MarketListing[] {
  const presets: { output: LLMParserOutput; seller: string; price: number; rating: number; purchases: number; world: number }[] = [
    {
      output: {
        intent: { name: '메테오 스트라이크', description: '하늘에서 거대한 불꽃 운석이 떨어집니다', tags: ['fire', 'aoe', 'damage'] },
        mechanics: { delivery: 'AoE_Circle', effects: [{ type: 'FlatDamage', value: 90 }, { type: 'DoT', value: 15, duration: 3000 }], keywords: [{ keyword: 'Explosive' }] },
        vfx: { geometry: 'Meteor', motion: 'Accelerate', material: 'Fire', rhythm: 'Ramp_Up', palette: { primary: '#f97316', secondary: '#fbbf24' }, intensity: 0.9 },
        seed: 2001,
      },
      seller: 'FlameWizard', price: 250, rating: 4.7, purchases: 342, world: 1,
    },
    {
      output: {
        intent: { name: '프로스트 노바', description: '주변 적을 얼리는 극한의 한파', tags: ['ice', 'aoe', 'cc'] },
        mechanics: { delivery: 'AoE_Nova', effects: [{ type: 'FlatDamage', value: 50 }, { type: 'Stun', value: 0, duration: 1500 }], keywords: [] },
        vfx: { geometry: 'Sphere', motion: 'Expand_Sphere', material: 'Ice', rhythm: 'Burst', palette: { primary: '#38bdf8', secondary: '#e0f2fe' }, intensity: 0.8 },
        seed: 2002,
      },
      seller: 'IceMaster', price: 180, rating: 4.2, purchases: 215, world: 1,
    },
    {
      output: {
        intent: { name: '체인 라이트닝', description: '3체의 적에게 연쇄하는 전격', tags: ['lightning', 'chain'] },
        mechanics: { delivery: 'Bolt', effects: [{ type: 'FlatDamage', value: 70 }], keywords: [{ keyword: 'Chain', n: 3 }] },
        vfx: { geometry: 'Arc', motion: 'Straight', material: 'Lightning', rhythm: 'Staccato', palette: { primary: '#facc15', secondary: '#ffffff' }, intensity: 0.85 },
        seed: 2003,
      },
      seller: 'ThunderGod', price: 320, rating: 4.9, purchases: 567, world: 2,
    },
    {
      output: {
        intent: { name: '심연의 촉수', description: '공허에서 촉수가 솟아올라 적을 속박', tags: ['void', 'cc'] },
        mechanics: { delivery: 'Zone', effects: [{ type: 'FlatDamage', value: 40 }, { type: 'Root', value: 0, duration: 2000 }], keywords: [{ keyword: 'Lingering' }] },
        vfx: { geometry: 'Vortex', motion: 'Float_Rise', material: 'Void', rhythm: 'Sustained', palette: { primary: '#a855f7', secondary: '#1e1b4b' }, intensity: 0.7 },
        seed: 2004,
      },
      seller: 'VoidWalker', price: 400, rating: 4.5, purchases: 128, world: 3,
    },
    {
      output: {
        intent: { name: '성스러운 심판', description: '하늘에서 빛줄기가 적을 심판합니다', tags: ['holy', 'damage'] },
        mechanics: { delivery: 'Strike', effects: [{ type: 'FlatDamage', value: 120 }, { type: 'PercentDamage', value: 0, percent: 10 }], keywords: [] },
        vfx: { geometry: 'Beam_Geo', motion: 'Straight', material: 'Holy', rhythm: 'Ramp_Up', palette: { primary: '#fef08a', secondary: '#ffffff' }, intensity: 1.0 },
        seed: 2005,
      },
      seller: 'Paladin', price: 500, rating: 4.8, purchases: 89, world: 4,
    },
    {
      output: {
        intent: { name: '크리스탈 배리어', description: '수정 보호막으로 몸을 감쌉니다', tags: ['crystal', 'defense'] },
        mechanics: { delivery: 'Buff', effects: [{ type: 'Shield', value: 100 }, { type: 'DamageReduce', value: 0, percent: 15 }], keywords: [] },
        vfx: { geometry: 'Bubble', motion: 'Orbit', material: 'Crystal', rhythm: 'Pulsing', palette: { primary: '#e879f9', secondary: '#67e8f9' }, intensity: 0.6 },
        seed: 2006,
      },
      seller: 'CrystalMage', price: 220, rating: 4.3, purchases: 198, world: 2,
    },
    {
      output: {
        intent: { name: '블러드 레인', description: '피의 비가 적에게 지속 피해와 흡혈', tags: ['blood', 'dot'] },
        mechanics: { delivery: 'AoE_Circle', effects: [{ type: 'DoT', value: 20, duration: 5000 }, { type: 'LifeSteal', value: 0, percent: 15 }], keywords: [{ keyword: 'Lingering' }] },
        vfx: { geometry: 'Wave', motion: 'Float_Rise', material: 'Blood', rhythm: 'Heartbeat', palette: { primary: '#dc2626', secondary: '#450a0a' }, intensity: 0.75 },
        seed: 2007,
      },
      seller: 'BloodMancer', price: 380, rating: 4.6, purchases: 156, world: 3,
    },
    {
      output: {
        intent: { name: '대지의 벽', description: '거대한 암석 벽이 솟아올라 적을 막습니다', tags: ['earth', 'wall'] },
        mechanics: { delivery: 'Wall', effects: [{ type: 'FlatDamage', value: 30 }, { type: 'Knockback', value: 0, distance: 5 }], keywords: [{ keyword: 'Delayed' }] },
        vfx: { geometry: 'Shard', motion: 'Float_Rise', material: 'Earth', rhythm: 'Delayed', palette: { primary: '#d97706', secondary: '#92400e' }, intensity: 0.65 },
        seed: 2008,
      },
      seller: 'EarthShaker', price: 150, rating: 3.9, purchases: 87, world: 1,
    },
  ];

  return presets.map((p, i) => {
    const blueprint = compileBlueprint(p.output, p.world, 0, p.seller);
    return {
      id: `listing_${i}`,
      skill: blueprint,
      sellerId: p.seller.toLowerCase(),
      sellerName: p.seller,
      price: p.price,
      rating: p.rating,
      ratingCount: Math.floor(p.purchases * 0.3),
      purchaseCount: p.purchases,
      createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      isLocked: false,
    };
  });
}

type SortBy = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';

export default function MarketBrowsePage() {
  const worldTier = useGameStore((s) => s.worldTier);
  const points = useGameStore((s) => s.points);
  const runeCrystals = useGameStore((s) => s.runeCrystals);
  const addSkill = useGameStore((s) => s.addSkill);
  const spendPoints = useGameStore((s) => s.spendPoints);
  const mySkills = useGameStore((s) => s.skills);

  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [elementFilter, setElementFilter] = useState('all');
  const [purchased, setPurchased] = useState<Set<string>>(new Set());

  const allListings = useMemo(() => generateListings(), []);

  const listings = useMemo(() => {
    let result = allListings.map((l) => ({
      ...l,
      isLocked: l.skill.worldTier > worldTier,
      unlockCostRC: l.skill.worldTier > worldTier ? 100 * (l.skill.worldTier - worldTier) : undefined,
    }));
    if (elementFilter !== 'all') result = result.filter((l) => l.skill.vfx.material === elementFilter);
    switch (sortBy) {
      case 'popular': result.sort((a, b) => b.purchaseCount - a.purchaseCount); break;
      case 'newest': result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); break;
      case 'price_asc': result.sort((a, b) => a.price - b.price); break;
      case 'price_desc': result.sort((a, b) => b.price - a.price); break;
      case 'rating': result.sort((a, b) => b.rating - a.rating); break;
    }
    return result;
  }, [allListings, sortBy, elementFilter, worldTier]);

  const handlePurchase = useCallback((listing: MarketListing) => {
    if (listing.isLocked || purchased.has(listing.id)) return;
    if (mySkills.some((s) => s.name === listing.skill.name)) return;
    if (!spendPoints(listing.price)) return;
    addSkill(listing.skill);
    setPurchased((prev) => new Set(prev).add(listing.id));
  }, [purchased, mySkills, spendPoints, addSkill]);

  const elements = ['all', 'Fire', 'Ice', 'Lightning', 'Water', 'Nature', 'Earth', 'Wind', 'Void', 'Arcane', 'Holy', 'Shadow', 'Blood', 'Metal', 'Crystal'];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing) => {
            const skill = listing.skill;
            const elemColor = ELEM_COLORS[skill.vfx.material] || '#fff';
            const owned = purchased.has(listing.id) || mySkills.some((s) => s.name === skill.name);
            const canAfford = points >= listing.price;

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
                    {skill.mechanics.effects.map((e, i) => (
                      <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-[var(--text-secondary)]">{e.type}</span>
                    ))}
                    {skill.mechanics.keywords.map((kw, i) => (
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
                    disabled={listing.isLocked || owned || !canAfford}
                    className="w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: owned ? 'var(--bg-secondary)' : listing.isLocked ? 'rgba(239,68,68,0.1)' : `linear-gradient(90deg, ${elemColor}20, ${elemColor}10)`,
                      border: `1px solid ${owned ? 'var(--border)' : listing.isLocked ? 'rgba(239,68,68,0.3)' : elemColor + '40'}`,
                      color: owned ? 'var(--text-secondary)' : listing.isLocked ? '#ef4444' : elemColor,
                    }}
                  >
                    {owned ? '보유 중' : listing.isLocked ? `🔒 World ${skill.worldTier} 도달 시 해금` : !canAfford ? '포인트 부족' : '구매하기'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {listings.length === 0 && (
          <div className="text-center py-20 text-[var(--text-secondary)]">해당 필터에 맞는 스킬이 없습니다.</div>
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
