// ── Delivery (투사 방식) 16종 ──
export type DeliveryType =
  // Single Target
  | 'Projectile' | 'Bolt' | 'Beam' | 'Strike'
  // Area
  | 'AoE_Circle' | 'AoE_Cone' | 'AoE_Line' | 'AoE_Ring' | 'AoE_Nova'
  // Persistent
  | 'Zone' | 'Wall' | 'Trap'
  // Summon
  | 'Minion' | 'Turret' | 'Totem'
  // Self
  | 'Buff';

// ── Effect Types 20종 ──
export type EffectType =
  // Damage
  | 'FlatDamage' | 'DoT' | 'PercentDamage' | 'Execute' | 'LifeSteal'
  // CC
  | 'Stun' | 'Slow' | 'Root' | 'Silence' | 'Knockback' | 'Pull' | 'Fear'
  // Defensive
  | 'Shield' | 'Heal' | 'HoT' | 'DamageReduce'
  // Utility
  | 'Haste' | 'Cleanse' | 'Mark' | 'Teleport';

export interface SkillEffect {
  type: EffectType;
  value: number;
  duration?: number;   // ms (DoT, CC, HoT 등)
  percent?: number;    // PercentDamage, DamageReduce 등
  distance?: number;   // Knockback, Pull, Teleport
  bonus?: number;      // Mark bonus
}

// ── Keywords (키워드 수식어) 14종 ──
export type Keyword =
  | 'Pierce' | 'Chain' | 'Homing' | 'Explosive'
  | 'Ricochet' | 'Split' | 'Delayed' | 'Channeled'
  | 'Chargeable' | 'Consume' | 'Crit_Boost'
  | 'Multi_Hit' | 'Lingering' | 'Conversion';

export interface KeywordParam {
  keyword: Keyword;
  n?: number;  // Chain N체, Split N개, Multi_Hit N회
}

// ── Mechanics ──
export interface SkillMechanics {
  delivery: DeliveryType;
  effects: SkillEffect[];
  keywords: KeywordParam[];
}

// ── VFX Building Blocks 16종 ──
export type VFXBlockType =
  | 'CoreMesh' | 'TrailRibbon' | 'Particles' | 'ImpactDecal'
  | 'RuneCircle' | 'Beam' | 'LightningArc' | 'AoEField'
  | 'DistortionShell' | 'VolumetricShape' | 'ShieldDome' | 'OrbitalSatellites'
  | 'ShockwaveRing' | 'ChainLink' | 'AfterimageGhost' | 'ScreenFlash';

// ── Geometry 20종 ──
export type GeometryShape =
  // 날카로운
  | 'Spear' | 'Blade' | 'Needle' | 'Arrow' | 'Shard'
  // 둥근
  | 'Sphere' | 'Orb' | 'Bubble' | 'Meteor'
  // 평면
  | 'Ring' | 'Disc' | 'Sigil' | 'Wave'
  // 선형
  | 'Beam_Geo' | 'Whip' | 'Chain_Geo' | 'Arc'
  // 복합
  | 'Swarm' | 'Vortex' | 'Fractal';

// ── Motion 16종 ──
export type MotionType =
  // 직선
  | 'Straight' | 'Accelerate' | 'Decelerate'
  // 곡선
  | 'Spiral' | 'Wave_Sine' | 'Boomerang' | 'Orbit'
  // 추적
  | 'Homing_Direct' | 'Homing_Lazy' | 'Homing_Swarm'
  // 확산
  | 'Expand_Sphere' | 'Expand_Ring' | 'Scatter'
  // 특수
  | 'Teleport_Blink' | 'Pendulum' | 'Float_Rise';

// ── Material (원소/재질) 14종 ──
export type MaterialElement =
  | 'Fire' | 'Ice' | 'Lightning' | 'Void'
  | 'Nature' | 'Arcane' | 'Water' | 'Earth'
  | 'Wind' | 'Holy' | 'Shadow' | 'Blood'
  | 'Metal' | 'Crystal';

// ── Rhythm 10종 ──
export type RhythmPattern =
  | 'Burst' | 'Sustained' | 'Pulsing'
  | 'Ramp_Up' | 'Ramp_Down' | 'Staccato'
  | 'Delayed' | 'Cascade' | 'Heartbeat' | 'Chaotic';

// ── VFX Block Instance ──
export interface VFXBlockInstance {
  type: VFXBlockType;
  params: Record<string, unknown>;
  timing: {
    start: number;    // ms
    duration: number; // ms
  };
}

// ── VFX Composition ──
export interface VFXComposition {
  geometry: GeometryShape;
  motion: MotionType;
  material: MaterialElement;
  rhythm: RhythmPattern;
  palette: {
    primary: string;   // hex
    secondary: string; // hex
  };
  intensity: number;  // 0~1
  blocks: VFXBlockInstance[];
  audio: {
    attack: number;     // 0~1
    sustain: number;    // 0~1
    decay: number;      // 0~1
    filterFreq: number; // Hz
    noiseType: 'white' | 'pink' | 'crackle';
  };
}

// ── Skill Stats (Balance Engine 출력) ──
export interface SkillStats {
  cooldown: number;    // 초
  manaCost: number;
  castTime: number;    // 초
  range: number;
  risk: number;        // 0~1 실패 확률
}

// ── Skill Blueprint (최종 스킬 설계도) ──
export interface SkillBlueprint {
  id: string;
  name: string;
  description: string;
  seed: number;

  // World & Budget
  worldTier: number;
  combatBudget: number;
  combatBudgetMax: number;
  vfxBudget: number;
  vfxBudgetBase: number;
  vfxBudgetPaid: number;

  // Core
  mechanics: SkillMechanics;
  vfx: VFXComposition;
  stats: SkillStats;

  // Meta
  createdAt: string;   // ISO date
  creatorId: string;
  tags: string[];
}

// ── LLM Parser Output (Step 1 결과) ──
export interface LLMParserOutput {
  intent: {
    name: string;
    description: string;
    tags: string[];
  };
  mechanics: SkillMechanics;
  vfx: Omit<VFXComposition, 'blocks' | 'audio'>;
  seed: number;
}
