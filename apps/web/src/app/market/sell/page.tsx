'use client';

import { useState, useCallback } from 'react';
import { useGameStore } from '@/lib/store/game-store';
import { apiClient } from '@/lib/api/client';
import type { SkillBlueprint } from '@runesmith/shared';
import { useRouter } from 'next/navigation';

const ELEM_COLORS: Record<string, string> = {
  Fire: '#f97316', Ice: '#38bdf8', Lightning: '#facc15', Water: '#0ea5e9',
  Nature: '#22c55e', Earth: '#d97706', Wind: '#94a3b8', Void: '#a855f7',
  Arcane: '#c084fc', Holy: '#fef08a', Shadow: '#404040', Blood: '#dc2626',
  Metal: '#d4d4d8', Crystal: '#e879f9',
};

export default function SellSkillPage() {
  const router = useRouter();
  const isAuthenticated = useGameStore((s) => s.isAuthenticated);
  const user = useGameStore((s) => s.user);
  const mySkills = useGameStore((s) => s.skills);

  const [selectedSkill, setSelectedSkill] = useState<SkillBlueprint | null>(null);
  const [price, setPrice] = useState<number>(100);
  const [currencyType, setCurrencyType] = useState<'points' | 'rune_crystals'>('points');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleListSkill = useCallback(async () => {
    if (!selectedSkill) {
      setError('판매할 스킬을 선택해주세요.');
      return;
    }

    if (price <= 0) {
      setError('가격은 0보다 커야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ensure skill is saved to DB first
      try {
        await apiClient.saveSkill({
          skill_id: selectedSkill.id,
          name: selectedSkill.name,
          user_input: selectedSkill.description || selectedSkill.name,
          seed: selectedSkill.seed,
          world_tier: selectedSkill.worldTier,
          combat_budget: selectedSkill.combatBudget,
          combat_budget_max: selectedSkill.combatBudgetMax,
          vfx_budget: selectedSkill.vfxBudget,
          vfx_budget_base: selectedSkill.vfxBudgetBase,
          vfx_budget_paid: selectedSkill.vfxBudgetPaid,
          mechanics: selectedSkill.mechanics,
          vfx: selectedSkill.vfx,
          stats: selectedSkill.stats,
        });
      } catch {
        // 409 = already saved, that's fine
      }

      await apiClient.listSkill(selectedSkill.id, price, currencyType);
      alert(`${selectedSkill.name}이(가) 마켓에 등록되었습니다!`);
      router.push('/market/browse');
    } catch (err: any) {
      setError(err.message || '스킬 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedSkill, price, currencyType, router]);

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">로그인이 필요합니다</h2>
          <p className="text-[var(--text-secondary)] mb-6">스킬을 판매하려면 로그인해주세요.</p>
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
          <a href="/market/browse" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">← 마켓</a>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] bg-clip-text text-transparent">
            스킬 판매하기
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--text-secondary)]">{user.username}</span>
          <span className="text-[var(--text-secondary)]">World <span className="text-[var(--accent-lightning)] font-bold">{user.world_tier}</span></span>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Instructions */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">판매 안내</h2>
            <ul className="text-sm text-[var(--text-secondary)] space-y-2">
              <li>• 보유 중인 스킬을 마켓플레이스에 등록하여 다른 플레이어에게 판매할 수 있습니다.</li>
              <li>• 스킬이 판매되면 설정한 가격만큼 포인트 또는 룬 크리스탈을 획득합니다.</li>
              <li>• 구매자는 스킬의 복사본을 받으며, 원본은 계속 보유할 수 있습니다.</li>
              <li>• 동일한 스킬을 중복 등록할 수 없습니다.</li>
            </ul>
          </div>

          {/* Skill Selection */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">판매할 스킬 선택</h2>

            {mySkills.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <p className="mb-4">보유 중인 스킬이 없습니다.</p>
                <a href="/forge" className="text-[var(--accent-arcane)] hover:underline">
                  Forge에서 스킬을 만들어보세요 →
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mySkills.map((skill) => {
                  const elemColor = ELEM_COLORS[skill.vfx.material] || '#fff';
                  const isSelected = selectedSkill?.id === skill.id;

                  return (
                    <div
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill)}
                      className={`cursor-pointer bg-[var(--bg-secondary)] border rounded-xl overflow-hidden transition-all ${
                        isSelected ? 'border-[var(--accent-arcane)] ring-2 ring-[var(--accent-arcane)]/30' : 'border-[var(--border)] hover:border-white/20'
                      }`}
                    >
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

                        <div className="grid grid-cols-2 gap-1.5 mt-3">
                          <div className="bg-[var(--bg-primary)] rounded-md p-1.5 text-center">
                            <div className="text-[8px] text-[var(--text-secondary)]">Budget</div>
                            <div className="text-[10px] font-mono text-[var(--text-primary)]">{Math.round(skill.combatBudget)}</div>
                          </div>
                          <div className="bg-[var(--bg-primary)] rounded-md p-1.5 text-center">
                            <div className="text-[8px] text-[var(--text-secondary)]">World</div>
                            <div className="text-[10px] font-mono text-[var(--text-primary)]">Tier {skill.worldTier}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pricing */}
          {selectedSkill && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">가격 설정</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    통화 선택
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCurrencyType('points')}
                      className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                        currencyType === 'points'
                          ? 'border-[var(--accent-heal)] bg-[var(--accent-heal)]/10 text-[var(--accent-heal)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'
                      }`}
                    >
                      <div className="text-sm font-bold">Points</div>
                      <div className="text-xs mt-1">일반 게임 화폐</div>
                    </button>
                    <button
                      onClick={() => setCurrencyType('rune_crystals')}
                      className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                        currencyType === 'rune_crystals'
                          ? 'border-[var(--accent-arcane)] bg-[var(--accent-arcane)]/10 text-[var(--accent-arcane)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'
                      }`}
                    >
                      <div className="text-sm font-bold">Rune Crystals</div>
                      <div className="text-xs mt-1">프리미엄 화폐</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    가격
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-arcane)]"
                    placeholder="가격 입력"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-2">
                    추천 가격: World {selectedSkill.worldTier} 스킬은 대략 {100 * selectedSkill.worldTier}~{300 * selectedSkill.worldTier} pts
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleListSkill}
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {loading ? '등록 중...' : `${selectedSkill.name} 판매 등록하기`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
