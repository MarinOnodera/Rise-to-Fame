"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { StreetScene } from "@/components/StreetScene";
import { GroupCard } from "@/components/GroupCard";
import { Tutorial } from "@/components/Tutorial";

export default function HomePage() {
  const router = useRouter();
  const {
    user,
    groups,
    setMode,
    toggleBiasGroup,
    deliverDailyMessages,
    tickIdolPosts,
    completeTutorial,
  } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
    else {
      if (user.mode === null) setMode("fan"); // デフォルトはファン側
      void deliverDailyMessages();
      void tickIdolPosts();
    }
  }, [user, router, setMode, deliverDailyMessages, tickIdolPosts]);

  if (!user) return null;

  const topGroups = [...groups]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);

  return (
    <main className="pb-24">
      <TopBar title="Seoul Street" />
      {!user.tutorialDone && <Tutorial onFinish={completeTutorial} />}

      {/* Dual CTAs */}
      <section className="px-4 mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/fan/discover"
          className="card !p-3 flex flex-col items-start gap-1 border-kpink/40 bg-gradient-to-br from-kpink/25 to-kpurple/20 active:scale-95"
        >
          <span className="text-2xl">🔮</span>
          <span className="font-bold text-sm leading-tight">
            推しアイドルを
            <br />
            探しに行く
          </span>
          <span className="text-[10px] opacity-70">AIがあなたに合う3人を選ぶ</span>
        </Link>
        <Link
          href="/producer"
          className="card !p-3 flex flex-col items-start gap-1 border-kgold/40 bg-gradient-to-br from-kgold/25 to-kpink/20 active:scale-95"
        >
          <span className="text-2xl">🎬</span>
          <span className="font-bold text-sm leading-tight">
            アイドルグループを
            <br />
            作成する
          </span>
          <span className="text-[10px] opacity-70">プロデューサーとして事務所設立</span>
        </Link>
      </section>

      {/* Street scene with product ads */}
      <section className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm opacity-80">江南 · 夕方</h2>
          <span className="text-[10px] opacity-50">
            広告をタップして推しに追加
          </span>
        </div>
        <StreetScene />
      </section>

      {/* Top groups */}
      <section className="px-4 mt-6">
        <h2 className="font-bold text-sm opacity-80 mb-2">今夜のトップ</h2>
        <div className="flex flex-col gap-3">
          {topGroups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              biased={user.biasGroupIds.includes(g.id)}
              onToggleBias={() => {
                const r = toggleBiasGroup(g.id);
                if (!r.ok && r.reason) alert(r.reason);
              }}
            />
          ))}
        </div>
      </section>

      {/* Fan hub */}
      <section className="px-4 mt-6 grid grid-cols-2 gap-3">
        <Link href="/fan" className="card text-center">
          <div className="text-2xl">💗</div>
          <div className="font-bold">ファン ホーム</div>
          <div className="text-[11px] opacity-70">推しと会いに行く</div>
        </Link>
        <Link href="/fan/feed" className="card text-center">
          <div className="text-2xl">📱</div>
          <div className="font-bold">フィード</div>
          <div className="text-[11px] opacity-70">推しの投稿・ライブ</div>
        </Link>
        <Link href="/fan/messages" className="card text-center relative">
          <div className="text-2xl">✉</div>
          <div className="font-bold">推しメッセ</div>
          <div className="text-[11px] opacity-70">
            未読 {user.inbox.filter((m) => !m.read).length}
          </div>
        </Link>
        <Link href="/fan/shop" className="card text-center">
          <div className="text-2xl">🛍</div>
          <div className="font-bold">推しグッズ</div>
          <div className="text-[11px] opacity-70">ペンライト / CD / PC</div>
        </Link>
        <Link href="/shop/coins" className="card text-center">
          <div className="text-2xl">♦</div>
          <div className="font-bold">コイン購入</div>
          <div className="text-[11px] opacity-70">課金でコイン追加</div>
        </Link>
      </section>
    </main>
  );
}
