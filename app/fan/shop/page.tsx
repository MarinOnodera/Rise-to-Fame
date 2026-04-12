"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { SHOP_GOODS } from "@/lib/economy";

export default function FanShop() {
  const router = useRouter();
  const { user, buyGoods } = useGame();
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);
  if (!user) return null;

  return (
    <main className="pb-24">
      <TopBar title="推しグッズ" back="/home" />
      <div className="p-4 grid grid-cols-2 gap-3">
        {SHOP_GOODS.map((g) => (
          <div key={g.id} className="card flex flex-col items-center gap-2">
            <div className="text-4xl">
              {g.id === "lightstick"
                ? "🔦"
                : g.id === "album"
                ? "💿"
                : g.id === "photocard"
                ? "🃏"
                : g.id === "poster"
                ? "🪧"
                : "👕"}
            </div>
            <div className="text-sm font-bold text-center">{g.name}</div>
            <div className="text-xs opacity-70">
              所持 {user.ownedGoods[g.id] ?? 0}
            </div>
            <button
              className="btn-primary !px-3 !py-1.5 !text-xs"
              onClick={() => {
                if (buyGoods(g.id, g.coins)) alert(`${g.name} を購入`);
                else alert("コインが足りません");
              }}
            >
              ♦ {g.coins.toLocaleString()}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
