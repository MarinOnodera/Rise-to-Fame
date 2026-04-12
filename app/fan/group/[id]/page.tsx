"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolCard } from "@/components/IdolCard";
import { TICKET_TIERS } from "@/lib/economy";

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, groups, idols, toggleBiasIdol, buyTicket } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);
  if (!user) return null;

  const g = groups.find((x) => x.id === id);
  if (!g)
    return (
      <main>
        <TopBar title="Not found" back="/fan" />
        <div className="p-6 opacity-70">グループが見つかりません</div>
      </main>
    );

  const members = idols.filter((i) => g.memberIds.includes(i.id));

  return (
    <main className="pb-24">
      <TopBar title={g.name} back="/fan" />
      <div
        className="relative h-40 mx-4 mt-4 rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${g.colorA}, ${g.colorB})`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-3 left-3">
          <div className="text-2xl font-black">{g.name}</div>
          <div className="text-xs opacity-90">{g.concept}</div>
          <div className="text-[11px] opacity-80">POP {g.popularity}</div>
        </div>
      </div>

      <section className="px-4 mt-5">
        <h2 className="font-bold text-sm opacity-80 mb-2">メンバー</h2>
        <div className="flex flex-col gap-2">
          {members.map((i) => (
            <IdolCard
              key={i.id}
              idol={i}
              active={user.biasIdolIds.includes(i.id)}
              onClick={() => {
                const r = toggleBiasIdol(i.id);
                if (!r.ok && r.reason) alert(r.reason);
              }}
              right={
                <span className="text-xs opacity-70">
                  {user.biasIdolIds.includes(i.id) ? "★" : "☆"}
                </span>
              }
            />
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <h2 className="font-bold text-sm opacity-80 mb-2">コンサートチケット</h2>
        <div className="grid grid-cols-3 gap-2">
          {TICKET_TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (buyTicket(t.id, t.coins, g.id)) {
                  alert(`${t.name} を購入しました`);
                } else alert("コインが足りません");
              }}
              className="card !p-3 text-center"
            >
              <div className="font-bold text-sm">{t.name}</div>
              <div className="text-[11px] opacity-70">♦ {t.coins.toLocaleString()}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
