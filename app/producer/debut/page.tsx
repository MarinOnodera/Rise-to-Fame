"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolCard } from "@/components/IdolCard";

export default function Debut() {
  const router = useRouter();
  const { user, idols, debutGroup } = useGame();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);
  if (!user?.agencyId) return null;

  const mine = idols.filter(
    (i) => i.ownerId === user.agencyId && !i.debuted
  );

  const pickedList = mine.filter((i) => picked.has(i.id));
  const sameGender = pickedList.every(
    (i) => i.gender === pickedList[0]?.gender
  );

  const canDebut =
    pickedList.length >= 3 &&
    sameGender &&
    name.trim().length >= 2 &&
    concept.trim().length >= 2;

  return (
    <main className="pb-24">
      <TopBar title="グループ結成" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card">
          <div className="text-xs opacity-70">
            3名以上を同性別で選び、グループ名とコンセプトを決めてデビューさせましょう。
            ファンは「売れていない頃」から応援できるようになります。
          </div>
        </div>
        <div className="card flex flex-col gap-2">
          <input className="input" placeholder="グループ名" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="コンセプト (例: Dark Fairy Pop)" value={concept} onChange={(e) => setConcept(e.target.value)} />
        </div>
        {mine.length === 0 && (
          <div className="card text-sm opacity-70">
            デビュー前のアイドルがいません。
          </div>
        )}
        {mine.map((i) => (
          <IdolCard
            key={i.id}
            idol={i}
            active={picked.has(i.id)}
            onClick={() => {
              const s = new Set(picked);
              if (s.has(i.id)) s.delete(i.id);
              else s.add(i.id);
              setPicked(s);
            }}
          />
        ))}
        <button
          className="btn-primary"
          disabled={!canDebut}
          onClick={() => {
            debutGroup(Array.from(picked), name.trim(), concept.trim());
            alert(`${name} がデビューしました！`);
            router.push("/producer");
          }}
        >
          デビューさせる
        </button>
        {!sameGender && pickedList.length > 0 && (
          <div className="text-xs text-kpink">同性別のみで構成してください</div>
        )}
      </div>
    </main>
  );
}
