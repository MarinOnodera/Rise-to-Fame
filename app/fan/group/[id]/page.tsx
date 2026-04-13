"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolCard } from "@/components/IdolCard";
import { TICKET_TIERS } from "@/lib/economy";
import { GiftModal } from "@/components/GiftModal";
import Link from "next/link";

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, groups, idols, toggleBiasIdol, buyTicket } = useGame();
  const [ticketTier, setTicketTier] = useState<null | {
    id: string;
    name: string;
    coins: number;
  }>(null);
  const [giftIdol, setGiftIdol] = useState<null | { id: string; name: string }>(null);

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
          <div className="text-[11px] opacity-80">
            POP {g.popularity} / FANS {g.fanCount.toLocaleString()}
          </div>
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
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs opacity-70">
                    {user.biasIdolIds.includes(i.id) ? "★" : "☆"}
                  </span>
                  <button
                    className="chip !text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGiftIdol({ id: i.id, name: i.stageName });
                    }}
                  >
                    🎁 贈る
                  </button>
                </div>
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
              onClick={() => setTicketTier(t)}
              className="card !p-3 text-center"
            >
              <div className="font-bold text-sm">{t.name}</div>
              <div className="text-[11px] opacity-70">♦ {t.coins.toLocaleString()}</div>
            </button>
          ))}
        </div>
      </section>

      {ticketTier && (
        <div
          className="fixed inset-0 z-[700] bg-black/70 flex items-center justify-center"
          onClick={() => setTicketTier(null)}
        >
          <div
            className="bg-kpanel rounded-2xl p-5 w-[320px] border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs opacity-70">{g.name}</div>
            <div className="text-xl font-black mb-2">{ticketTier.name}</div>
            <div className="text-sm opacity-80">
              価格 ♦ {ticketTier.coins.toLocaleString()}<br />
              所持 ♦ {user.coins.toLocaleString()}
            </div>
            {user.coins < ticketTier.coins ? (
              <div className="mt-3 text-xs text-kpink">
                コインが足りません。
              </div>
            ) : (
              <div className="mt-3 text-xs opacity-70">
                購入するとこのグループの所属事務所に20%還元されます。
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button className="btn-ghost flex-1" onClick={() => setTicketTier(null)}>
                ← 戻る
              </button>
              {user.coins < ticketTier.coins ? (
                <Link
                  href="/shop/coins"
                  className="btn-gold flex-1 text-center"
                  onClick={() => setTicketTier(null)}
                >
                  ♦ チャージ
                </Link>
              ) : (
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    if (buyTicket(ticketTier.id, ticketTier.coins, g.id)) {
                      alert(`${ticketTier.name} を購入しました`);
                    }
                    setTicketTier(null);
                  }}
                >
                  購入する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {giftIdol && (
        <GiftModal
          idolId={giftIdol.id}
          idolName={giftIdol.name}
          onClose={() => setGiftIdol(null)}
        />
      )}
    </main>
  );
}
