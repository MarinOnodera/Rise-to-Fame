"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { COIN_PRICES } from "@/lib/economy";

export default function CoinShop() {
  const router = useRouter();
  const { user, addCoins } = useGame();
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);
  if (!user) return null;

  return (
    <main className="pb-24">
      <TopBar title="コイン購入" back="/home" />
      <div className="p-4">
        <div className="card mb-4">
          <div className="text-sm font-bold">現在の残高</div>
          <div className="text-3xl font-black text-kgold">
            ♦ {user.coins.toLocaleString()}
          </div>
          <div className="text-[11px] opacity-60 mt-1">
            連続ログイン {user.streak} 日目 / アプリ登録時 500 コイン付与済
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COIN_PRICES.map((p) => (
            <button
              key={p.id}
              className="card flex flex-col items-center gap-1"
              onClick={() => {
                // 本番は Apple/Google IAP / Stripe 等に接続。ここでは模擬。
                if (confirm(`${p.jpy} 円で ♦${p.coins} コインを購入しますか？（模擬）`)) {
                  addCoins(p.coins);
                }
              }}
            >
              <div className="text-3xl">♦</div>
              <div className="font-black text-lg">
                {p.coins.toLocaleString()}
              </div>
              <div className="text-[11px] opacity-70">¥{p.jpy}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 card text-[11px] opacity-70 leading-relaxed">
          ※ コインは現実のお金で購入してください。アプリ登録時や連続ログインで
          無料配布されるぶんもありますが、課金でより大きく応援できます。
        </div>
      </div>
    </main>
  );
}
