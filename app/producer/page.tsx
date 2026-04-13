"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolCard } from "@/components/IdolCard";

export default function ProducerHome() {
  const router = useRouter();
  const { user, idols, createAgency, setMode } = useGame();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);
  if (!user) return null;

  if (!user.agencyId) {
    return (
      <main className="pb-24">
        <TopBar title="事務所を立ち上げる" back="/home" />
        <div className="p-4 flex flex-col gap-4">
          <div className="card">
            <div className="font-bold">代表兼プロデューサー</div>
            <div className="text-xs opacity-80 mt-1">
              あなたが見出したアイドルを、宿舎生活・路上ライブから育てて
              世界に売り出していきます。ファン課金の20%があなたの事務所に
              還元されます。
            </div>
          </div>
          <div className="card flex flex-col gap-3">
            <label className="text-sm">事務所名</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: LUNAR Entertainment"
            />
            <button
              className="btn-primary"
              disabled={name.trim().length < 2}
              onClick={() => {
                createAgency(name.trim());
                setMode("producer");
              }}
            >
              事務所を設立する
            </button>
          </div>
        </div>
      </main>
    );
  }

  const roster = idols.filter((i) => i.ownerId === user.agencyId);

  return (
    <main className="pb-24">
      <TopBar title={user.agencyName ?? "事務所"} back="/home" />
      <section className="p-4 grid grid-cols-2 gap-3">
        <StatTile label="コイン" value={`♦ ${user.coins.toLocaleString()}`} />
        <StatTile
          label="還元額（累積）"
          value={`¥${user.payoutEarnedJpy.toLocaleString()}`}
        />
        <StatTile label="借入残高" value={`♦ ${user.loans.reduce((s, l) => s + l.remaining, 0).toLocaleString()}`} />
        <StatTile label="所属アイドル" value={`${roster.length} 名`} />
      </section>
      <section className="px-4 grid grid-cols-2 gap-3 mt-1">
        <Tile href="/producer/audition" emoji="🎤" title="オーディション" desc="複数候補から選抜" />
        <Tile href="/producer/scout" emoji="🕵️" title="スカウト" desc="街でレアを探す" />
        <Tile href="/producer/roster" emoji="👯" title="ロスター / 育成" desc="個別トレーニング" />
        <Tile href="/producer/marketing" emoji="📣" title="マーケティング" desc="路上〜MVまで" />
        <Tile href="/producer/finance" emoji="🏦" title="ファイナンス" desc="融資 / 還元口座" />
        <Tile href="/producer/debut" emoji="🚀" title="グループ結成" desc="デビューさせる" />
      </section>
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm opacity-80">所属アイドル</h2>
          <Link href="/producer/roster" className="text-xs opacity-70">全員見る →</Link>
        </div>
        <div className="flex flex-col gap-2">
          {roster.length === 0 && (
            <div className="card text-sm opacity-70">
              まずはオーディションかスカウトから連れてきましょう。
            </div>
          )}
          {roster.slice(0, 4).map((i) => (
            <IdolCard key={i.id} idol={i} />
          ))}
        </div>
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="font-black text-lg">{value}</div>
    </div>
  );
}
function Tile({
  href,
  emoji,
  title,
  desc,
}: {
  href: string;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="card text-center">
      <div className="text-2xl">{emoji}</div>
      <div className="font-bold text-sm">{title}</div>
      <div className="text-[11px] opacity-70">{desc}</div>
    </Link>
  );
}
