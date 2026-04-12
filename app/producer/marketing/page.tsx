"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { MARKETING_OPTIONS } from "@/lib/economy";
import { IdolCard } from "@/components/IdolCard";

export default function Marketing() {
  const router = useRouter();
  const { user, idols, runMarketing } = useGame();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [option, setOption] = useState(MARKETING_OPTIONS[0].id);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  const mine = idols.filter((i) => i.ownerId === user.agencyId);
  const opt = MARKETING_OPTIONS.find((m) => m.id === option)!;
  const totalCost = opt.cost * Math.max(1, picked.size);

  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPicked(s);
  };

  return (
    <main className="pb-24">
      <TopBar title="マーケティング" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card">
          <div className="font-bold mb-1">施策を選ぶ</div>
          <div className="grid grid-cols-2 gap-2">
            {MARKETING_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setOption(m.id)}
                className={`card !p-2 text-left ${
                  option === m.id ? "ring-2 ring-kpink" : ""
                }`}
              >
                <div className="font-bold text-sm">{m.name}</div>
                <div className="text-[11px] opacity-70">♦{m.cost} / +{m.popGain}pop</div>
              </button>
            ))}
          </div>
          <div className="text-[11px] opacity-70 mt-2">{opt.desc}</div>
        </div>

        <div className="card">
          <div className="font-bold">対象アイドル（複数可）</div>
          <div className="text-[11px] opacity-70 mb-2">
            合計コスト ♦ {totalCost.toLocaleString()}
          </div>
          <div className="flex flex-col gap-2">
            {mine.map((i) => (
              <IdolCard
                key={i.id}
                idol={i}
                active={picked.has(i.id)}
                onClick={() => toggle(i.id)}
              />
            ))}
          </div>
          <button
            className="btn-primary w-full mt-3"
            disabled={picked.size === 0}
            onClick={() => {
              if (
                runMarketing(
                  Array.from(picked),
                  opt.id,
                  totalCost,
                  opt.popGain,
                  opt.fatigue
                )
              ) {
                alert(`${opt.name} を実施しました`);
                setPicked(new Set());
              } else alert("コインが足りません");
            }}
          >
            実行する
          </button>
        </div>
      </div>
    </main>
  );
}
