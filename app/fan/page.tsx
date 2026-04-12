"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { GroupCard } from "@/components/GroupCard";
import { IdolCard } from "@/components/IdolCard";

export default function FanHome() {
  const router = useRouter();
  const { user, groups, idols, toggleBiasGroup, toggleBiasIdol } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);
  if (!user) return null;

  const girls = groups.filter((g) => g.gender === "girls");
  const boys = groups.filter((g) => g.gender === "boys");

  const rookies = idols
    .filter((i) => i.popularity < 25 && i.debuted)
    .slice(0, 6);

  return (
    <main className="pb-24">
      <TopBar title="Fan Home" back="/home" />
      <section className="px-4 mt-4">
        <div className="card">
          <div className="text-sm font-bold mb-1">推しの枠</div>
          <div className="text-xs opacity-80">
            グループ {user.biasGroupIds.length}/3 ・ アイドル{" "}
            {user.biasIdolIds.length}/5
          </div>
        </div>
      </section>

      <section className="px-4 mt-5">
        <h2 className="font-bold text-sm opacity-80 mb-2">ガールズグループ</h2>
        <div className="flex flex-col gap-3">
          {girls.map((g) => (
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

      <section className="px-4 mt-5">
        <h2 className="font-bold text-sm opacity-80 mb-2">ボーイズグループ</h2>
        <div className="flex flex-col gap-3">
          {boys.map((g) => (
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

      <section className="px-4 mt-6">
        <h2 className="font-bold text-sm opacity-80 mb-2">
          初期から応援できるルーキー
        </h2>
        <div className="text-[11px] opacity-60 mb-2">
          売れていない今こそ、あなたの一票が大きい。
        </div>
        <div className="flex flex-col gap-2">
          {rookies.length === 0 && (
            <div className="text-sm opacity-60">
              まだ新人はいません。誰かが事務所を立ち上げるのを待ちましょう。
            </div>
          )}
          {rookies.map((i) => (
            <IdolCard
              key={i.id}
              idol={i}
              active={user.biasIdolIds.includes(i.id)}
              onClick={() => {
                const r = toggleBiasIdol(i.id);
                if (!r.ok && r.reason) alert(r.reason);
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
