"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import type { Group } from "@/lib/types";

/**
 * 「今週のトップ」掲示板。
 * - ログイン後、1日1回だけモーダルで提示 (localStorage で当日キーを記録)。
 * - ホーム画面の街中にはボタンでもう一度開けるように掲示板タイルも用意する (別エクスポート)。
 */

const LS_KEY = "rtf_weekly_top_last";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function WeeklyTopAutoModal() {
  const { groups, user, toggleBiasGroup } = useGame();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const last = localStorage.getItem(LS_KEY);
      if (last !== todayKey()) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [user]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(LS_KEY, todayKey());
    } catch {}
  }

  if (!open || !user) return null;

  const top = [...groups]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);

  return (
    <WeeklyTopBody
      groups={top}
      biasGroupIds={user.biasGroupIds}
      onToggle={(gid) => {
        const r = toggleBiasGroup(gid);
        if (!r.ok && r.reason) alert(r.reason);
      }}
      onClose={close}
    />
  );
}

/** ユーザーが掲示板ボタンを押したときに開く手動版 */
export function WeeklyTopManual({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { groups, user, toggleBiasGroup } = useGame();
  if (!open || !user) return null;

  const top = [...groups]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3);

  return (
    <WeeklyTopBody
      groups={top}
      biasGroupIds={user.biasGroupIds}
      onToggle={(gid) => {
        const r = toggleBiasGroup(gid);
        if (!r.ok && r.reason) alert(r.reason);
      }}
      onClose={onClose}
    />
  );
}

function WeeklyTopBody({
  groups,
  biasGroupIds,
  onToggle,
  onClose,
}: {
  groups: Group[];
  biasGroupIds: string[];
  onToggle: (gid: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[600] bg-black/80 backdrop-blur flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-[min(92vw,560px)] max-h-[90vh] bg-kpanel rounded-3xl p-5 border border-white/10 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] opacity-60 tracking-[0.3em]">
              BULLETIN BOARD
            </div>
            <div className="font-display text-xl font-black bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent">
              今週のトップ3
            </div>
          </div>
          <button className="chip !bg-white/10" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {groups.map((g, i) => (
            <div
              key={g.id}
              className="relative rounded-2xl overflow-hidden border border-white/10 p-3"
              style={{
                background: `linear-gradient(135deg, ${g.colorA}, ${g.colorB})`,
              }}
            >
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative flex items-center gap-3">
                <div className="text-2xl font-black w-8 text-center">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base truncate">{g.name}</div>
                  <div className="text-[11px] opacity-80 truncate">
                    {g.concept} · POP {g.popularity}
                  </div>
                </div>
                <button
                  onClick={() => onToggle(g.id)}
                  className={`chip !text-xs shrink-0 ${
                    biasGroupIds.includes(g.id)
                      ? "!bg-kpink !text-white"
                      : "!bg-white/20"
                  }`}
                >
                  {biasGroupIds.includes(g.id) ? "★ 推し中" : "☆ 推す"}
                </button>
                <Link
                  href={`/fan/group/${g.id}`}
                  className="chip !bg-white/20 !text-xs shrink-0"
                  onClick={onClose}
                >
                  見る →
                </Link>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-ghost w-full mt-4" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
