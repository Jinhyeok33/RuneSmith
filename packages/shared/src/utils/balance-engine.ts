import type {
  SkillEffect,
  KeywordParam,
  SkillMechanics,
  SkillStats,
  LLMParserOutput,
  SkillBlueprint,
  VFXBlockInstance,
  VFXComposition,
} from '../types/skill';
import { getCombatBudgetMax, getVfxBudgetBase } from '../types/world';

// ── Effect Cost Table ──
function effectCost(effect: SkillEffect): number {
  switch (effect.type) {
    // Damage
    case 'FlatDamage':     return effect.value * 0.8;
    case 'DoT':            return effect.value * (effect.duration ?? 3000) / 1000 * 0.5;
    case 'PercentDamage':  return (effect.percent ?? 10) * 5;
    case 'Execute':        return 15;
    case 'LifeSteal':      return (effect.percent ?? 10) * 3;
    // CC
    case 'Stun':           return (effect.duration ?? 1000) / 1000 * 10;
    case 'Slow':           return (effect.duration ?? 2000) / 1000 * 5;
    case 'Root':           return (effect.duration ?? 1500) / 1000 * 7;
    case 'Silence':        return (effect.duration ?? 1500) / 1000 * 8;
    case 'Knockback':      return (effect.distance ?? 3) * 3;
    case 'Pull':           return (effect.distance ?? 3) * 4;
    case 'Fear':           return (effect.duration ?? 1500) / 1000 * 9;
    // Defensive
    case 'Shield':         return effect.value * 1.2;
    case 'Heal':           return effect.value * 1.0;
    case 'HoT':            return effect.value * (effect.duration ?? 3000) / 1000 * 0.6;
    case 'DamageReduce':   return (effect.percent ?? 20) * 4;
    // Utility
    case 'Haste':          return (effect.percent ?? 20) * 3;
    case 'Cleanse':        return 8;
    case 'Mark':           return (effect.bonus ?? 20) * 2;
    case 'Teleport':       return (effect.distance ?? 5) * 5;
    default:               return 0;
  }
}

// ── Keyword Multiplier Table ──
function keywordMultiplier(kw: KeywordParam): number {
  const n = kw.n ?? 1;
  switch (kw.keyword) {
    case 'Pierce':       return 1.30;
    case 'Chain':        return 1 + 0.15 * n;
    case 'Homing':       return 1.40;
    case 'Explosive':    return 1.25;
    case 'Ricochet':     return 1.20;
    case 'Split':        return 1 + 0.2 * n;
    case 'Delayed':      return 0.85;
    case 'Channeled':    return 0.80;
    case 'Chargeable':   return 0.90;
    case 'Consume':      return 0.75;
    case 'Crit_Boost':   return 1.15;
    case 'Multi_Hit':    return 1 + 0.1 * n;
    case 'Lingering':    return 1.20;
    case 'Conversion':   return 1.10;
    default:             return 1.0;
  }
}

// ── Calculate Raw Combat Budget ──
export function calculateCombatBudget(mechanics: SkillMechanics): number {
  let base = 0;
  for (const effect of mechanics.effects) {
    base += effectCost(effect);
  }

  let multiplier = 1.0;
  for (const kw of mechanics.keywords) {
    multiplier *= keywordMultiplier(kw);
  }

  return base * multiplier;
}

// ── Auto-adjust Stats to Fit Budget ──
function adjustStats(rawBudget: number, targetBudget: number): SkillStats {
  const ratio = rawBudget / targetBudget;

  // 예산 범위 내 (±5%): 기본 스탯
  if (ratio >= 0.95 && ratio <= 1.05) {
    return { cooldown: 5, manaCost: 40, castTime: 0.5, range: 10, risk: 0 };
  }

  // 예산 초과: cooldown/mana/castTime 증가로 밸런스
  const cooldown = lerp(3, 30, clamp01((ratio - 1) / 3));
  const manaCost = lerp(20, 100, clamp01((ratio - 1) / 3));
  const castTime = lerp(0.5, 3, clamp01((ratio - 1) / 4));
  const risk = ratio > 2.5 ? clamp01((ratio - 2.5) / 2) : 0;

  return {
    cooldown: Math.round(cooldown * 10) / 10,
    manaCost: Math.round(manaCost),
    castTime: Math.round(castTime * 10) / 10,
    range: 10,
    risk: Math.round(risk * 100) / 100,
  };
}

