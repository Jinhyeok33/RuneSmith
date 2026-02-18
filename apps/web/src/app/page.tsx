'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store/game-store';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useGameStore((s) => s.isAuthenticated);
  const user = useGameStore((s) => s.user);
  const logout = useGameStore((s) => s.logout);

  const handleLogout = () => {
    apiClient.setToken(null);
    logout();
    router.refresh();
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Auth Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="text-lg font-bold bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] bg-clip-text text-transparent">
          RuneSmith
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <>
              <div className="text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)] font-bold">{user.username}</span>
                <span className="mx-2">|</span>
                <span>World {user.world_tier}</span>
                <span className="mx-2">|</span>
                <span className="text-[var(--accent-heal)]">{user.points} pts</span>
                <span className="mx-2">|</span>
                <span className="text-[var(--accent-arcane)]">{user.rune_crystals} RC</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text-primary)] hover:border-[var(--accent-arcane)] transition"
              >
                로그인
              </Link>
              <Link
                href="/auth/register"
                className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--accent-void)] to-[var(--accent-arcane)] text-white font-bold hover:opacity-90 transition"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-[var(--accent-fire)] via-[var(--accent-lightning)] to-[var(--accent-void)] bg-clip-text text-transparent">
          RuneSmith
        </h1>
        <p className="text-[var(--text-secondary)] text-lg">
          상상이 마법이 되는 곳
        </p>
        <div className="flex gap-4 mt-8">
          <Link
            href="/forge"
            className="px-8 py-4 bg-[var(--accent-fire)] text-black font-bold rounded-lg hover:opacity-90 transition"
          >
            Forge - 스킬 제작
          </Link>
          <Link
            href="/stage"
            className="px-8 py-4 bg-[var(--accent-lightning)] text-black font-bold rounded-lg hover:opacity-90 transition"
          >
            Stage - 전투
          </Link>
          <Link
            href="/market/browse"
            className="px-8 py-4 bg-[var(--accent-void)] text-white font-bold rounded-lg hover:opacity-90 transition"
          >
            Market - 마켓
          </Link>
        </div>
      </div>
    </main>
  );
}
