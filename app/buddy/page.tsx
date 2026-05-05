"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBuddy } from "@/lib/buddy/store";
import { getCharacter } from "@/lib/buddy/characters";
import { FluffyAvatar } from "@/components/buddy/FluffyAvatar";

export default function BuddyHome() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const { selectedCharacterId, childName, sessions, parentPinHash } =
    useBuddy();
  const buddy = getCharacter(selectedCharacterId);

  if (!hydrated) {
    return <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-100" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50 text-slate-800">
      <div className="mx-auto max-w-md px-5 pt-10 pb-24">
        <h1 className="text-center font-black text-3xl text-rose-500 drop-shadow-sm">
          もこもこフレンド
        </h1>
        <p className="text-center text-sm text-slate-500 mt-1">
          おしゃべりすると、こころが軽くなるよ
        </p>

        <div className="mt-10 flex flex-col items-center">
          {buddy ? (
            <>
              <FluffyAvatar character={buddy} size={180} bouncing />
              <p className="mt-5 text-lg font-bold">
                {buddy.name}
                {childName ? ` と ${childName}` : ""} のおしゃべり
              </p>
              <p className="mt-1 text-xs text-slate-500 text-center px-4">
                {buddy.vibe}
              </p>

              <Link
                href="/buddy/chat"
                className="mt-8 w-full text-center rounded-full bg-gradient-to-r from-rose-400 to-pink-400 text-white font-bold py-4 shadow-lg active:scale-95 transition"
              >
                おしゃべりする
              </Link>
              <Link
                href="/buddy/select"
                className="mt-3 w-full text-center rounded-full bg-white/80 text-rose-500 font-semibold py-3 border border-rose-200 active:scale-95 transition"
              >
                おともだちを かえる
              </Link>
            </>
          ) : (
            <>
              <div className="w-44 h-44 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 shadow-inner flex items-center justify-center text-5xl">
                ☁️
              </div>
              <p className="mt-6 text-base text-slate-600 text-center">
                さいしょに、おしゃべりするおともだちを えらんでね
              </p>
              <Link
                href="/buddy/select"
                className="mt-6 w-full text-center rounded-full bg-gradient-to-r from-rose-400 to-pink-400 text-white font-bold py-4 shadow-lg active:scale-95 transition"
              >
                はじめる
              </Link>
            </>
          )}
        </div>

        <div className="mt-12 rounded-2xl bg-white/70 backdrop-blur p-4 border border-white/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">おうちの人へ</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {parentPinHash
                  ? "きょうの ようすを みられます"
                  : "PIN を きめて メモを みられるようにしよう"}
              </p>
            </div>
            <Link
              href="/buddy/parent"
              className="text-sm font-semibold text-rose-500 underline"
            >
              ひらく →
            </Link>
          </div>
          {sessions.length > 0 && (
            <p className="mt-3 text-[11px] text-slate-400">
              これまでの おしゃべり: {sessions.length} かい
            </p>
          )}
        </div>
      </div>

      {/* バウンスアニメ (Tailwind keyframes 拡張なしでもインラインで効くように) */}
      <style jsx global>{`
        @keyframes buddyBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
      `}</style>
    </main>
  );
}
