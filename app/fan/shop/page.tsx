"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { SHOP_GOODS, type ShopGood } from "@/lib/economy";

const CATEGORIES: Array<{ id: ShopGood["category"] | "all"; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "essential", label: "必携" },
  { id: "collectible", label: "コレクション" },
  { id: "fashion", label: "ファッション" },
  { id: "living", label: "生活雑貨" },
  { id: "digital", label: "デジタル" },
];

export default function FanShop() {
  const router = useRouter();
  const { user, buyGoods } = useGame();
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["id"]>("all");

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const filtered = useMemo(
    () => (cat === "all" ? SHOP_GOODS : SHOP_GOODS.filter((g) => g.category === cat)),
    [cat]
  );

  if (!user) return null;

  return (
    <main className="pb-24">
      <TopBar title="推しグッズ" back="/home" />
      <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip whitespace-nowrap ${cat === c.id ? "!bg-kpink !text-white" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {filtered.map((g) => {
          const owned = user.ownedGoods[g.id] ?? 0;
          const ok = user.coins >= g.coins;
          return (
            <div key={g.id} className="card flex flex-col items-center gap-1">
              <div className="text-4xl">{g.emoji}</div>
              <div className="text-sm font-bold text-center leading-tight">{g.name}</div>
              {g.desc && (
                <div className="text-[10px] opacity-60 text-center leading-tight">
                  {g.desc}
                </div>
              )}
              <div className="text-[11px] opacity-70">所持 {owned}</div>
              <button
                className="btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-40"
                disabled={!ok}
                onClick={() => {
                  if (buyGoods(g.id, g.coins)) alert(`${g.name} を購入`);
                  else alert("コインが足りません");
                }}
              >
                ♦ {g.coins.toLocaleString()}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