// ── VFX Budget → Block/Particle Limits ──
export interface VFXLimits {
  maxBlocks: number;
  maxParticles: number;
  shaderTier: 'basic' | 'standard' | 'advanced' | 'premium' | 'legendary';
  trailLength: 'short' | 'medium' | 'long' | 'very_long' | 'extreme';
  postProcessing: string[];
}

export function getVfxLimits(vfxBudget: number): VFXLimits {
  if (vfxBudget >= 500) {
    return { maxBlocks: 6, maxParticles: 5000, shaderTier: 'legendary', trailLength: 'extreme', postProcessing: ['Bloom', 'Distortion', 'ChromAb', 'RadialBlur'] };
  }
  if (vfxBudget >= 350) {
    return { maxBlocks: 5, maxParticles: 2500, shaderTier: 'premium', trailLength: 'very_long', postProcessing: ['Bloom', 'Distortion', 'ChromAb'] };
  }
  if (vfxBudget >= 200) {
    return { maxBlocks: 4, maxParticles: 1200, shaderTier: 'advanced', trailLength: 'long', postProcessing: ['Bloom', 'Distortion'] };
  }
  if (vfxBudget >= 100) {
    return { maxBlocks: 3, maxParticles: 500, shaderTier: 'standard', trailLength: 'medium', postProcessing: ['Bloom'] };
  }
  return { maxBlocks: 2, maxParticles: 200, shaderTier: 'basic', trailLength: 'short', postProcessing: [] };
}

// ── VFX Block Cost Table ──
const VFX_BLOCK_COSTS: Record<string, number> = {
  CoreMesh: 10, TrailRibbon: 15, Particles: 15, ImpactDecal: 8,
  RuneCircle: 12, Beam: 15, LightningArc: 20, AoEField: 12,
  DistortionShell: 25, VolumetricShape: 35, ShieldDome: 18, OrbitalSatellites: 15,
  ShockwaveRing: 10, ChainLink: 20, AfterimageGhost: 12, ScreenFlash: 5,
};

export function calculateVfxBudgetUsed(blocks: VFXBlockInstance[]): number {
  let total = 0;
  for (const block of blocks) {
    total += VFX_BLOCK_COSTS[block.type] ?? 10;
  }
  return total;
}

// ── Main: Compile LLM Output → Full Blueprint ──
export function compileBlueprint(
  llmOutput: LLMParserOutput,
  worldTier: number,
  extraVfxBudget: number = 0,
  creatorId: string = 'anonymous',
): SkillBlueprint {
  const combatBudgetMax = getCombatBudgetMax(worldTier);
  const vfxBudgetBase = getVfxBudgetBase(worldTier);
  const totalVfxBudget = vfxBudgetBase + extraVfxBudget;

  // Step 1: Calculate raw combat budget
  const rawCombatBudget = calculateCombatBudget(llmOutput.mechanics);

  // Step 2: Auto-adjust stats to fit within world budget
  const stats = adjustStats(rawCombatBudget, combatBudgetMax);

  // Step 3: Determine VFX limits based on budget
  const vfxLimits = getVfxLimits(totalVfxBudget);

  // Step 4: Auto-generate VFX blocks based on delivery + limits
  const blocks = autoGenerateBlocks(llmOutput, vfxLimits);

  // Step 5: Build audio params from material
  const audio = materialToAudio(llmOutput.vfx.material);

  const vfx: VFXComposition = {
    ...llmOutput.vfx,
    blocks,
    audio,
  };

  return {
    id: generateId(),
    name: llmOutput.intent.name,
    description: llmOutput.intent.description,
    seed: llmOutput.seed,
    worldTier,
    combatBudget: Math.min(rawCombatBudget, combatBudgetMax),
    combatBudgetMax,
    vfxBudget: totalVfxBudget,
    vfxBudgetBase,
    vfxBudgetPaid: extraVfxBudget,
    mechanics: llmOutput.mechanics,
    vfx,
    stats,
    createdAt: new Date().toISOString(),
    creatorId,
    tags: llmOutput.intent.tags,
  };
}

