"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import {
  AD_DURATION_DAYS,
  AD_SLOT_PRICES,
  PHOTOSHOOT_COSTS,
  PHOTOSHOOT_LABELS,
} from "@/lib/economy";
import type { AdPhotoMood } from "@/lib/types";

/**
 * 街の広告スロット購入画面 (2ステップ)。
 * Step 1: 写真撮影で広告素材を 1 つ作る (mood 選択)。
 * Step 2: 空きスロットに素材を貼って掲載 (1 アセット = 1 掲載)。
 */
export default function AdsPage() {
  const router = useRouter();
  const { user, groups, idols, ads, buyAdSlot, bookPhotoShoot } = useGame();

  // Step1 (撮影)
  const [shootIdolId, setShootIdolId] = useState("");
  const [shootMood, setShootMood] = useState<AdPhotoMood>("cool");
  const [shootCaption, setShootCaption] = useState("");

  // Step2 (掲載)
  const [pickedAdId, setPickedAdId] = useState<string | null>(null);
  const [pickedAssetId, setPickedAssetId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [tagline, setTagline] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  const myGroups = useMemo(
    () => groups.filter((g) => g.agencyId === user?.agencyId),
    [groups, user?.agencyId]
  );
  const myIdols = useMemo(
    () =>
      idols.filter(
        (i) =>
          i.debuted &&
          i.groupId &&
          myGroups.some((g) => g.id === i.groupId)
      ),
    [idols, myGroups]
  );
  const myAssets = useMemo(
    () => (user?.adAssets ?? []).filter((a) => !a.used),
    [user?.adAssets]
  );

  if (!user?.agencyId) return null;

  const emptySlots = ads.filter((a) => a.empty);
  const mine = ads.filter((a) => a.ownerAgencyId === user.agencyId);

  // 選択中の素材から、宣伝対象グループを自動で決める (整合性チェック簡略化)
  const pickedAsset = myAssets.find((a) => a.id === pickedAssetId);
  const autoGroupId = pickedAsset?.groupId ?? "";
  const finalGroupId = autoGroupId || groupId;

  function handleShoot() {
    if (!shootIdolId) return;
    const r = bookPhotoShoot(shootIdolId, shootMood, shootCaption || undefined);
    if (!r.ok) {
      alert(r.reason ?? "撮影に失敗しました");
      return;
    }
    alert(`✨ 撮影完了 (mood: ${PHOTOSHOOT_LABELS[shootMood]})`);
    setShootCaption("");
    if (r.asset) setPickedAssetId(r.asset.id);
  }

  function handleBuy() {
    if (!pickedAdId || !pickedAssetId) return;
    const r = buyAdSlot(pickedAdId, finalGroupId, brand, product, tagline, pickedAssetId);
    if (!r.ok) {
      alert(r.reason ?? "掲載に失敗しました");
      return;
    }
    alert("📣 広告を掲載しました (掲載期間 1週間)");
    setPickedAdId(null);
    setPickedAssetId(null);
    setBrand("");
    setProduct("");
    setTagline("");
    setGroupId("");
  }

  return (
    <main className="pb-24">
      <TopBar title="街の広告スロット" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card text-[11px] opacity-70 leading-5">
          掲載前に必ず <b>広告撮影</b> が必要です。撮った素材は 1 度だけ街に貼れます。
          <br />
          ビルボード ♦{AD_SLOT_PRICES.billboard.toLocaleString()} / 路面店 ♦
          {AD_SLOT_PRICES.shop.toLocaleString()} / バス ♦
          {AD_SLOT_PRICES.bus.toLocaleString()}（掲載期間 {AD_DURATION_DAYS}日）
          <br />
          使用済み素材は <b>写真館</b> に展示され、ファンが入場料で閲覧できます。
        </div>

        {/* Step 1: 撮影 */}
        <div className="card">
          <div className="font-bold mb-2">① 広告撮影 (素材を作る)</div>
          <div className="flex flex-col gap-2">
            <select
              className="input"
              value={shootIdolId}
              onChange={(e) => setShootIdolId(e.target.value)}
            >
              <option value="">— 撮影するアイドル —</option>
              {myIdols.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.stageName} / 疲労 {i.fatigue} / 人気 {i.popularity}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {(["cute", "cool", "edgy", "dreamy"] as AdPhotoMood[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setShootMood(m)}
                  className={`card !p-2 text-left ${
                    shootMood === m ? "ring-2 ring-kpink" : ""
                  }`}
                >
                  <div className="font-bold text-sm">
                    {PHOTOSHOOT_LABELS[m]}
                  </div>
                  <div className="text-[11px] opacity-70">
                    ♦{PHOTOSHOOT_COSTS[m].toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="ヘッドライン (空欄ならAIが提案)"
              value={shootCaption}
              onChange={(e) => setShootCaption(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={!shootIdolId}
              onClick={handleShoot}
            >
              📸 撮影する (♦{PHOTOSHOOT_COSTS[shootMood].toLocaleString()})
            </button>
          </div>
        </div>

        {/* 未使用素材 */}
        <div className="card">
          <div className="font-bold mb-2">
            未使用の素材 ({myAssets.length})
          </div>
          {myAssets.length === 0 && (
            <div className="text-xs opacity-70">
              まだ素材がありません。先に撮影してください。
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {myAssets.map((a) => {
              const idol = idols.find((i) => i.id === a.idolId);
              return (
                <button
                  key={a.id}
                  onClick={() => setPickedAssetId(a.id)}
                  className={`card !p-2 text-left ${
                    pickedAssetId === a.id ? "ring-2 ring-kgold" : ""
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${a.colorA}, ${a.colorB})`,
                  }}
                >
                  <div className="text-[10px] opacity-90 tracking-wider">
                    {PHOTOSHOOT_LABELS[a.mood].toUpperCase()}
                  </div>
                  <div className="text-sm font-black truncate">
                    {idol?.stageName ?? "—"}
                  </div>
                  <div className="text-[10px] opacity-90 line-clamp-2">
                    “{a.caption}”
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: 空きスロット選択 */}
        <div className="card">
          <div className="font-bold mb-2">② 空きスロット ({emptySlots.length})</div>
          <div className="flex flex-col gap-2">
            {emptySlots.map((a) => (
              <button
                key={a.id}
                onClick={() => setPickedAdId(a.id)}
                className={`card !p-3 text-left flex justify-between items-center ${
                  pickedAdId === a.id ? "ring-2 ring-kpink" : ""
                }`}
              >
                <div>
                  <div className="font-bold text-sm">{a.placement}</div>
                  <div className="text-[11px] opacity-70">
                    位置 x={Math.round(a.x * 100)}% / 料金 ♦
                    {AD_SLOT_PRICES[a.placement].toLocaleString()}
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

        {pickedAdId && pickedAssetId && (
          <div className="card">
            <div className="font-bold mb-2">③ 広告内容を入力</div>
            <div className="flex flex-col gap-2">
              {!autoGroupId && (
                <select
                  className="input"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">— 宣伝するグループ —</option>
                  {myGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              {autoGroupId && (
                <div className="text-[11px] opacity-70">
                  素材から自動選択:{" "}
                  <b>
                    {groups.find((g) => g.id === autoGroupId)?.name ?? "—"}
                  </b>
                </div>
              )}
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
                disabled={!finalGroupId || !brand || !product}
                onClick={handleBuy}
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
                <div
                  key={a.id}
                  className="text-xs opacity-80 flex justify-between"
                >
                  <span>
                    {a.brand} / {a.product}
                  </span>
                  <span>〜{a.expiresAt?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
