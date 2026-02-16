import type {
  Enemy,
  EnemyPattern,
  PlayerState,
  WaveConfig,
  StageConfig,
  CombatState,
  CombatResult,
  CombatEvent,
} from '@runesmith/shared';
import type { SkillBlueprint, MaterialElement } from '@runesmith/shared';
import {
  getAffinityMultiplier,
  getVfxDegradation,
  calculateCombatBudget,
} from '@runesmith/shared';

// ── Enemy Presets ──
const ELEMENT_POOL: MaterialElement[] = ['Fire', 'Ice', 'Lightning', 'Water', 'Nature', 'Earth', 'Wind'];

function randomElement(): MaterialElement {
  return ELEMENT_POOL[Math.floor(Math.random() * ELEMENT_POOL.length)];
}

function randomWeakness(element: MaterialElement): MaterialElement[] {
  const others = ELEMENT_POOL.filter((e) => e !== element);
  const count = 1 + Math.floor(Math.random() * 2); // 1~2
  const shuffled = others.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateEnemy(
  worldTier: number,
  stageNum: number,
  type: 'mob' | 'elite' | 'boss',
  index: number,
): Enemy {
  const baseHp = 80 * Math.pow(1.4, worldTier - 1);
  const element = randomElement();
  const names: Record<string, string[]> = {
    mob: ['슬라임', '고블린', '스켈레톤', '박쥐', '임프', '좀비'],
    elite: ['다크 나이트', '플레임 골렘', '프로스트 위치'],
    boss: ['심연의 드래곤', '불꽃 군주', '얼음 폭군', '뇌신', '대지의 거인'],
  };

  const namePool = names[type];
  const name = namePool[Math.floor(Math.random() * namePool.length)];

  const hpMult = type === 'boss' ? 5 : type === 'elite' ? 2.5 : 1;
  const hp = Math.round(baseHp * hpMult * (1 + stageNum * 0.1));

  const patternCount = type === 'boss' ? 5 : type === 'elite' ? 3 : 2;
  const patterns: EnemyPattern[] = [];

  // Pattern library
  const attackTypes: Array<{ type: import('@runesmith/shared').AttackType; name: string; dmgMult: number }> = [
    { type: 'single', name: '일격', dmgMult: 1.0 },
    { type: 'aoe', name: '광역 공격', dmgMult: 0.7 },
    { type: 'beam', name: '관통 빔', dmgMult: 0.9 },
    { type: 'charge', name: '돌진', dmgMult: 1.2 },
    { type: 'multi_hit', name: '연타', dmgMult: 0.5 },
  ];

  for (let i = 0; i < patternCount; i++) {
    const baseDmg = 30 * Math.pow(1.3, worldTier - 1);
    const attackPattern = attackTypes[Math.floor(Math.random() * attackTypes.length)];
    const hitCount = attackPattern.type === 'multi_hit' ? 2 + Math.floor(Math.random() * 2) : undefined;

    patterns.push({
      name: attackPattern.name,
      damage: Math.round(baseDmg * attackPattern.dmgMult * (0.8 + Math.random() * 0.4)),
      element,
      telegraph: type === 'boss' ? 600 : 800,
      dodgeable: true,
      attackType: attackPattern.type,
      hitCount,
    });
  }

  return {
    id: `enemy_${type}_${index}`,
    name,
    hp,
    maxHp: hp,
    defense: Math.round(5 * worldTier),
    element,
    weakness: randomWeakness(element),
    resistance: Math.random() > 0.5 ? [randomElement()] : [],
    patterns,
    isBoss: type === 'boss',
    isElite: type === 'elite',
  };
}

export function generateStage(worldTier: number, stageNum: number): StageConfig {
  const isBossStage = stageNum === 5;

  const waves: WaveConfig[] = [];

  if (isBossStage) {
    // Boss stage: 1 wave with boss
    waves.push({
      waveNumber: 1,
      enemies: [generateEnemy(worldTier, stageNum, 'boss', 0)],
      isBossWave: true,
    });
  } else {
    // Wave 1: 2~3 mobs
    const mobCount = 2 + Math.floor(Math.random() * 2);
    waves.push({
      waveNumber: 1,
      enemies: Array.from({ length: mobCount }, (_, i) => generateEnemy(worldTier, stageNum, 'mob', i)),
      isBossWave: false,
    });

    // Wave 2: 1~2 elites
    const eliteCount = 1 + Math.floor(Math.random() * 2);
    waves.push({
      waveNumber: 2,
      enemies: Array.from({ length: eliteCount }, (_, i) => generateEnemy(worldTier, stageNum, 'elite', i)),
      isBossWave: false,
    });

    // Wave 3: 1 mini-boss
    waves.push({
      waveNumber: 3,
      enemies: [generateEnemy(worldTier, stageNum, 'elite', 0)],
      isBossWave: false,
    });
  }

  return {
    worldId: worldTier,
    stageNumber: stageNum,
    waves,
    isBossStage,
  };
}

// ── Damage Calculation ──
export function calculateSkillDamage(
  skill: SkillBlueprint,
  target: Enemy,
  currentWorld: number,
): { damage: number; affinity: number; degradation: number; isCrit: boolean } {
  // Base damage from combat budget
  let baseDmg = skill.combatBudget * 0.8;

  // Affinity multiplier
  const affinity = getAffinityMultiplier(skill.vfx.material, target.element, currentWorld);

  // VFX degradation
  const degradation = getVfxDegradation(skill.worldTier, currentWorld, skill.vfxBudget);

  // Critical hit (15% chance, 1.5x)
  const isCrit = Math.random() < 0.15;
  const critMult = isCrit ? 1.5 : 1.0;

  // Defense reduction
  const defReduction = Math.max(0.3, 1 - target.defense / 200);

  const damage = Math.round(baseDmg * affinity * degradation * critMult * defReduction);

  return { damage, affinity, degradation, isCrit };
}

// ── Heal Calculation ──
export function calculateHealAmount(skill: SkillBlueprint): number {
  const healEffects = skill.mechanics.effects.filter(
    (e) => e.type === 'Heal' || e.type === 'HoT' || e.type === 'Shield',
  );

  if (healEffects.length === 0) return 0;

  let total = 0;
  for (const effect of healEffects) {
    total += effect.value;
  }
  return Math.round(total);
}

// ── Check if skill is offensive ──
export function isOffensiveSkill(skill: SkillBlueprint): boolean {
  return skill.mechanics.effects.some(
    (e) =>
      e.type === 'FlatDamage' ||
      e.type === 'DoT' ||
      e.type === 'PercentDamage' ||
      e.type === 'Execute' ||
      e.type === 'LifeSteal',
  );
}

// ── Default player state ──
export function createPlayerState(worldTier: number, deck: SkillBlueprint[]): PlayerState {
  const baseHp = 400 + worldTier * 100;
  const baseMp = 300 + worldTier * 50;

  return {
    hp: baseHp,
    maxHp: baseHp,
    mp: baseMp,
    maxMp: baseMp,
    level: worldTier * 10,
    xp: 0,
    xpToNext: 100 * worldTier,
    currentWorld: worldTier,
    currentStage: 1,
    deck,
    cooldowns: {},
  };
}

// ── Element color mapping ──
export const ELEMENT_COLORS: Record<string, string> = {
  Fire: '#f97316',
  Ice: '#38bdf8',
  Lightning: '#facc15',
  Water: '#0ea5e9',
  Nature: '#22c55e',
  Earth: '#d97706',
  Wind: '#94a3b8',
  Void: '#a855f7',
  Arcane: '#c084fc',
  Holy: '#fef08a',
  Shadow: '#404040',
  Blood: '#dc2626',
  Metal: '#d4d4d8',
  Crystal: '#e879f9',
};
