import type { SkillBlueprint, MaterialElement } from './skill';

// ── Enemy ──
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  defense: number;
  element: MaterialElement;
  weakness: MaterialElement[];   // 약점 원소 (1~2개)
  resistance: MaterialElement[]; // 저항 원소 (0~1개)
  patterns: EnemyPattern[];
  isBoss: boolean;
  isElite: boolean;
}

export interface EnemyPattern {
  name: string;
  damage: number;
  element: MaterialElement;
  telegraph: number;  // ms (텔레그래프 표시 시간)
  dodgeable: boolean;
}

// ── Player ──
export interface PlayerState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  xpToNext: number;
  currentWorld: number;
  currentStage: number;
  deck: SkillBlueprint[];
  cooldowns: Record<string, number>; // skillId → remaining turns
}

// ── Wave ──
export interface WaveConfig {
  waveNumber: number;  // 1, 2, 3
  enemies: Enemy[];
  isBossWave: boolean;
}

// ── Stage ──
export interface StageConfig {
  worldId: number;
  stageNumber: number; // 1~5
  waves: WaveConfig[];
  isBossStage: boolean; // x-5 스테이지
}

// ── Combat Event ──
export type CombatEventType =
  | 'skill_use'
  | 'damage_dealt'
  | 'damage_taken'
  | 'heal'
  | 'dodge'
  | 'enemy_attack'
  | 'enemy_defeat'
  | 'wave_clear'
  | 'victory'
  | 'defeat';

export interface CombatEvent {
  type: CombatEventType;
  turn: number;
  timestamp: number;
  skillId?: string;
  damage?: number;
  element?: MaterialElement;
  affinityMultiplier?: number;
  degradationMultiplier?: number;
  targetId?: string;
}

// ── Combat State ──
export interface CombatState {
  stage: StageConfig;
  player: PlayerState;
  currentWave: number;
  currentTurn: number;
  enemies: Enemy[];
  events: CombatEvent[];
  status: 'preparing' | 'player_turn' | 'enemy_turn' | 'dodging' | 'wave_clear' | 'victory' | 'defeat';
}

// ── Combat Result ──
export interface CombatResult {
  victory: boolean;
  totalDamageDealt: number;
  totalDamageTaken: number;
  turnsPlayed: number;
  dodgesSuccessful: number;
  durationMs: number;
  xpEarned: number;
  pointsEarned: number;
}
