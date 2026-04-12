"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { CityAds } from "@/components/CityAds";
import { GroupCard } from "@/components/GroupCard";

export default function HomePage() {
  const router = useRouter();
  const { user, groups, setMode, toggleBiasGroup, deliverDailyMessages } =
    useGame();

  useEffect(() => {
    if (!user) router.replace("/");
    else {
      if (user.mode === null) setMode("fan"); // デフォルトはファン側
      deliverDailyMessages();
    }
  }, [user, router, setMode, deliverDailyMessages]);

  if (!user) return null;

  const topGroups = [...groups]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);

  return (
    <main className="pb-24">
      <TopBar title="Seoul Street" />

      {/* Producer CTA */}
      <section className="px-4 mt-4">
        <Link
          href="/producer"
          className="card flex items-center justify-between border-kpink/40 bg-gradient-to-r from-kpink/20 to-kpurple/20"
        >
          <div>
            <div className="text-xs opacity-70">
              代表兼プロデューサーとして事務所を立ち上げる
            </div>
            <div className="font-bold">アイドルグループを作成する →</div>
          </div>
          <span className="text-2xl">🎬</span>
        </Link>
      </section>

      {/* City ads */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm opacity-80">街の広告</h2>
          <span className="text-[10px] opacity-50">SEOUL 2026</span>
        </div>
        <CityAds />
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
