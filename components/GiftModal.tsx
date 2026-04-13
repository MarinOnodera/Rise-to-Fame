"use client";

import { useState } from "react";
import { GIFTS } from "@/lib/economy";
import { useGame } from "@/lib/store";

export function GiftModal({
  idolId,
  idolName,
  onClose,
}: {
  idolId: string;
  idolName: string;
  onClose: () => void;
}) {
  const { user, sendGift } = useGame();
  const [flash, setFlash] = useState<{ emoji: string; color: string } | null>(
    null
  );
  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-[800] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-kpanel w-full sm:w-[440px] max-h-[85vh] overflow-auto rounded-t-3xl sm:rounded-3xl p-4 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs opacity-70">{idolName} に贈る</div>
            <div className="text-lg font-black">ギフト</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">所持</div>
            <div className="font-bold text-kgold">♦ {user.coins.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {GIFTS.map((g) => {
            const ok = user.coins >= g.coins;
            return (
              <button
                key={g.id}
                disabled={!ok}
                className="card !p-3 flex flex-col items-center gap-1 text-center disabled:opacity-40"
                style={{
                  borderColor: g.color,
                  boxShadow: ok ? `0 0 14px ${g.color}33` : "none",
                }}
                onClick={() => {
                  const r = sendGift(g.id, idolId);
                  if (!r.ok) {
                    alert(r.reason ?? "贈れませんでした");
                    return;
                  }
                  setFlash({ emoji: g.emoji, color: g.color });
                  setTimeout(() => setFlash(null), 1100);
                }}
              >
                <div className="text-3xl">{g.emoji}</div>
                <div className="text-[11px] font-bold">
                  Lv{g.level} {g.name}
                </div>
                <div className="text-[10px] opacity-70">♦ {g.coins.toLocaleString()}</div>
                <div className="text-[10px] text-kgold">POP +{g.popGain}</div>
              </button>
            );
          })}
        </div>

        <button className="btn-ghost mt-3 w-full" onClick={onClose}>
          閉じる
        </button>
      </div>

      {flash && (
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 900 }}
        >
          <div
            className="text-[140px]"
            style={{
              filter: `drop-shadow(0 0 24px ${flash.color})`,
              animation: "giftpop 1.0s ease-out forwards",
            }}
          >
            {flash.emoji}
          </div>
          <style jsx>{`
            @keyframes giftpop {
              0% {
                transform: scale(0.2) translateY(40px);
                opacity: 0;
              }
              30% {
                transform: scale(1.2) translateY(-10px);
                opacity: 1;
              }
              100% {
                transform: scale(1.5) translateY(-40px);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
