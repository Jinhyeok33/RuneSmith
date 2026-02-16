import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SkillBlueprint } from '@runesmith/shared';

interface User {
  id: number;
  username: string;
  email: string;
  world_tier: number;
  player_level: number;
  points: number;
  rune_crystals: number;
}

interface GameState {
  // Authentication
  user: User | null;
  isAuthenticated: boolean;

  // Player
  worldTier: number;
  runeCrystals: number;
  points: number;

  // Inventory
  skills: SkillBlueprint[];
  deck: string[]; // skill ids (max 5)

  // Forge
  lastCompiledSkill: SkillBlueprint | null;

  // Auth Actions
  setUser: (user: User | null) => void;
  logout: () => void;
  syncFromUser: (user: User) => void;

  // Actions
  setWorldTier: (tier: number) => void;
  addSkill: (skill: SkillBlueprint) => void;
  removeSkill: (id: string) => void;
  setDeck: (ids: string[]) => void;
  setLastCompiledSkill: (skill: SkillBlueprint | null) => void;
  addRuneCrystals: (amount: number) => void;
  spendRuneCrystals: (amount: number) => boolean;
  addPoints: (amount: number) => void;
  spendPoints: (amount: number) => boolean;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      worldTier: 1,
      runeCrystals: 100,
      points: 500,
      skills: [],
      deck: [],
      lastCompiledSkill: null,

      setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        worldTier: user?.world_tier ?? 1,
        points: user?.points ?? 500,
        runeCrystals: user?.rune_crystals ?? 100,
      }),

      logout: () => set({
        user: null,
        isAuthenticated: false,
        skills: [],
        deck: [],
      }),

      syncFromUser: (user) => set({
        user,
        worldTier: user.world_tier,
        points: user.points,
        runeCrystals: user.rune_crystals,
      }),

      setWorldTier: (tier) => set({ worldTier: tier }),

  addSkill: (skill) =>
    set((state) => ({ skills: [...state.skills, skill] })),

  removeSkill: (id) =>
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
      deck: state.deck.filter((d) => d !== id),
    })),

  setDeck: (ids) => set({ deck: ids.slice(0, 5) }),

  setLastCompiledSkill: (skill) => set({ lastCompiledSkill: skill }),

  addRuneCrystals: (amount) =>
    set((state) => ({ runeCrystals: state.runeCrystals + amount })),

  spendRuneCrystals: (amount) => {
    const { runeCrystals } = get();
    if (runeCrystals < amount) return false;
    set({ runeCrystals: runeCrystals - amount });
    return true;
  },

  addPoints: (amount) =>
    set((state) => ({ points: state.points + amount })),

  spendPoints: (amount) => {
    const { points } = get();
    if (points < amount) return false;
    set({ points: points - amount });
    return true;
  },
    }),
    {
      name: 'runesmith-game-storage',
    }
  )
);
