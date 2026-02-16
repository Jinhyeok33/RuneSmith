import type { SkillBlueprint } from '@runesmith/shared';
import { compileBlueprint, type LLMParserOutput } from '@runesmith/shared';

// Preset LLM outputs for demo skills
const presetOutputs: LLMParserOutput[] = [
  {
    intent: { name: '화염구', description: '불타는 화염구를 적에게 발사합니다', tags: ['fire', 'projectile', 'damage'] },
    mechanics: {
      delivery: 'Projectile',
      effects: [{ type: 'FlatDamage', value: 60 }],
      keywords: [],
    },
    vfx: {
      geometry: 'Sphere',
      motion: 'Straight',
      material: 'Fire',
      rhythm: 'Burst',
      palette: { primary: '#f97316', secondary: '#fbbf24' },
      intensity: 0.7,
    },
    seed: 1001,
  },
  {
    intent: { name: '빙창', description: '날카로운 얼음 창을 투척합니다', tags: ['ice', 'projectile', 'damage'] },
    mechanics: {
      delivery: 'Projectile',
      effects: [
        { type: 'FlatDamage', value: 50 },
        { type: 'Slow', value: 0, duration: 2000 },
      ],
      keywords: [{ keyword: 'Pierce' }],
    },
    vfx: {
      geometry: 'Spear',
      motion: 'Accelerate',
      material: 'Ice',
      rhythm: 'Burst',
      palette: { primary: '#38bdf8', secondary: '#e0f2fe' },
      intensity: 0.6,
    },
    seed: 1002,
  },
  {
    intent: { name: '낙뢰', description: '하늘에서 강력한 번개를 내리칩니다', tags: ['lightning', 'strike', 'damage'] },
    mechanics: {
      delivery: 'Strike',
      effects: [
        { type: 'FlatDamage', value: 80 },
        { type: 'Stun', value: 0, duration: 1000 },
      ],
      keywords: [],
    },
    vfx: {
      geometry: 'Arc',
      motion: 'Straight',
      material: 'Lightning',
      rhythm: 'Burst',
      palette: { primary: '#facc15', secondary: '#ffffff' },
      intensity: 0.9,
    },
    seed: 1003,
  },
  {
    intent: { name: '치유진', description: '마법진으로 생명력을 회복합니다', tags: ['heal', 'nature', 'support'] },
    mechanics: {
      delivery: 'Buff',
      effects: [{ type: 'Heal', value: 80 }],
      keywords: [],
    },
    vfx: {
      geometry: 'Ring',
      motion: 'Float_Rise',
      material: 'Nature',
      rhythm: 'Sustained',
      palette: { primary: '#34d399', secondary: '#86efac' },
      intensity: 0.5,
    },
    seed: 1004,
  },
];

export function getPresetDeck(worldTier: number = 1): SkillBlueprint[] {
  return presetOutputs.map((output) => compileBlueprint(output, worldTier, 0, 'preset'));
}
