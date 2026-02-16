import type { MaterialElement } from './skill';

// ── World Configuration ──
export interface WorldConfig {
  id: number;                // 1, 2, 3...
  name: string;              // "초원", "동굴", "화산"...
  theme: string;             // 시각적 테마
  stageCount: number;        // 보통 5
  combatBudgetMax: number;   // 100 × (1.5 ^ (id-1))
  vfxBudgetBase: number;     // 100 + (id-1) × 25
  affinityScale: number;     // 상성 배율 (1.0, 1.2, 1.5, 1.8, 2.0)
}

// ── Predefined Worlds ──
export const WORLDS: WorldConfig[] = [
  { id: 1, name: '초원',  theme: 'plains',  stageCount: 5, combatBudgetMax: 100, vfxBudgetBase: 100, affinityScale: 1.0 },
  { id: 2, name: '동굴',  theme: 'cavern',  stageCount: 5, combatBudgetMax: 150, vfxBudgetBase: 125, affinityScale: 1.2 },
  { id: 3, name: '화산',  theme: 'volcano', stageCount: 5, combatBudgetMax: 225, vfxBudgetBase: 150, affinityScale: 1.5 },
  { id: 4, name: '심연',  theme: 'abyss',   stageCount: 5, combatBudgetMax: 337, vfxBudgetBase: 175, affinityScale: 1.8 },
  { id: 5, name: '천공',  theme: 'sky',     stageCount: 5, combatBudgetMax: 506, vfxBudgetBase: 200, affinityScale: 2.0 },
];

export function getWorldConfig(worldTier: number): WorldConfig {
  return WORLDS[worldTier - 1] ?? WORLDS[WORLDS.length - 1];
}

export function getCombatBudgetMax(worldTier: number): number {
  return Math.round(100 * Math.pow(1.5, worldTier - 1));
}

export function getVfxBudgetBase(worldTier: number): number {
  return 100 + (worldTier - 1) * 25;
}

// ── Elemental Affinity Matrix ──
// 7 기본 원소 상성 (1.5 = 효과적, 0.5 = 비효과적)
const BASE_ELEMENTS: MaterialElement[] = ['Fire', 'Ice', 'Lightning', 'Water', 'Nature', 'Earth', 'Wind'];

// [공격][방어] 순서: Fire, Ice, Lightning, Water, Nature, Earth, Wind
const AFFINITY_MATRIX: number[][] = [
  [1.0, 1.5, 1.0, 0.5, 1.5, 1.0, 1.0], // Fire →
  [0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5], // Ice →
  [1.0, 1.0, 1.0, 1.5, 1.0, 0.5, 1.5], // Lightning →
  [1.5, 1.0, 0.5, 1.0, 0.5, 1.5, 1.0], // Water →
  [0.5, 1.0, 1.0, 1.5, 1.0, 1.5, 0.5], // Nature →
  [1.0, 1.0, 1.5, 0.5, 0.5, 1.0, 1.0], // Earth →
  [1.0, 0.5, 0.5, 1.0, 1.5, 1.0, 1.0], // Wind →
];

export function getAffinityMultiplier(
  attackElement: MaterialElement,
  defenseElement: MaterialElement,
  worldTier: number,
): number {
  const atkIdx = BASE_ELEMENTS.indexOf(attackElement);
  const defIdx = BASE_ELEMENTS.indexOf(defenseElement);

  // 특수 원소(Void, Arcane, Holy, Shadow, Blood, Metal, Crystal)는 상성 없음
  if (atkIdx === -1 || defIdx === -1) return 1.0;

  const baseMultiplier = AFFINITY_MATRIX[atkIdx][defIdx];
  const world = getWorldConfig(worldTier);

  // 월드별 상성 스케일링: 1.0 기준에서 차이를 증폭
  const diff = baseMultiplier - 1.0;
  return 1.0 + diff * world.affinityScale;
}

// ── VFX Degradation (구형 스킬 열화) ──
export function getVfxDegradation(
  skillWorldTier: number,
  currentWorldTier: number,
  skillVfxBudget: number,
): number {
  const currentVfxBase = getVfxBudgetBase(currentWorldTier);

  // VFX Budget이 현재 월드 기본값 이상이면 열화 없음
  if (skillVfxBudget >= currentVfxBase) return 1.0;

  const worldDiff = Math.max(0, currentWorldTier - skillWorldTier);
  const degradation = 1.0 - worldDiff * 0.15;
  return Math.max(0.4, degradation); // 최소 40%
}
