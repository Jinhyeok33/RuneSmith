'use client';

import { useState, useCallback } from 'react';
import { compileBlueprint } from '@runesmith/shared';
import type { SkillBlueprint, LLMParserOutput } from '@runesmith/shared';
import { compileSkill } from '@/lib/api/compile';
import { apiClient } from '@/lib/api/client';
import { useGameStore } from '@/lib/store/game-store';
import PreviewCanvas from '@/components/three/preview-canvas';

// Preset examples for quick demo
const PRESETS: { label: string; input: string }[] = [
  { label: '🔥 불타는 창', input: '적을 관통하는 불타는 창을 던진다' },
  { label: '⚡ 체인 라이트닝', input: '3체의 적에게 연쇄하는 전기 화살' },
  { label: '🧊 얼음 노바', input: '주변 모든 적을 얼리는 차가운 폭발' },
  { label: '💜 공허 빔', input: '공허의 에너지를 집중한 레이저 빔' },
  { label: '💚 회복 토템', input: '아군을 치유하는 자연의 토템을 소환' },
  { label: '🗡️ 그림자 타격', input: '적의 등 뒤에 나타나 암흑 데미지를 준다' },
];

type ForgePhase = 'input' | 'compiling' | 'preview' | 'error';

export default function ForgePage() {
  const [phase, setPhase] = useState<ForgePhase>('input');
  const [userInput, setUserInput] = useState('');
  const [extraVfx, setExtraVfx] = useState(0);
  const [compiledSkill, setCompiledSkill] = useState<SkillBlueprint | null>(null);
  const [error, setError] = useState('');
  const [compileProgress, setCompileProgress] = useState('');

  const worldTier = useGameStore((s) => s.worldTier);
  const addSkill = useGameStore((s) => s.addSkill);
  const setLastCompiledSkill = useGameStore((s) => s.setLastCompiledSkill);
  const runeCrystals = useGameStore((s) => s.runeCrystals);

  const handleCompile = useCallback(async (input: string) => {
    if (!input.trim()) return;

    setPhase('compiling');
    setError('');
    setCompileProgress('LLM에게 스킬 해석 요청 중...');

    try {
      const response = await compileSkill({
        user_input: input,
        world_tier: worldTier,
        extra_vfx_budget: extraVfx,
      });

      if (!response.success || !response.blueprint) {
        throw new Error(response.error || 'Compile failed');
      }

      setCompileProgress('밸런스 엔진 적용 중...');

      const llmOutput = response.blueprint.llm_output as unknown as LLMParserOutput;
      const blueprint = compileBlueprint(
        llmOutput,
        response.blueprint.world_tier,
        response.blueprint.extra_vfx_budget,
      );

      setCompiledSkill(blueprint);
      setLastCompiledSkill(blueprint);
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  }, [worldTier, extraVfx, setLastCompiledSkill]);

  const isAuthenticated = useGameStore((s) => s.isAuthenticated);

  const handleSave = useCallback(async () => {
    if (!compiledSkill) return;

    // Save to Zustand (local)
    addSkill(compiledSkill);

    // Also save to DB if authenticated (so it can be sold on market)
    if (isAuthenticated) {
      try {
        await apiClient.saveSkill({
          skill_id: compiledSkill.id,
          name: compiledSkill.name,
          user_input: userInput || compiledSkill.description || compiledSkill.name,
          seed: compiledSkill.seed,
          world_tier: compiledSkill.worldTier,
          combat_budget: compiledSkill.combatBudget,
          combat_budget_max: compiledSkill.combatBudgetMax,
          vfx_budget: compiledSkill.vfxBudget,
          vfx_budget_base: compiledSkill.vfxBudgetBase,
          vfx_budget_paid: compiledSkill.vfxBudgetPaid,
          mechanics: compiledSkill.mechanics,
          vfx: compiledSkill.vfx,
          stats: compiledSkill.stats,
        });
      } catch {
        console.warn('Failed to save skill to server, saved locally only');
      }
    }

    setPhase('input');
    setCompiledSkill(null);
    setUserInput('');
  }, [compiledSkill, addSkill, isAuthenticated, userInput]);

  const handleReset = useCallback(() => {
    setPhase('input');
    setCompiledSkill(null);
    setError('');
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            ← 홈
          </a>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-void)] bg-clip-text text-transparent">
            Forge — 스킬 제작소
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--text-secondary)]">
            World <span className="text-[var(--accent-lightning)] font-bold">{worldTier}</span>
          </span>
          <span className="text-[var(--text-secondary)]">
            RC <span className="text-[var(--accent-arcane)] font-bold">{runeCrystals}</span>
          </span>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left: Input Panel */}
        <div className="w-[420px] border-r border-[var(--border)] flex flex-col">
          {/* Input Area */}
          <div className="p-6 flex-1 flex flex-col gap-4">
            <label className="text-sm text-[var(--text-secondary)]">어떤 마법을 만들까요?</label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="예: 적을 관통하는 불타는 창을 던진다"
              className="w-full h-32 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 resize-none focus:outline-none focus:border-[var(--accent-arcane)] transition-colors"
              disabled={phase === 'compiling'}
            />

            {/* Presets */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-2 block">프리셋</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setUserInput(p.input);
                      handleCompile(p.input);
                    }}
                    disabled={phase === 'compiling'}
                    className="text-xs px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-arcane)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* VFX Budget Slider */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                추가 VFX Budget: <span className="text-[var(--accent-arcane)]">+{extraVfx}</span>
              </label>
              <input
                type="range"
                min={0}
                max={400}
                step={50}
                value={extraVfx}
                onChange={(e) => setExtraVfx(Number(e.target.value))}
                className="w-full accent-[var(--accent-arcane)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)]/50 mt-1">
                <span>기본</span>
                <span>전설</span>
              </div>
            </div>

            {/* Compile Button */}
            <button
              onClick={() => handleCompile(userInput)}
              disabled={phase === 'compiling' || !userInput.trim()}
              className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-40
                bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-void)]
                hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]
                active:scale-[0.98]"
            >
              {phase === 'compiling' ? compileProgress : '⚒️ 스킬 컴파일'}
            </button>

            {/* Error */}
            {phase === 'error' && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
                {error}
                <button onClick={handleReset} className="block mt-2 underline text-xs">
                  다시 시도
                </button>
              </div>
            )}
          </div>

          {/* Skill Info Panel (shown on preview) */}
          {compiledSkill && phase === 'preview' && (
            <div className="border-t border-[var(--border)] p-6 space-y-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{compiledSkill.name}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{compiledSkill.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <StatItem label="투사 방식" value={compiledSkill.mechanics.delivery} />
                <StatItem label="원소" value={compiledSkill.vfx.material} />
                <StatItem label="쿨다운" value={`${compiledSkill.stats.cooldown}s`} />
                <StatItem label="마나" value={`${compiledSkill.stats.manaCost}`} />
                <StatItem label="시전 시간" value={`${compiledSkill.stats.castTime}s`} />
                <StatItem label="사거리" value={`${compiledSkill.stats.range}m`} />
              </div>

              {/* Budget Bars */}
              <div className="space-y-2">
                <BudgetBar
                  label="Combat Budget"
                  used={compiledSkill.combatBudget}
                  max={compiledSkill.combatBudgetMax}
                  color="var(--accent-fire)"
                />
                <BudgetBar
                  label="VFX Budget"
                  used={compiledSkill.vfxBudget}
                  max={500}
                  color="var(--accent-arcane)"
                />
              </div>

              {/* Effects */}
              {compiledSkill.mechanics.effects.length > 0 && (
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">효과</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {compiledSkill.mechanics.effects.map((e, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-fire)]/10 border border-[var(--accent-fire)]/30 text-[var(--accent-fire)]"
                      >
                        {e.type} {e.value > 0 ? e.value : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {compiledSkill.mechanics.keywords.length > 0 && (
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">키워드</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {compiledSkill.mechanics.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-arcane)]/10 border border-[var(--accent-arcane)]/30 text-[var(--accent-arcane)]"
                      >
                        {kw.keyword}{kw.n ? ` ×${kw.n}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {compiledSkill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {compiledSkill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-[var(--accent-heal)] to-emerald-600 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all"
                >
                  💾 인벤토리에 저장
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all"
                >
                  새로 만들기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Three.js Preview */}
        <div className="flex-1 relative">
          {phase === 'input' && !compiledSkill && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-30">⚒️</div>
                <p className="text-[var(--text-secondary)] text-lg">자연어로 마법을 설명하세요</p>
                <p className="text-[var(--text-secondary)]/50 text-sm mt-1">
                  또는 프리셋 버튼을 클릭해 빠르게 체험하세요
                </p>
              </div>
            </div>
          )}

          {phase === 'compiling' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-[var(--accent-arcane)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[var(--accent-arcane)]">{compileProgress}</p>
              </div>
            </div>
          )}

          {compiledSkill && phase === 'preview' && (
            <PreviewCanvas skill={compiledSkill} className="w-full h-full" />
          )}
        </div>
      </div>
    </main>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-md p-2">
      <div className="text-[10px] text-[var(--text-secondary)]">{label}</div>
      <div className="text-sm font-mono text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function BudgetBar({ label, used, max, color }: { label: string; used: number; max: number; color: string }) {
  const pct = Math.min(100, (used / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span style={{ color }}>{Math.round(used)} / {max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
