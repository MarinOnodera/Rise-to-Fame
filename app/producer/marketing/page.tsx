"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { MARKETING_OPTIONS } from "@/lib/economy";
import { IdolCard } from "@/components/IdolCard";

type Scope = "group" | "individual";

export default function Marketing() {
  const router = useRouter();
  const { user, groups, idols, runMarketing } = useGame();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [option, setOption] = useState(MARKETING_OPTIONS[0].id);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  const myGroups = useMemo(
    () => groups.filter((g) => g.agencyId === user?.agencyId),
    [groups, user]
  );

  if (!user?.agencyId) return null;

  const selectedGroup = myGroups.find((g) => g.id === groupId);
  const selectedMembers = selectedGroup
    ? idols.filter((i) => selectedGroup.memberIds.includes(i.id) && i.debuted)
    : [];
  const opt = MARKETING_OPTIONS.find((m) => m.id === option)!;

  const targetIds =
    scope === "group"
      ? selectedMembers.map((i) => i.id)
      : Array.from(picked);
  const totalCost = opt.cost * Math.max(1, targetIds.length);

  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPicked(s);
  };

  // Step 1: グループ未選択
  if (!groupId) {
    return (
      <main className="pb-24">
        <TopBar title="マーケティング" back="/producer" />
        <div className="p-4 flex flex-col gap-3">
          {myGroups.length === 0 ? (
            <div className="card text-sm opacity-80">
              デビュー済みのグループがありません。まずはグループを結成・デビューさせてください。
            </div>
          ) : (
            <>
              <div className="card">
                <div className="font-bold mb-1">グループを選ぶ</div>
                <div className="text-[11px] opacity-70 mb-2">
                  マーケティングはデビュー済みのグループ/所属メンバーが対象です
                </div>
                <div className="flex flex-col gap-2">
                  {myGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGroupId(g.id)}
                      className="card !p-3 text-left flex justify-between items-center"
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
            </>
          )}
        </div>
      </main>
    );
  }

  // Step 2: スコープ未選択
  if (!scope) {
    return (
      <main className="pb-24">
        <TopBar title={`マーケ / ${selectedGroup?.name ?? ""}`} back="/producer" />
        <div className="p-4 flex flex-col gap-3">
          <button className="btn-ghost" onClick={() => setGroupId(null)}>
            ← グループを選び直す
          </button>
          <button
            className="card !p-4 text-left"
            onClick={() => setScope("group")}
          >
            <div className="text-2xl mb-1">👯</div>
            <div className="font-bold">グループ全体</div>
            <div className="text-[11px] opacity-70">
              デビュー済みメンバー {selectedMembers.length} 名に一斉適用
            </div>
          </button>
          <button
            className="card !p-4 text-left"
            onClick={() => setScope("individual")}
          >
            <div className="text-2xl mb-1">🎯</div>
            <div className="font-bold">個人単位</div>
            <div className="text-[11px] opacity-70">
              メンバーを個別に選んで施策
            </div>
          </button>
        </div>
      </main>
    );
  }

  // Step 3: 施策選択 + 実行
  return (
    <main className="pb-24">
      <TopBar title={`マーケ / ${selectedGroup?.name ?? ""}`} back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <button
          className="btn-ghost"
          onClick={() => {
            setScope(null);
            setPicked(new Set());
          }}
        >
          ← 対象を選び直す
        </button>

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
                <div className="text-[11px] opacity-70">
                  ♦{m.cost} / +{m.popGain}pop
                </div>
              </button>
            ))}
          </div>
          <div className="text-[11px] opacity-70 mt-2">{opt.desc}</div>
        </div>

        {scope === "individual" && (
          <div className="card">
            <div className="font-bold">メンバーを選ぶ</div>
            <div className="text-[11px] opacity-70 mb-2">
              合計コスト ♦ {totalCost.toLocaleString()}
            </div>
            <div className="flex flex-col gap-2">
              {selectedMembers.map((i) => (
                <IdolCard
                  key={i.id}
                  idol={i}
                  active={picked.has(i.id)}
                  onClick={() => toggle(i.id)}
                />
              ))}
            </div>
          </div>
        )}

        {scope === "group" && (
          <div className="card">
            <div className="font-bold">対象: {selectedGroup?.name} 全員</div>
            <div className="text-[11px] opacity-70">
              合計コスト ♦ {totalCost.toLocaleString()}（{selectedMembers.length}人）
            </div>
          </div>
        )}

        <button
          className="btn-primary w-full"
          disabled={targetIds.length === 0}
          onClick={() => {
            if (
              runMarketing(
                targetIds,
                opt.id,
                totalCost,
                opt.popGain,
                opt.fatigue
              )
            ) {
              alert(`${opt.name} を実施しました`);
              setPicked(new Set());
              setScope(null);
            } else alert("コインが足りません");
          }}
        >
          実行する
        </button>
      </div>
    </main>
  );
}
