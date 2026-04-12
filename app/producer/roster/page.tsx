"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolCard } from "@/components/IdolCard";
import { IdolFace } from "@/components/IdolFace";

const TRAIN_KINDS: ("vocal" | "dance" | "rap" | "visual" | "stamina")[] = [
  "vocal",
  "dance",
  "rap",
  "visual",
  "stamina",
];

export default function Roster() {
  const router = useRouter();
  const { user, idols, trainIdol } = useGame();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  const mine = idols.filter((i) => i.ownerId === user.agencyId);
  const target = mine.find((i) => i.id === selected) ?? mine[0];

  return (
    <main className="pb-24">
      <TopBar title="ロスター" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        {mine.length === 0 && (
          <div className="card text-sm opacity-70">
            まだアイドルがいません。オーディションから連れてきましょう。
          </div>
        )}
        {mine.map((i) => (
          <IdolCard
            key={i.id}
            idol={i}
            active={target?.id === i.id}
            onClick={() => setSelected(i.id)}
          />
        ))}

        {target && (
          <div className="card mt-2">
            <div className="flex gap-3 items-center">
              <IdolFace face={target.face} size={72} />
              <div>
                <div className="font-bold">{target.stageName}</div>
                <div className="text-xs opacity-70">
                  {target.name} / {target.country} / {target.age}歳
                </div>
                <div className="text-[11px] opacity-60 mt-1">
                  疲労 {target.fatigue} / モラル {target.morale} / 人気 {target.popularity}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs opacity-70 mb-1">性格（AI応答の土台）</div>
              <div className="flex flex-wrap gap-1">
                {target.personality.map((p) => (
                  <span key={p} className="chip !text-[10px]">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {TRAIN_KINDS.map((k) => (
                <button
                  key={k}
                  className="btn-ghost !text-xs !py-2"
                  onClick={() => {
                    if (trainIdol(target.id, k)) {
                      // feedback
                    } else alert("コイン不足");
                  }}
                >
                  {k.toUpperCase()} +  ♦80
                </button>
              ))}
            </div>
            <div className="text-[11px] opacity-60 mt-2">
              ※ 性格 hardworking の子は +1 伸びやすく、lazy の子は -1。
              プロデュースをサボれば売れません。
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
