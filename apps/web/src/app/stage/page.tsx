'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { SkillBlueprint } from '@runesmith/shared';
import type { Enemy } from '@runesmith/shared';
import { useGameStore } from '@/lib/store/game-store';
import {
  generateStage,
  calculateSkillDamage,
  calculateHealAmount,
  isOffensiveSkill,
  ELEMENT_COLORS,
} from '@/lib/combat/combat-engine';
import { getPresetDeck } from '@/lib/combat/preset-skills';

const PreviewCanvas = dynamic(() => import('@/components/three/preview-canvas'), { ssr: false });

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  isCrit: boolean;
  startTime: number;
}

interface LogEntry {
  text: string;
  color: string;
  id: number;
}

type BattlePhase = 'preparing' | 'player_turn' | 'animating' | 'enemy_turn' | 'wave_clear' | 'victory' | 'defeat';

// ── Monster Shape Config ──
function getMonsterShape(name: string): { borderRadius: string; runeSymbols: string } {
  if (name.includes('슬라임')) return { borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%', runeSymbols: 'ᛟ' };
  if (name.includes('고블린')) return { borderRadius: '40% 40% 45% 45% / 35% 35% 55% 55%', runeSymbols: 'ᚷ' };
  if (name.includes('스켈레톤')) return { borderRadius: '45% 45% 40% 40% / 35% 35% 50% 50%', runeSymbols: '☠' };
  if (name.includes('박쥐')) return { borderRadius: '50% 50% 30% 30% / 40% 40% 60% 60%', runeSymbols: 'ᛉ' };
  if (name.includes('임프')) return { borderRadius: '40% 40% 50% 50% / 35% 35% 65% 65%', runeSymbols: 'ᛃ' };
  if (name.includes('좀비')) return { borderRadius: '42% 42% 48% 48% / 38% 38% 52% 52%', runeSymbols: 'ᛦ' };
  if (name.includes('나이트')) return { borderRadius: '30% 30% 40% 40% / 25% 25% 55% 55%', runeSymbols: 'ᛗ' };
  if (name.includes('골렘')) return { borderRadius: '15% 15% 25% 25% / 15% 15% 35% 35%', runeSymbols: 'ᚦ ᛟ' };
  if (name.includes('위치')) return { borderRadius: '50% 50% 35% 35% / 30% 30% 70% 70%', runeSymbols: 'ᚹ' };
  if (name.includes('드래곤')) return { borderRadius: '45% 45% 55% 55% / 35% 35% 65% 65%', runeSymbols: 'ᛞ ᚱ' };
  if (name.includes('군주')) return { borderRadius: '35% 35% 40% 40% / 25% 25% 50% 50%', runeSymbols: 'ᚠ ᛗ' };
  if (name.includes('폭군')) return { borderRadius: '30% 30% 35% 35% / 25% 25% 45% 45%', runeSymbols: 'ᛁ ᛋ' };
  if (name.includes('뇌신')) return { borderRadius: '38% 38% 42% 42% / 30% 30% 55% 55%', runeSymbols: 'ᛊ ᛏ' };
  if (name.includes('거인')) return { borderRadius: '20% 20% 28% 28% / 18% 18% 40% 40%', runeSymbols: 'ᚢ ᛟ ᚦ' };
  return { borderRadius: '40% 40% 45% 45% / 35% 35% 55% 55%', runeSymbols: 'ᛟ' };
}

// ── Monster Visual Component ──
function MonsterVisual({
  enemy,
  index,
  canTarget,
  onClick,
}: {
  enemy: Enemy;
  index: number;
  canTarget: boolean;
  onClick: () => void;
}) {
  const color = ELEMENT_COLORS[enemy.element] || '#fff';
  const baseSize = enemy.isBoss ? 180 : enemy.isElite ? 140 : 100;
  const hpPct = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
  const { borderRadius, runeSymbols } = getMonsterShape(enemy.name);

  return (
    <div
      className={`flex flex-col items-center transition-all duration-200 ${canTarget ? 'cursor-pointer group' : ''}`}
      onClick={canTarget ? onClick : undefined}
    >
      {/* Monster body with float animation */}
      <div
        className="relative"
        style={{
          width: baseSize,
          height: baseSize,
          animation: `monsterFloat 3s ease-in-out ${index * 0.7}s infinite`,
        }}
      >
        {/* Aura glow */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: '-25%',
            background: `radial-gradient(circle, ${color}30, transparent 70%)`,
            filter: 'blur(18px)',
          }}
        />

        {/* Body shape */}
        <div
          className={`absolute inset-0 transition-all duration-200 ${canTarget ? 'group-hover:scale-110 group-hover:brightness-125' : ''}`}
          style={{
            borderRadius,
            background: `radial-gradient(ellipse at 50% 35%, ${color}18, #0c0520 60%, #030108)`,
            border: `1.5px solid ${color}35`,
            boxShadow: `0 0 30px ${color}15, inset 0 0 40px ${color}08, 0 10px 40px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Eyes */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center"
            style={{ top: '28%', gap: baseSize * 0.18 }}
          >
            {[0, 0.3].map((delay, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: baseSize * 0.1,
                  height: baseSize * 0.07,
                  background: `radial-gradient(circle, #fff, ${color})`,
                  boxShadow: `0 0 ${baseSize * 0.12}px ${color}, 0 0 ${baseSize * 0.05}px #fff`,
                  animation: `monsterEyePulse 2.5s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Rune markings */}
          <div
            className="absolute left-1/2 -translate-x-1/2 text-center opacity-30 select-none"
            style={{
              top: '55%',
              color,
              fontSize: baseSize * 0.13,
              textShadow: `0 0 8px ${color}`,
              letterSpacing: '3px',
            }}
          >
            {runeSymbols}
          </div>
        </div>

        {/* Boss/Elite indicator */}
        {enemy.isBoss && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl" style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
            👑
          </div>
        )}
        {enemy.isElite && !enemy.isBoss && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
            ⚔️
          </div>
        )}

        {/* Target reticle on hover */}
        {canTarget && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ border: `2px dashed ${color}60`, borderRadius }}
          />
        )}
      </div>

      {/* Info below monster */}
      <div className="mt-3 text-center" style={{ minWidth: baseSize }}>
        <div
          className="text-xs font-bold tracking-wide"
          style={{
            color: enemy.isBoss ? '#ef4444' : enemy.isElite ? '#f97316' : '#e8e0f0',
            textShadow: `0 0 8px ${color}30`,
          }}
        >
          {enemy.name}
        </div>
        <span
          className="inline-block text-[9px] px-1.5 py-0.5 rounded-full mt-0.5"
          style={{ color, border: `1px solid ${color}30`, background: `${color}10` }}
        >
          {enemy.element}
        </span>
        <div className="w-24 h-2 rounded-full bg-black/60 overflow-hidden mt-1.5 mx-auto border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${hpPct}%`,
              background:
                hpPct > 50
                  ? 'linear-gradient(90deg,#b91c1c,#ef4444)'
                  : hpPct > 25
                    ? 'linear-gradient(90deg,#b91c1c,#f97316)'
                    : 'linear-gradient(90deg,#7f1d1d,#b91c1c)',
            }}
          />
        </div>
        <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">
          {enemy.hp} / {enemy.maxHp}
        </div>
        {enemy.weakness.length > 0 && (
          <div className="flex gap-0.5 mt-1 justify-center flex-wrap">
            {enemy.weakness.map((w) => (
              <span
                key={w}
                className="text-[7px] px-1 py-0.5 rounded-full"
                style={{
                  color: ELEMENT_COLORS[w] || '#22c55e',
                  background: `${ELEMENT_COLORS[w] || '#22c55e'}15`,
                  border: `1px solid ${ELEMENT_COLORS[w] || '#22c55e'}25`,
                }}
              >
                약점:{w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StagePage() {
  const worldTier = useGameStore((s) => s.worldTier);
  const inventorySkills = useGameStore((s) => s.skills);
  const addPoints = useGameStore((s) => s.addPoints);

  const deck = (() => {
    try {
      return inventorySkills.length >= 2 ? inventorySkills.slice(0, 4) : getPresetDeck(worldTier);
    } catch (e) {
      console.error('Failed to build deck:', e);
      return getPresetDeck(1);
    }
  })();

  const [stageNum, setStageNum] = useState(1);
  const [phase, setPhase] = useState<BattlePhase>('preparing');
  const [playerHp, setPlayerHp] = useState(500);
  const [playerMaxHp] = useState(500);
  const [playerMp, setPlayerMp] = useState(350);
  const [playerMaxMp] = useState(350);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [currentWave, setCurrentWave] = useState(0);
  const [totalWaves, setTotalWaves] = useState(3);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [turn, setTurn] = useState(0);
  const [screenShake, setScreenShake] = useState(0);
  const [castingVfx, setCastingVfx] = useState<SkillBlueprint | null>(null);

  const logIdRef = useRef(0);
  const floatIdRef = useRef(0);
  const busyRef = useRef(false);
  const stageRef = useRef<ReturnType<typeof generateStage> | null>(null);

  const addLog = useCallback((text: string, color: string) => {
    const id = logIdRef.current++;
    setLogs((prev) => [...prev.slice(-8), { text, color, id }]);
  }, []);

  const addFloat = useCallback((x: number, y: number, text: string, color: string, isCrit: boolean) => {
    const id = floatIdRef.current++;
    const ft: FloatingText = { id, x, y, text, color, isCrit, startTime: Date.now() };
    setFloatingTexts((prev) => [...prev, ft]);
    setTimeout(() => setFloatingTexts((prev) => prev.filter((f) => f.id !== id)), 1300);
  }, []);

  const shake = useCallback((level: number) => {
    setScreenShake(level);
    setTimeout(() => setScreenShake(0), 400);
  }, []);

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // ── Start Stage ──
  const startStage = useCallback((sNum: number) => {
    try {
      const stage = generateStage(worldTier, sNum);
      stageRef.current = stage;
      setStageNum(sNum);
      setPlayerHp(500);
      setPlayerMp(350);
      const waveEnemies = stage.waves[0]?.enemies ?? [];
      setEnemies(waveEnemies.map((e) => ({ ...e })));
      setCurrentWave(0);
      setTotalWaves(stage.waves.length);
      setCooldowns({});
      setLogs([]);
      setFloatingTexts([]);
      setTurn(0);
      busyRef.current = false;
      setPhase('player_turn');
      logIdRef.current = 0;
      floatIdRef.current = 0;
      setTimeout(() => addLog(`World ${worldTier} - Stage ${sNum} 전투 시작!`, '#c084fc'), 50);
    } catch (e) {
      console.error('Failed to start stage:', e);
      setPhase('defeat');
    }
  }, [worldTier, addLog]);

  // ── Enemy Turn ──
  const doEnemyTurn = useCallback(async (aliveEnemies: Enemy[]) => {
    setPhase('enemy_turn');
    for (const enemy of aliveEnemies) {
      const pattern = enemy.patterns[Math.floor(Math.random() * enemy.patterns.length)];
      await sleep(600);

      const hitCount = pattern.hitCount ?? 1;
      let totalDmg = 0;
      for (let h = 0; h < hitCount; h++) {
        const dmg = Math.round(pattern.damage * (0.8 + Math.random() * 0.4));
        totalDmg += dmg;
        setPlayerHp((hp) => Math.max(0, hp - dmg));
        addFloat(180 + Math.random() * 40 + h * 15, 180 + Math.random() * 30 + h * 10, `${dmg}`, '#ef4444', false);
        if (hitCount > 1) await sleep(150);
      }
      shake(pattern.attackType === 'charge' ? 2 : 1);
      addLog(`${enemy.name}의 ${pattern.name}! ${totalDmg} 피해!`, '#ef4444');
      await sleep(300);
    }
    await sleep(400);
  }, [addFloat, addLog, shake]);

  // ── Wave Clear ──
  const doWaveClear = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const nextWave = currentWave + 1;
    if (nextWave >= stage.waves.length) {
      setPhase('victory');
      addLog('승리! 스테이지 클리어!', '#facc15');
      addPoints(100 * worldTier);
      busyRef.current = false;
      return;
    }
    setPhase('wave_clear');
    addLog(`웨이브 ${currentWave + 1} 클리어!`, '#c084fc');
    await sleep(1200);
    setCurrentWave(nextWave);
    setEnemies(stage.waves[nextWave].enemies.map((e) => ({ ...e })));
    setPlayerMp((mp) => Math.min(playerMaxMp, mp + 50));
    addLog(`웨이브 ${nextWave + 1} 시작!`, '#c084fc');
    setPhase('player_turn');
    busyRef.current = false;
  }, [currentWave, worldTier, addLog, addPoints, playerMaxMp]);

  // ── Cast Skill ──
  const castSkill = useCallback(async (skill: SkillBlueprint, targetIdx: number) => {
    if (busyRef.current || phase !== 'player_turn') return;
    if ((cooldowns[skill.id] ?? 0) > 0) return;
    if (playerMp < skill.stats.manaCost) {
      addLog('마나가 부족합니다!', '#ef4444');
      return;
    }

    busyRef.current = true;
    setPhase('animating');
    setPlayerMp((mp) => mp - skill.stats.manaCost);

    // Trigger VFX
    setCastingVfx({ ...skill });
    setTimeout(() => setCastingVfx(null), 1800);

    const cdTurns = Math.max(0, Math.ceil(skill.stats.cooldown / 3));
    setCooldowns((prev) => ({ ...prev, [skill.id]: cdTurns }));

    const offensive = isOffensiveSkill(skill);

    if (offensive) {
      // Deal damage
      let newEnemies: Enemy[] = [];
      setEnemies((prev) => {
        const target = prev[targetIdx];
        if (!target || target.hp <= 0) return prev;

        const { damage, affinity, degradation, isCrit } = calculateSkillDamage(skill, target, worldTier);
        const newHp = Math.max(0, target.hp - damage);

        addFloat(
          500 + targetIdx * 100 + Math.random() * 30,
          100 + targetIdx * 60 + Math.random() * 20,
          `${damage}`,
          ELEMENT_COLORS[skill.vfx.material] || '#fff',
          isCrit,
        );
        shake(isCrit ? 2 : 1);

        let logText = `${skill.name}(으)로 ${target.name}에게 ${damage} 피해!`;
        if (isCrit) logText = `치명타! ${logText}`;
        if (affinity > 1.1) logText += ' (효과적!)';
        if (affinity < 0.9) logText += ' (비효과적...)';
        if (degradation < 0.95) logText += ` [열화 ${Math.round(degradation * 100)}%]`;
        addLog(logText, ELEMENT_COLORS[skill.vfx.material] || '#fff');

        const updated = prev.map((e, i) => (i === targetIdx ? { ...e, hp: newHp } : e));
        newEnemies = updated;
        return updated;
      });

      await sleep(600);

      // Check kills
      const killed = newEnemies.filter((e) => e.hp <= 0);
      for (const d of killed) addLog(`${d.name} 처치!`, '#facc15');
      const alive = newEnemies.filter((e) => e.hp > 0);
      if (killed.length > 0) setEnemies(alive);

      // Reduce cooldowns
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = Math.max(0, v - 1);
        return next;
      });
      setTurn((t) => t + 1);

      await sleep(300);

      if (alive.length === 0) {
        await doWaveClear();
      } else {
        await doEnemyTurn(alive);
        // Check player death
        setPlayerHp((hp) => {
          if (hp <= 0) {
            setPhase('defeat');
            addLog('패배... 어둠에 삼켜졌습니다.', '#ef4444');
          } else {
            setPhase('player_turn');
            busyRef.current = false;
          }
          return hp;
        });
      }
    } else {
      // Heal / Buff
      const healAmt = calculateHealAmount(skill);
      if (healAmt > 0) {
        setPlayerHp((hp) => Math.min(playerMaxHp, hp + healAmt));
        addFloat(180, 180, `+${healAmt}`, '#34d399', false);
        addLog(`${skill.name}(으)로 HP ${healAmt} 회복!`, '#34d399');
      }

      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = Math.max(0, v - 1);
        return next;
      });
      setTurn((t) => t + 1);

      await sleep(600);

      // Enemy turn after heal
      const alive = enemies.filter((e) => e.hp > 0);
      if (alive.length > 0) {
        await doEnemyTurn(alive);
        setPlayerHp((hp) => {
          if (hp <= 0) {
            setPhase('defeat');
            addLog('패배...', '#ef4444');
          } else {
            setPhase('player_turn');
            busyRef.current = false;
          }
          return hp;
        });
      } else {
        await doWaveClear();
      }
    }
  }, [phase, cooldowns, playerMp, playerMaxHp, worldTier, enemies, addLog, addFloat, shake, doEnemyTurn, doWaveClear]);

  // Mount
  useEffect(() => {
    startStage(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hpPct = (playerHp / playerMaxHp) * 100;
  const mpPct = (playerMp / playerMaxMp) * 100;

  return (
    <main className="h-screen flex flex-col">
      {/* Monster animations */}
      <style>{`
        @keyframes monsterFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes monsterEyePulse {
          0%, 100% { opacity: 0.7; transform: scaleX(1); }
          50% { opacity: 1; transform: scaleX(1.1); }
        }
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          30% { opacity: 1; }
          100% { transform: translateY(-80px); opacity: 0; }
        }
      `}</style>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            ← 홈
          </a>
          <h1 className="text-xl font-bold text-[var(--accent-lightning)]">
            Stage — World {worldTier}-{stageNum}
          </h1>
          <span className="text-xs text-[var(--text-secondary)]">
            Wave {currentWave + 1}/{totalWaves}
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">Turn {turn}</span>
      </header>

      {/* Battle Area */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          transform: screenShake > 0
            ? `translate(${(Math.random() - 0.5) * screenShake * 6}px, ${(Math.random() - 0.5) * screenShake * 4}px)`
            : 'none',
        }}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0520] via-[var(--bg-primary)] to-[#0f0a1a]" />

        {/* Battle Content */}
        <div className="relative z-10 h-full flex items-start p-6 gap-6">
          {/* Player Panel */}
          <div className="shrink-0 w-60">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 backdrop-blur-md">
              <div className="text-sm font-bold text-[var(--accent-heal)] mb-3 tracking-wider">대마법사</div>
              <BarRow label="HP" value={playerHp} max={playerMaxHp} pct={hpPct} gradient="linear-gradient(90deg,#059669,#34d399)" color="var(--accent-heal)" />
              <BarRow label="MP" value={playerMp} max={playerMaxMp} pct={mpPct} gradient="linear-gradient(90deg,#6d28d9,#8b5cf6)" color="var(--accent-void)" />
            </div>

            {/* Battle Log */}
            <div className="mt-4 w-full max-h-36 overflow-hidden pointer-events-none">
              {logs.map((log) => (
                <div key={log.id} className="text-xs mb-1" style={{ color: log.color, opacity: 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                  {log.text}
                </div>
              ))}
            </div>
          </div>

          {/* Battle Field - Center */}
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            {/* Phase indicator */}
            <div className="mb-6 h-10 flex items-center">
              {phase === 'player_turn' && (
                <div className="text-lg font-bold text-[var(--accent-arcane)] animate-pulse opacity-60">
                  적을 클릭하여 공격
                </div>
              )}
              {phase === 'enemy_turn' && (
                <div className="text-2xl font-bold text-[#ef4444] animate-pulse" style={{ textShadow: '0 0 30px rgba(239,68,68,0.5)' }}>
                  적의 공격!
                </div>
              )}
              {phase === 'wave_clear' && (
                <div className="text-3xl font-bold text-[var(--accent-arcane)]" style={{ textShadow: '0 0 40px rgba(168,85,247,0.5)' }}>
                  웨이브 클리어!
                </div>
              )}
            </div>

            {/* Monster Visuals */}
            <div className="flex items-end gap-10 justify-center flex-wrap">
              {enemies.map((enemy, idx) => (
                <MonsterVisual
                  key={enemy.id + idx}
                  enemy={enemy}
                  index={idx}
                  canTarget={phase === 'player_turn' && !busyRef.current}
                  onClick={() => {
                    if (phase !== 'player_turn' || busyRef.current) return;
                    const skill = deck.find((s) => (cooldowns[s.id] ?? 0) <= 0 && playerMp >= s.stats.manaCost && isOffensiveSkill(s));
                    if (skill) castSkill(skill, idx);
                  }}
                />
              ))}
            </div>

            {enemies.length === 0 && phase === 'preparing' && (
              <div className="text-sm text-[var(--text-secondary)]">전투 준비 중...</div>
            )}
          </div>
        </div>

        {/* Floating Texts (CSS-animated, no RAF re-renders) */}
        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="absolute pointer-events-none font-black z-30"
            style={{
              left: ft.x,
              top: ft.y,
              color: ft.color,
              fontSize: ft.isCrit ? '36px' : '24px',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              animation: 'floatUp 1.3s ease-out forwards',
            }}
          >
            {ft.isCrit && <span className="text-xs mr-1">CRIT!</span>}{ft.text}
          </div>
        ))}

        {/* Skill VFX Overlay - always mounted to avoid WebGL context re-creation */}
        <div className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-200" style={{ opacity: castingVfx ? 1 : 0 }}>
          <PreviewCanvas skill={castingVfx} battleMode className="w-full h-full" />
        </div>

        {/* Victory */}
        {phase === 'victory' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-[#06030f]/85">
            <div className="text-5xl font-black mb-4 bg-gradient-to-r from-[#facc15] to-[#f97316] bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 40px rgba(250,204,21,0.5))' }}>
              승리
            </div>
            <p className="text-[var(--text-secondary)] mb-8">+{100 * worldTier} 포인트 획득!</p>
            <div className="flex gap-4">
              <button onClick={() => startStage(Math.min(5, stageNum + 1))} className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-void)] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all">
                다음 스테이지 →
              </button>
              <button onClick={() => startStage(stageNum)} className="px-6 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all">
                다시 도전
              </button>
            </div>
          </div>
        )}

        {/* Defeat */}
        {phase === 'defeat' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-[#06030f]/85">
            <div className="text-5xl font-black mb-4 bg-gradient-to-r from-[#ef4444] to-[#7f1d1d] bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 40px rgba(239,68,68,0.4))' }}>
              패배
            </div>
            <p className="text-[var(--text-secondary)] mb-8">어둠에 삼켜졌습니다...</p>
            <button onClick={() => startStage(stageNum)} className="px-8 py-3 rounded-xl font-bold border border-[var(--accent-void)] bg-[var(--accent-void)]/10 hover:bg-[var(--accent-void)]/20 transition-all">
              다시 도전
            </button>
          </div>
        )}
      </div>

      {/* Skill Bar */}
      <div className="shrink-0 border-t border-[var(--border)] px-6 py-4 bg-[var(--bg-secondary)]">
        <div className="flex gap-3 justify-center flex-wrap">
          {deck.map((skill) => {
            const cd = cooldowns[skill.id] ?? 0;
            const canUse = phase === 'player_turn' && cd <= 0 && playerMp >= skill.stats.manaCost && !busyRef.current;
            const elemColor = ELEMENT_COLORS[skill.vfx.material] || '#fff';
            const offensive = isOffensiveSkill(skill);

            return (
              <button
                key={skill.id}
                onClick={() => {
                  if (!canUse) return;
                  if (offensive) {
                    const idx = enemies.findIndex((e) => e.hp > 0);
                    if (idx >= 0) castSkill(skill, idx);
                  } else {
                    castSkill(skill, 0);
                  }
                }}
                disabled={!canUse}
                className="relative w-36 p-3 rounded-xl border transition-all text-center select-none"
                style={{
                  borderColor: canUse ? elemColor + '60' : 'var(--border)',
                  background: canUse ? elemColor + '08' : 'var(--bg-card)',
                  opacity: canUse ? 1 : 0.4,
                  cursor: canUse ? 'pointer' : 'not-allowed',
                }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: elemColor }}>{skill.name}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">MP {skill.stats.manaCost}</div>
                <div className="text-[8px] text-[var(--text-secondary)] opacity-60 mt-1">
                  {skill.mechanics.delivery} · {skill.vfx.material}
                </div>
                {cd > 0 && (
                  <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                    <span className="text-xl font-black text-[var(--text-secondary)]">{cd}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {phase === 'player_turn' && (
          <p className="text-center text-[10px] text-[var(--text-secondary)] opacity-50 mt-2">
            스킬을 클릭하거나 적 패널을 클릭하여 공격하세요
          </p>
        )}
      </div>
    </main>
  );
}

function BarRow({ label, value, max, pct, gradient, color }: { label: string; value: number; max: number; pct: number; gradient: string; color: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span style={{ color }}>{value} / {max}</span>
      </div>
      <div className="h-3 rounded-full bg-black/50 overflow-hidden border border-white/5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    </div>
  );
}
