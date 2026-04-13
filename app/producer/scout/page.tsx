"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { generateCandidates } from "@/lib/idols/generator";
import { IdolCard } from "@/components/IdolCard";
import { HankoStamp, type HankoResult } from "@/components/HankoStamp";
import { contractSuccessRate } from "@/lib/contracts";
import type { Gender } from "@/lib/types";

// スカウトはオーディションより少数・高確率レア
export default function Scout() {
  const router = useRouter();
  const { user, signIdol } = useGame();
  const [gender, setGender] = useState<Gender>("girls");
  const [refreshKey, setRefreshKey] = useState(0);
  const [hanko, setHanko] = useState<HankoResult | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  const candidates = useMemo(() => {
    const base = generateCandidates(gender, 3);
    return base.map((c) => ({
      ...c,
      stats: {
        vocal: Math.min(100, c.stats.vocal + 12),
        dance: Math.min(100, c.stats.dance + 12),
        rap: Math.min(100, c.stats.rap + 12),
        visual: Math.min(100, c.stats.visual + 12),
        charm: Math.min(100, c.stats.charm + 12),
        stamina: Math.min(100, c.stats.stamina + 12),
      },
      auditionScore: c.auditionScore + 12,
      cost: c.cost + 600, // レアは高い
    }));
  }, [gender, refreshKey]);

  if (!user?.agencyId) return null;

  const scoutFee = 400;

  return (
    <main className="pb-24">
      <TopBar title="街でスカウト" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card">
          <div className="font-bold">スカウト出動 ♦ {scoutFee}</div>
          <div className="text-xs opacity-80 mt-1">
            高ポテンシャルだが契約料も高くなります。
          </div>
          <button
            className="btn-ghost mt-2"
            onClick={() => {
              if (user.coins < scoutFee) return alert("コインが足りません");
              useGame.getState().spendCoins(scoutFee);
              setRefreshKey((x) => x + 1);
            }}
          >
            ↻ 街に出る
          </button>
        </div>
        <div className="flex gap-2">
          {(["girls", "boys"] as Gender[]).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`chip ${gender === g ? "!bg-kpink !text-white" : ""}`}
            >
              {g === "girls" ? "♀ Girls" : "♂ Boys"}
            </button>
          ))}
        </div>
        {candidates.map((c) => {
          const rate = contractSuccessRate(c.auditionScore, "scout", user.effort);
          return (
            <IdolCard
              key={c.id}
              idol={c}
              right={
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs opacity-80">Score {c.auditionScore}</div>
                  <div className="text-[10px] opacity-60">成功 {Math.round(rate * 100)}%</div>
                  <button
                    className="btn-primary !text-xs !py-1 !px-3"
                    onClick={() => {
                      const r = signIdol(c, "scout");
                      if (!r.paid) {
                        alert("コインが足りません");
                        return;
                      }
                      setHanko({ success: r.success, rate: r.rate, name: c.stageName });
                    }}
                  >
                    契約 ♦{c.cost}
                  </button>
                </div>
              }
            />
          );
        })}
      </div>
      <HankoStamp result={hanko} onClose={() => setHanko(null)} />
    </main>
  );
}
