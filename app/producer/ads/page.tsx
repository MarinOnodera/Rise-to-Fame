"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { AD_DURATION_DAYS, AD_SLOT_PRICES } from "@/lib/economy";

export default function AdsPage() {
  const router = useRouter();
  const { user, groups, ads, buyAdSlot } = useGame();
  const [pickedAd, setPickedAd] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [tagline, setTagline] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  const myGroups = groups.filter((g) => g.agencyId === user.agencyId);
  const emptySlots = ads.filter((a) => a.empty);
  const mine = ads.filter((a) => a.ownerAgencyId === user.agencyId);

  return (
    <main className="pb-24">
      <TopBar title="街の広告スロット" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card text-[11px] opacity-70 leading-5">
          ビルボード ♦{AD_SLOT_PRICES.billboard.toLocaleString()} / 路面店 ♦{AD_SLOT_PRICES.shop.toLocaleString()} / バス ♦{AD_SLOT_PRICES.bus.toLocaleString()}（掲載期間 {AD_DURATION_DAYS}日）
        </div>

        <div className="card">
          <div className="font-bold mb-2">空きスロット ({emptySlots.length})</div>
          <div className="flex flex-col gap-2">
            {emptySlots.map((a) => (
              <button
                key={a.id}
                onClick={() => setPickedAd(a.id)}
                className={`card !p-3 text-left flex justify-between items-center ${
                  pickedAd === a.id ? "ring-2 ring-kpink" : ""
                }`}
              >
                <div>
                  <div className="font-bold text-sm">{a.placement}</div>
                  <div className="text-[11px] opacity-70">
                    位置 x={Math.round(a.x * 100)}% / 料金 ♦{AD_SLOT_PRICES[a.placement].toLocaleString()}
                  </div>
                </div>
                <span className="chip">選ぶ</span>
              </button>
            ))}
            {emptySlots.length === 0 && (
              <div className="text-xs opacity-70">空きスロットはありません</div>
            )}
          </div>
        </div>

        {pickedAd && (
          <div className="card">
            <div className="font-bold mb-2">広告内容</div>
            <div className="flex flex-col gap-2">
              <select
                className="input"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">— 宣伝するグループを選ぶ —</option>
                {myGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="ブランド名 (例: LUNE)"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
              <input
                className="input"
                placeholder="商品名 (例: ベルベットティント)"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
              <input
                className="input"
                placeholder="キャッチコピー"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!groupId || !brand || !product}
                onClick={() => {
                  const r = buyAdSlot(pickedAd, groupId, brand, product, tagline);
                  if (!r.ok) return alert(r.reason ?? "失敗");
                  alert("広告を掲載しました");
                  setPickedAd(null);
                  setBrand(""); setProduct(""); setTagline(""); setGroupId("");
                }}
              >
                掲載する
              </button>
            </div>
          </div>
        )}

        {mine.length > 0 && (
          <div className="card">
            <div className="font-bold mb-2">掲載中</div>
            <div className="flex flex-col gap-1">
              {mine.map((a) => (
                <div key={a.id} className="text-xs opacity-80 flex justify-between">
                  <span>
                    {a.brand} / {a.product}
                  </span>
                  <span>
                    〜{a.expiresAt?.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
