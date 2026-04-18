"use client";

/**
 * 写真館 (PhotoGallery)。
 * - 過去に広告として 1 度使用された AdCampaignAsset を閲覧専用で展示する。
 * - ファン側は ♦12 (10〜15 の中央値) の入場料を払うと当日 23:59 まで閲覧可能。
 * - ここで見た素材は再び広告に使えない (used=true 固定)。
 * - プロデューサー本人は入場料なしで自分のアルバムを見られる。
 */

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { PHOTOSHOOT_LABELS } from "@/lib/economy";

const ENTRY_FEE = 12; // ♦10〜15 の中央値

export default function GalleryPage() {
  const router = useRouter();
  const { user, idols, groups, payGalleryEntry } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  // プロデューサー本人 (自分の素材) は無料で、ファン側は入場料制
  const isOwner = !!user?.agencyId && (user?.adAssets ?? []).length > 0;

  const hasTicket = useMemo(() => {
    if (!user) return false;
    if (isOwner) return true;
    if (!user.galleryAccessUntil) return false;
    return new Date(user.galleryAccessUntil).getTime() > Date.now();
  }, [user, isOwner]);

  // 展示対象: 使用済みアセット。今は自分のストアにあるものだけ (AI fans は Phase G で追加)。
  const exhibits = useMemo(() => {
    const list = (user?.adAssets ?? []).filter((a) => a.used);
    // 新着順
    return list.sort(
      (a, b) =>
        new Date(b.usedAt ?? b.shotAt).getTime() -
        new Date(a.usedAt ?? a.shotAt).getTime()
    );
  }, [user?.adAssets]);

  if (!user) return null;

  function handlePay() {
    const r = payGalleryEntry(ENTRY_FEE);
    if (!r.ok) alert(r.reason ?? "入場に失敗しました");
  }

  return (
    <main className="pb-24">
      <TopBar title="📷 写真館" back="/home" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card text-[11px] leading-5 opacity-80">
          過去に街の広告で掲載された <b>1点モノ</b> のキャンペーン写真を閲覧できます。
          展示されている写真は広告として再利用できません。
          <br />
          ファン入場料: <b>♦{ENTRY_FEE}</b> (本日 23:59 まで入場可)
        </div>

        {!hasTicket && (
          <div className="card">
            <div className="font-bold mb-2">入場料</div>
            <div className="text-xs opacity-80 mb-3">
              ♦{ENTRY_FEE} を支払うと、本日中は何度でも入場できます。
            </div>
            <button className="btn-primary w-full" onClick={handlePay}>
              ♦{ENTRY_FEE} を払って入場する
            </button>
          </div>
        )}

        {hasTicket && (
          <>
            <div className="text-[11px] opacity-60">
              展示作品 {exhibits.length} 点
              {isOwner && " (あなたのアルバム)"}
            </div>
            {exhibits.length === 0 && (
              <div className="card text-xs opacity-70">
                まだ展示作品がありません。広告で 1 度使われた写真がここに並びます。
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {exhibits.map((a) => {
                const idol = idols.find((i) => i.id === a.idolId);
                const group = groups.find((g) => g.id === a.groupId);
                return (
                  <div
                    key={a.id}
                    className="rounded-xl overflow-hidden border border-white/10 shadow-glow"
                    style={{
                      background: `linear-gradient(135deg, ${a.colorA}, ${a.colorB})`,
                    }}
                  >
                    <div className="aspect-[3/4] flex flex-col justify-between p-3 text-white">
                      <div>
                        <div className="text-[9px] tracking-[0.25em] opacity-80">
                          {PHOTOSHOOT_LABELS[a.mood].toUpperCase()} ·{" "}
                          {new Date(a.usedAt ?? a.shotAt).toLocaleDateString()}
                        </div>
                        <div className="text-lg font-black truncate">
                          {idol?.stageName ?? "—"}
                        </div>
                        {group && (
                          <div className="text-[10px] opacity-80">
                            {group.name}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold italic leading-snug">
                          “{a.caption}”
                        </div>
                        {a.campaignBrand && (
                          <div className="text-[9px] opacity-75 mt-1">
                            CAMPAIGN: {a.campaignBrand}
                            {a.campaignProduct ? ` / ${a.campaignProduct}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