// ── Helpers ──
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function generateId(): string {
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function autoGenerateBlocks(
  llm: LLMParserOutput,
  limits: VFXLimits,
): VFXBlockInstance[] {
  const blocks: VFXBlockInstance[] = [];
  const delivery = llm.mechanics.delivery;

  // Always add core mesh
  blocks.push({ type: 'CoreMesh', params: { geometry: llm.vfx.geometry }, timing: { start: 0, duration: 1500 } });

  // Add particles
  if (limits.maxBlocks >= 2) {
    blocks.push({ type: 'Particles', params: { count: Math.min(limits.maxParticles, 500) }, timing: { start: 0, duration: 2000 } });
  }

  // Delivery-specific blocks
  if (limits.maxBlocks >= 3) {
    if (delivery === 'Projectile' || delivery === 'Bolt') {
      blocks.push({ type: 'TrailRibbon', params: {}, timing: { start: 0, duration: 1500 } });
    } else if (delivery === 'Beam') {
      blocks.push({ type: 'Beam', params: {}, timing: { start: 0, duration: 2000 } });
    } else if (delivery.startsWith('AoE')) {
      blocks.push({ type: 'AoEField', params: {}, timing: { start: 200, duration: 1500 } });
    } else if (delivery === 'Buff' || delivery === 'Totem') {
      blocks.push({ type: 'RuneCircle', params: {}, timing: { start: 0, duration: 2500 } });
    } else if (delivery === 'Trap') {
      blocks.push({ type: 'RuneCircle', params: {}, timing: { start: 0, duration: 500 } });
    } else {
      blocks.push({ type: 'ShockwaveRing', params: {}, timing: { start: 100, duration: 800 } });
    }
  }

  // Material-specific extras
  if (limits.maxBlocks >= 4) {
    if (llm.vfx.material === 'Lightning') {
      blocks.push({ type: 'LightningArc', params: {}, timing: { start: 100, duration: 600 } });
    } else if (llm.vfx.material === 'Void' || llm.vfx.material === 'Arcane') {
      blocks.push({ type: 'DistortionShell', params: {}, timing: { start: 0, duration: 1200 } });
    } else {
      blocks.push({ type: 'ImpactDecal', params: {}, timing: { start: 500, duration: 2000 } });
    }
  }

  // Premium extras
  if (limits.maxBlocks >= 5) {
    blocks.push({ type: 'ScreenFlash', params: {}, timing: { start: 0, duration: 200 } });
  }
  if (limits.maxBlocks >= 6) {
    blocks.push({ type: 'AfterimageGhost', params: {}, timing: { start: 0, duration: 1000 } });
  }

  return blocks.slice(0, limits.maxBlocks);
}

function materialToAudio(material: string): VFXComposition['audio'] {
  const presets: Record<string, VFXComposition['audio']> = {
    Fire:      { attack: 0.3,  sustain: 0.6, decay: 0.8, filterFreq: 400,  noiseType: 'white' },
    Ice:       { attack: 0.05, sustain: 0.2, decay: 0.5, filterFreq: 3000, noiseType: 'crackle' },
    Lightning: { attack: 0.01, sustain: 0.1, decay: 0.3, filterFreq: 120,  noiseType: 'white' },
    Void:      { attack: 0.5,  sustain: 0.9, decay: 1.0, filterFreq: 80,   noiseType: 'pink' },
    Nature:    { attack: 0.2,  sustain: 0.7, decay: 0.6, filterFreq: 600,  noiseType: 'pink' },
    Arcane:    { attack: 0.15, sustain: 0.5, decay: 0.7, filterFreq: 1200, noiseType: 'pink' },
    Water:     { attack: 0.1,  sustain: 0.6, decay: 0.7, filterFreq: 800,  noiseType: 'white' },
    Earth:     { attack: 0.4,  sustain: 0.3, decay: 0.9, filterFreq: 200,  noiseType: 'white' },
    Wind:      { attack: 0.05, sustain: 0.8, decay: 0.4, filterFreq: 2000, noiseType: 'pink' },
    Holy:      { attack: 0.1,  sustain: 0.7, decay: 0.5, filterFreq: 1500, noiseType: 'pink' },
    Shadow:    { attack: 0.6,  sustain: 0.8, decay: 1.0, filterFreq: 100,  noiseType: 'pink' },
    Blood:     { attack: 0.3,  sustain: 0.4, decay: 0.6, filterFreq: 300,  noiseType: 'crackle' },
    Metal:     { attack: 0.02, sustain: 0.15, decay: 0.8, filterFreq: 2500, noiseType: 'white' },
    Crystal:   { attack: 0.05, sustain: 0.3, decay: 0.6, filterFreq: 3500, noiseType: 'crackle' },
  };
  return presets[material] ?? presets.Fire;
}
