"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBuddy } from "@/lib/buddy/store";
import { getCharacter } from "@/lib/buddy/characters";
import type { BuddySession, MoodLevel } from "@/lib/buddy/types";

const MOOD_LABEL: Record<MoodLevel, { label: string; emoji: string; color: string }> = {
  very_low: { label: "とてもしんどそう", emoji: "🌧", color: "bg-rose-200 text-rose-700" },
  low: { label: "ちょっと元気がない", emoji: "☁️", color: "bg-amber-200 text-amber-800" },
  okay: { label: "ふつう", emoji: "🌤", color: "bg-slate-200 text-slate-700" },
  good: { label: "元気そう", emoji: "☀️", color: "bg-emerald-200 text-emerald-800" },
  very_good: { label: "とても元気", emoji: "🌈", color: "bg-violet-200 text-violet-800" },
};

export default function ParentPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    parentPinHash,
    setParentPin,
    verifyParentPin,
    sessions,
    deleteSession,
    childName,
  } = useBuddy();

  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupPin2, setSetupPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // 新しい順
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions]
  );

  if (!hydrated) {
    return <div className="min-h-screen bg-gradient-to-b from-slate-50 to-rose-50" />;
  }

  // === 初回 PIN 設定 ===
  if (!parentPinHash) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-rose-50 to-pink-50 text-slate-800">
        <div className="mx-auto max-w-md px-5 pt-10 pb-24">
          <Link href="/buddy" className="text-sm text-rose-400">
            ← もどる
          </Link>
          <h1 className="mt-3 text-2xl font-black text-slate-700">
            おうちの人 ようこそ
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            お子さまの様子をここで確認できます。最初に 4 桁の PIN を決めてください。
            お子さまには見せないようにしてください。
          </p>
          <div className="mt-6 rounded-2xl bg-white/90 p-5 shadow-sm border border-white/70 space-y-3">
            <label className="text-sm font-bold text-slate-700">
              新しい PIN (4 桁の数字)
            </label>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={setupPin}
              onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 outline-none focus:border-rose-300 tracking-widest text-center text-xl"
              placeholder="••••"
            />
            <label className="text-sm font-bold text-slate-700">
              もういちど
            </label>
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={setupPin2}
              onChange={(e) => setSetupPin2(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 outline-none focus:border-rose-300 tracking-widest text-center text-xl"
              placeholder="••••"
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <button
              onClick={() => {
                if (!/^\d{4}$/.test(setupPin)) {
                  setError("4 桁の数字を入れてください");
                  return;
                }
                if (setupPin !== setupPin2) {
                  setError("2 つの PIN が違います");
                  return;
                }
                setParentPin(setupPin);
                setError(null);
                setUnlocked(true);
              }}
              className="w-full rounded-full bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold py-3 shadow"
            >
              この PIN にする
            </button>
          </div>
        </div>
      </main>
    );
  }

  // === PIN 入力ロック ===
  if (!unlocked) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-rose-50 to-pink-50 text-slate-800">
        <div className="mx-auto max-w-md px-5 pt-10 pb-24">
          <Link href="/buddy" className="text-sm text-rose-400">
            ← もどる
          </Link>
          <h1 className="mt-3 text-2xl font-black text-slate-700">
            おうちの人 専用
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            設定した 4 桁 PIN を入れてください。
          </p>
          <div className="mt-6 rounded-2xl bg-white/90 p-5 shadow-sm border border-white/70 space-y-3">
            <input
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setError(null);
                setPinInput(e.target.value.replace(/\D/g, ""));
              }}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 outline-none focus:border-rose-300 tracking-widest text-center text-2xl"
              placeholder="••••"
              autoFocus
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <button
              onClick={() => {
                if (verifyParentPin(pinInput)) {
                  setUnlocked(true);
                  setPinInput("");
                  setError(null);
                } else {
                  setError("PIN が違います");
                }
              }}
              className="w-full rounded-full bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold py-3 shadow"
            >
              ひらく
            </button>
          </div>
        </div>
      </main>
    );
  }

  // === ダッシュボード ===
  const urgent = sorted.filter((s) => s.summary?.flags.urgent);
  const open: BuddySession | null = openId
    ? sorted.find((s) => s.id === openId) ?? null
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-rose-50 to-pink-50 text-slate-800">
      <div className="mx-auto max-w-md px-5 pt-8 pb-24">
        <div className="flex items-center justify-between">
          <Link href="/buddy" className="text-sm text-rose-400">
            ← もどる
          </Link>
          <button
            onClick={() => setUnlocked(false)}
            className="text-xs text-slate-500 underline"
          >
            ロック
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-700">
          {childName || "お子さま"} の ようす
        </h1>
        <p className="text-sm text-slate-500">
          おしゃべりの自動メモ ({sorted.length} 件)
        </p>

        {urgent.length > 0 && (
          <div className="mt-5 rounded-2xl bg-rose-100 border border-rose-300 p-4">
            <p className="font-bold text-rose-700">
              ⚠ 注意の必要な会話があります ({urgent.length} 件)
            </p>
            <p className="text-xs text-rose-700 mt-1">
              赤ラベルのセッションをご確認ください。必要に応じてお子さまに声をかけたり、
              スクールカウンセラー・かかりつけ医・よりそいホットライン
              (0120-279-338 / 24時間・無料) などにご相談ください。
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {sorted.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">
              まだ おしゃべりの きろくが ありません
            </p>
          )}
          {sorted.map((s) => {
            const c = getCharacter(s.characterId);
            const sum = s.summary;
            const m = sum ? MOOD_LABEL[sum.mood] : null;
            const flagLabels = sum
              ? [
                  sum.flags.urgent ? "至急" : null,
                  sum.flags.bullying ? "いじめ" : null,
                  sum.flags.family ? "家族" : null,
                  sum.flags.school ? "学校" : null,
                  sum.flags.body ? "体調" : null,
                  sum.flags.prolongedSadness ? "悲しみ続く" : null,
                ].filter(Boolean) as string[]
              : [];
            return (
              <button
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className={`w-full text-left rounded-2xl p-4 border shadow-sm transition active:scale-[0.99] ${
                  sum?.flags.urgent
                    ? "bg-rose-50 border-rose-300"
                    : "bg-white/90 border-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700">
                    {c?.name ?? "?"} ・{" "}
                    {new Date(s.startedAt).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {m && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.color}`}
                    >
                      {m.emoji} {m.label}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                  {sum?.parentNote ??
                    (s.messages.length === 0
                      ? "(まだ何も話していません)"
                      : "(まだ要約されていません。会話を「おしまい」にすると自動でメモができます)")}
                </p>
                {flagLabels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {flagLabels.map((f) => (
                      <span
                        key={f}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          f === "至急"
                            ? "bg-rose-500 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-slate-400">
                  メッセージ {s.messages.length} 件 — タップで全文を見る
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-black text-slate-700">
                {getCharacter(open.characterId)?.name ?? "?"} との おしゃべり
              </p>
              <button
                onClick={() => setOpenId(null)}
                className="text-slate-400 text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {new Date(open.startedAt).toLocaleString("ja-JP")}
            </p>

            {open.summary ? (
              <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-100 p-3">
                <p className="text-xs font-bold text-rose-600">自動メモ</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                  {open.summary.parentNote}
                </p>
                {open.summary.flags.urgent && open.summary.flags.urgentReason && (
                  <div className="mt-3 rounded-xl bg-rose-500 text-white p-3 text-sm">
                    <p className="font-bold">⚠ 至急の確認をおすすめします</p>
                    <p className="mt-1">{open.summary.flags.urgentReason}</p>
                  </div>
                )}
                <Detail title="話題" items={open.summary.topics} />
                <Detail title="うれしかったこと" items={open.summary.happy} />
                <Detail title="気になっていたこと" items={open.summary.worries} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-400">
                このセッションはまだ要約されていません。
              </p>
            )}

            <div className="mt-5">
              <p className="text-xs font-bold text-slate-500 mb-2">
                会話の全文 ({open.messages.length} 件)
              </p>
              <div className="space-y-2">
                {open.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-rose-100 text-rose-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <p className="text-[10px] font-bold opacity-60 mb-0.5">
                      {m.role === "user" ? childName || "お子さま" : getCharacter(open.characterId)?.name}
                    </p>
                    {m.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  if (confirm("この会話の記録を削除しますか?")) {
                    deleteSession(open.id);
                    setOpenId(null);
                  }
                }}
                className="flex-1 text-sm font-semibold text-rose-500 underline"
              >
                この記録を消す
              </button>
              <button
                onClick={() => setOpenId(null)}
                className="flex-1 rounded-full bg-slate-700 text-white font-bold py-2"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold text-slate-500">{title}</p>
      <ul className="mt-1 list-disc list-inside text-sm text-slate-700 space-y-0.5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
