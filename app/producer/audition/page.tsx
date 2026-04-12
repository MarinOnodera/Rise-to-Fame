"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { generateCandidates } from "@/lib/idols/generator";
import { IdolCard } from "@/components/IdolCard";
import type { Gender } from "@/lib/types";

export default function Audition() {
  const router = useRouter();
  const { user, signIdol } = useGame();
  const [gender, setGender] = useState<Gender>("girls");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  const candidates = useMemo(
    () => generateCandidates(gender, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gender, refreshKey]
  );

  if (!user?.agencyId) return null;

  const auditionFee = 120;

  return (
    <main className="pb-24">
      <TopBar title="オーディション" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-bold">開催コスト ♦ {auditionFee}</div>
            <div className="text-[11px] opacity-70">
              候補者を差し替えるたびに開催費がかかります
            </div>
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              if (user.coins < auditionFee) return alert("コインが足りません");
              useGame.getState().spendCoins(auditionFee);
              setRefreshKey((x) => x + 1);
            }}
          >
            ↻ 更新
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
        {candidates.map((c) => (
          <IdolCard
            key={c.id}
            idol={c}
            right={
              <div className="flex flex-col items-end gap-1">
                <div className="text-xs opacity-80">Score {c.auditionScore}</div>
                <button
                  className="btn-primary !text-xs !py-1 !px-3"
                  onClick={() => {
                    if (signIdol(c, c.cost)) alert(`${c.stageName} と契約しました`);
                    else alert("コインが足りません");
                  }}
                >
                  契約 ♦{c.cost}
                </button>
              </div>
            }
          />
        ))}
      </div>
    </main>
  );
}
