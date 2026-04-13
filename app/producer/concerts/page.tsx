"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { CONCERT_TIERS } from "@/lib/economy";
import type { ConcertTier } from "@/lib/types";

export default function ConcertsPage() {
  const router = useRouter();
  const { user, groups, holdConcert } = useGame();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  const owned = groups.filter((g) => g.agencyId === user.agencyId);
  const selectedGroup = owned.find((g) => g.id === selected);

  return (
    <main className="pb-24">
      <TopBar title="コンサート" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        {owned.length === 0 ? (
          <div className="card text-sm opacity-80">
            まずはグループをデビューさせましょう。
          </div>
        ) : (
          <>
            <div className="card">
              <div className="text-xs opacity-70 mb-2">出演するグループを選ぶ</div>
              <div className="flex flex-col gap-2">
                {owned.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    className={`card !p-3 text-left flex justify-between items-center ${
                      selected === g.id ? "!border-kpink" : ""
                    }`}
                    style={{
                      borderColor: selected === g.id ? "#ff3d8b" : undefined,
                    }}
                  >
                    <div>
                      <div className="font-bold">{g.name}</div>
                      <div className="text-[11px] opacity-70">
                        POP {g.popularity} / FANS {g.fanCount.toLocaleString()}
                      </div>
                    </div>
                    <span className="chip">選ぶ</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedGroup && (
              <div className="flex flex-col gap-2">
                {CONCERT_TIERS.map((t) => {
                  const unlocked = selectedGroup.fanCount >= t.minFans;
                  const canAfford = user.coins >= t.cost;
                  return (
                    <div
                      key={t.tier}
                      className="card flex flex-col gap-2"
                      style={{ opacity: unlocked ? 1 : 0.55 }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{t.label}</div>
                          <div className="text-[11px] opacity-70">
                            必要ファン {t.minFans.toLocaleString()} / 開催 ♦ {t.cost.toLocaleString()}
                          </div>
                          <div className="text-[11px] opacity-70">
                            推定収益 ♦ {t.baseRevenueCoins.toLocaleString()} / POP +{t.popGain}
                          </div>
                        </div>
                        {!unlocked && (
                          <span className="chip text-[10px]">ロック中</span>
                        )}
                      </div>
                      <button
                        className="btn-primary !text-sm"
                        disabled={!unlocked || !canAfford}
                        onClick={() => {
                          const r = holdConcert(selectedGroup.id, t.tier as ConcertTier);
                          if (!r.ok) alert(r.reason ?? "開催できません");
                          else alert(`${t.label} 開催！ 収益 ♦${r.revenueCoins?.toLocaleString()}`);
                        }}
                      >
                        {unlocked ? "開催する" : `${t.minFans - selectedGroup.fanCount}人不足`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="card text-[11px] opacity-70 leading-5">
          ・地域イベント: ファン50人〜<br />
          ・中規模ライブ: 500人〜<br />
          ・大規模コンサート: 1000人〜<br />
          ・単独公演: 5000人〜
        </div>

        {user.concerts.length > 0 && (
          <div className="card">
            <div className="font-bold mb-2">開催履歴</div>
            <div className="flex flex-col gap-1">
              {user.concerts.slice(0, 8).map((c) => {
                const g = groups.find((x) => x.id === c.groupId);
                return (
                  <div key={c.id} className="text-xs opacity-80 flex justify-between">
                    <span>
                      {g?.name ?? "—"} / {c.tier}
                    </span>
                    <span>
                      ♦{c.revenueCoins.toLocaleString()} / {c.heldAt.slice(0, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
