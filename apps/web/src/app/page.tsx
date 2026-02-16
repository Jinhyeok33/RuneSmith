import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
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
          href="/market"
          className="px-8 py-4 bg-[var(--accent-void)] text-white font-bold rounded-lg hover:opacity-90 transition"
        >
          Market - 마켓
        </Link>
      </div>
    </main>
  );
}
