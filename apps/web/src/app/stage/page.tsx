'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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

type BattlePhase = 'preparing' | 'player_turn' | 'animating' | 'enemy_turn' | 'telegraph' | 'dodge_window' | 'wave_clear' | 'victory' | 'defeat';

interface TelegraphData {
  enemyName: string;
  pattern: import('@runesmith/shared').EnemyPattern;
  enemyIdx: number;
}

export default function StagePage() {
  const worldTier = useGameStore((s) => s.worldTier);
  const inventorySkills = useGameStore((s) => s.skills);
  const addPoints = useGameStore((s) => s.addPoints);

  const deck = inventorySkills.length >= 2 ? inventorySkills.slice(0, 4) : getPresetDeck(worldTier);

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
  const [telegraph, setTelegraph] = useState<TelegraphData | null>(null);
  const [dodgeWindow, setDodgeWindow] = useState(false);
  const [dodgeSuccess, setDodgeSuccess] = useState(false);
  const [dodgeAttempts, setDodgeAttempts] = useState(0);

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
    const stage = generateStage(worldTier, sNum);
    stageRef.current = stage;
    setStageNum(sNum);
    setPlayerHp(500);
    setPlayerMp(350);
    setEnemies(stage.waves[0].enemies.map((e) => ({ ...e })));
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
  }, [worldTier, addLog]);

  // ── Dodge Handler ──
  const handleDodge = useCallback(() => {
    if (!dodgeWindow) return;
    setDodgeSuccess(true);
    setDodgeAttempts((a) => a + 1);
    addLog('회피 성공! 무적 상태!', '#34d399');
    shake(0.5);
  }, [dodgeWindow, addLog, shake]);

  // ── Enemy Turn ──
  const doEnemyTurn = useCallback(async (aliveEnemies: Enemy[]) => {
    setPhase('enemy_turn');
    for (const [idx, enemy] of aliveEnemies.entries()) {
      const pattern = enemy.patterns[Math.floor(Math.random() * enemy.patterns.length)];

      // Show telegraph
      if (pattern.dodgeable) {
        setPhase('telegraph');
        setTelegraph({ enemyName: enemy.name, pattern, enemyIdx: idx });
        addLog(`${enemy.name}이(가) ${pattern.name} 준비 중...`, '#f97316');
        await sleep(pattern.telegraph);
        setTelegraph(null);

        // Dodge window
        setPhase('dodge_window');
        setDodgeWindow(true);
        setDodgeSuccess(false);
        await sleep(500); // 0.5초 dodge window
        setDodgeWindow(false);
      } else {
        await sleep(600);
      }

      // Attack
      setPhase('enemy_turn');
      const wasDodged = dodgeSuccess;
      setDodgeSuccess(false);

      if (wasDodged) {
        addLog(`${pattern.name}을(를) 회피했다!`, '#34d399');
        addFloat(180 + Math.random() * 40, 180 + Math.random() * 30, 'DODGE!', '#34d399', false);
      } else {
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
      }

      await sleep(300);
    }
    await sleep(400);
  }, [addFloat, addLog, shake, dodgeSuccess]);

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

  // Floating text animation ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    if (floatingTexts.length === 0) return;
    const id = requestAnimationFrame(() => setTick((t) => t + 1));
    return () => cancelAnimationFrame(id);
  }, [floatingTexts, setTick]);

  // Keyboard dodge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && dodgeWindow) {
        e.preventDefault();
        handleDodge();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dodgeWindow, handleDodge]);

  const hpPct = (playerHp / playerMaxHp) * 100;
  const mpPct = (playerMp / playerMaxMp) * 100;

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
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
        className="flex-1 relative min-h-[400px]"
        style={{
          transform: screenShake > 0
            ? `translate(${(Math.random() - 0.5) * screenShake * 6}px, ${(Math.random() - 0.5) * screenShake * 4}px)`
            : 'none',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0520] via-[var(--bg-primary)] to-[#0f0a1a]" />

        {/* Player Panel */}
        <div className="absolute left-8 top-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 w-64 backdrop-blur-md">
            <div className="text-sm font-bold text-[var(--accent-heal)] mb-3 tracking-wider">대마법사</div>
            <BarRow label="HP" value={playerHp} max={playerMaxHp} pct={hpPct} gradient="linear-gradient(90deg,#059669,#34d399)" color="var(--accent-heal)" />
            <BarRow label="MP" value={playerMp} max={playerMaxMp} pct={mpPct} gradient="linear-gradient(90deg,#6d28d9,#8b5cf6)" color="var(--accent-void)" />
          </div>
        </div>

        {/* Enemy Panels */}
        <div className="absolute right-8 top-8 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {enemies.map((enemy, idx) => {
            const ehpPct = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
            const elemColor = ELEMENT_COLORS[enemy.element] || '#fff';
            return (
              <div
                key={enemy.id + idx}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 w-72 backdrop-blur-md transition-all cursor-pointer hover:border-[var(--accent-fire)]/50"
                onClick={() => {
                  if (phase !== 'player_turn' || busyRef.current) return;
                  const skill = deck.find((s) => (cooldowns[s.id] ?? 0) <= 0 && playerMp >= s.stats.manaCost && isOffensiveSkill(s));
                  if (skill) castSkill(skill, idx);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold" style={{ color: enemy.isBoss ? '#ef4444' : enemy.isElite ? '#f97316' : '#e8e0f0' }}>
                    {enemy.isBoss ? '👑 ' : enemy.isElite ? '⚔️ ' : ''}{enemy.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: elemColor, borderColor: elemColor + '40' }}>
                    {enemy.element}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-black/50 overflow-hidden border border-white/5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ehpPct}%`, background: 'linear-gradient(90deg,#b91c1c,#ef4444)' }} />
                </div>
                <div className="text-[10px] text-right mt-0.5 text-[var(--text-secondary)]">{enemy.hp} / {enemy.maxHp}</div>
                {enemy.weakness.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {enemy.weakness.map((w) => (
                      <span key={w} className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-500/20">약점: {w}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Texts */}
        {floatingTexts.map((ft) => {
          const elapsed = Date.now() - ft.startTime;
          const p = Math.min(1, elapsed / 1300);
          const opacity = p < 0.3 ? 1 : Math.max(0, 1 - (p - 0.3) / 0.7);
          return (
            <div
              key={ft.id}
              className="absolute pointer-events-none font-black z-30"
              style={{
                left: ft.x, top: ft.y - p * 80,
                color: ft.color, opacity,
                fontSize: ft.isCrit ? '36px' : '24px',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              }}
            >
              {ft.isCrit && <span className="text-xs mr-1">CRIT!</span>}{ft.text}
            </div>
          );
        })}

        {/* Battle Log */}
        <div className="absolute bottom-4 left-6 w-72 max-h-36 overflow-hidden pointer-events-none">
          {logs.map((log) => (
            <div key={log.id} className="text-xs mb-1" style={{ color: log.color, opacity: 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
              {log.text}
            </div>
          ))}
        </div>

        {/* Phase Overlays */}
        {phase === 'telegraph' && telegraph && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="text-4xl font-black text-[#f97316] mb-2 animate-pulse" style={{ textShadow: '0 0 40px rgba(249,115,22,0.6)' }}>
                ⚠️ {telegraph.pattern.name}
              </div>
              <div className="text-sm text-[var(--text-secondary)]">{telegraph.enemyName}</div>
              {/* Attack Type Indicator */}
              {telegraph.pattern.attackType === 'aoe' && (
                <div className="absolute -inset-32 border-4 border-[#f97316]/40 rounded-full animate-ping" />
              )}
              {telegraph.pattern.attackType === 'beam' && (
                <div className="absolute left-1/2 -translate-x-1/2 w-2 h-96 bg-gradient-to-b from-[#f97316]/60 to-transparent" />
              )}
            </div>
          </div>
        )}
        {phase === 'dodge_window' && (
          <div className="absolute inset-0 z-45 flex flex-col items-center justify-center">
            <button
              onClick={handleDodge}
              className="px-16 py-8 text-3xl font-black rounded-2xl bg-gradient-to-r from-[#22c55e] to-[#059669] text-white shadow-2xl animate-bounce border-4 border-white/30"
              style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)', boxShadow: '0 0 60px rgba(34,197,94,0.5)' }}
              autoFocus
            >
              회피! (SPACE)
            </button>
            <p className="text-xs text-[var(--text-secondary)] mt-4">클릭 또는 스페이스바를 눌러 회피하세요!</p>
          </div>
        )}
        {phase === 'enemy_turn' && !telegraph && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-[#ef4444] animate-pulse z-40" style={{ textShadow: '0 0 30px rgba(239,68,68,0.5)' }}>
            적의 공격!
          </div>
        )}
        {phase === 'wave_clear' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-[var(--accent-arcane)] z-40" style={{ textShadow: '0 0 40px rgba(168,85,247,0.5)' }}>
            웨이브 클리어!
          </div>
        )}

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
      <div className="border-t border-[var(--border)] px-6 py-4 bg-[var(--bg-secondary)]">
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
