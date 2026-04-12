"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import { IdolFace } from "./IdolFace";
import type { CityAd, Idol } from "@/lib/types";

const PRODUCT_ICON: Record<string, string> = {
  cosmetic: "💄",
  tech: "📱",
  fashion: "👗",
  cafe: "🥤",
  food: "🍜",
  drink: "🥤",
  pet: "🐈",
  variety: "🎬",
};

export function StreetScene() {
  const { ads, idols, user, toggleBiasIdol } = useGame();
  const [picked, setPicked] = useState<{
    ad: CityAd;
    idol?: Idol;
  } | null>(null);

  const topBill = ads.filter((a) => a.placement === "billboard");
  const shopBill = ads.filter((a) => a.placement === "shop");
  const busBill = ads.filter((a) => a.placement === "bus");

  return (
    <div className="relative">
      {/* SKY + CITY SKYLINE */}
      <div className="relative h-[360px] overflow-hidden rounded-2xl border border-white/5">
        {/* sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #1a0a3a 0%, #3a0f4a 35%, #ff6e6e 70%, #ffb07a 100%)",
          }}
        />
        {/* sun */}
        <div
          className="absolute w-24 h-24 rounded-full blur-xl opacity-70"
          style={{ background: "#ffd166", right: "18%", top: "38%" }}
        />
        {/* far buildings */}
        <div className="absolute bottom-[130px] left-0 right-0 flex items-end gap-[3px] px-1 opacity-70">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1a0826]"
              style={{
                width: 14 + ((i * 13) % 10),
                height: 30 + ((i * 41) % 60),
              }}
            />
          ))}
        </div>

        {/* TOP BILLBOARDS on tall buildings */}
        {topBill.map((ad) => {
          const idol = idols.find((x) => x.id === ad.endorserIdolId);
          return (
            <button
              key={ad.id}
              onClick={() => setPicked({ ad, idol })}
              className="absolute active:scale-95 transition"
              style={{
                left: `${ad.x * 100}%`,
                top: 14 + ((ad.x * 37) % 28),
                width: 110,
                transform: "translateX(-50%)",
              }}
              aria-label={`${ad.brand} ${ad.product}`}
            >
              <Billboard ad={ad} idol={idol} />
              {/* building pole */}
              <div
                className="mx-auto w-[10px] bg-gradient-to-b from-[#1a0826] to-[#0b0614]"
                style={{ height: 70 + ((ad.x * 47) % 40) }}
              />
            </button>
          );
        })}

        {/* STREET / SIDEWALK */}
        <div className="absolute bottom-0 left-0 right-0 h-[130px]">
          {/* road */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[60px]"
            style={{
              background:
                "linear-gradient(180deg, #1a1524 0%, #0b0614 100%)",
            }}
          />
          {/* lane dashes */}
          <div className="absolute bottom-[28px] left-0 right-0 flex gap-3 px-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[3px] w-6 bg-kgold/70 rounded-full" />
            ))}
          </div>
          {/* bus with ad */}
          {busBill.map((ad, idx) => (
            <button
              key={ad.id}
              onClick={() => setPicked({ ad })}
              className="absolute bottom-[14px]"
              style={{ left: `${ad.x * 100}%`, transform: "translateX(-50%)" }}
            >
              <BusAd ad={ad} direction={idx % 2 === 0 ? "left" : "right"} />
            </button>
          ))}
          {/* shop front row */}
          <div className="absolute bottom-[60px] left-0 right-0 h-[70px] flex">
            {shopBill.map((ad) => {
              const idol = idols.find((x) => x.id === ad.endorserIdolId);
              return (
                <button
                  key={ad.id}
                  onClick={() => setPicked({ ad, idol })}
                  className="flex-1 h-full relative border-r border-black/50 active:scale-95 transition"
                  style={{
                    background: `linear-gradient(180deg, ${ad.colorA}, ${ad.colorB})`,
                  }}
                >
                  <ShopFront ad={ad} idol={idol} />
                </button>
              );
            })}
          </div>
        </div>

        {/* street lights */}
        <div className="absolute bottom-[70px] left-[22%] w-[2px] h-[40px] bg-white/60" />
        <div className="absolute bottom-[70px] right-[22%] w-[2px] h-[40px] bg-white/60" />
        <div className="absolute bottom-[108px] left-[21%] w-[6px] h-[6px] rounded-full bg-kgold shadow-[0_0_14px_#ffd166]" />
        <div className="absolute bottom-[108px] right-[21%] w-[6px] h-[6px] rounded-full bg-kgold shadow-[0_0_14px_#ffd166]" />
      </div>

      {/* BOTTOM SHEET: tap ad → bias */}
      {picked && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-end"
          onClick={() => setPicked(null)}
        >
          <div
            className="w-full bg-kpanel rounded-t-3xl p-5 border-t border-white/10 max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="text-[11px] opacity-60 tracking-widest uppercase">
              {picked.ad.brand}
            </div>
            <div className="font-black text-lg">{picked.ad.product}</div>
            {picked.ad.tagline && (
              <div className="text-sm opacity-80 mt-0.5">{picked.ad.tagline}</div>
            )}

            {picked.idol ? (
              <div className="mt-4 card flex items-center gap-3">
                <IdolFace face={picked.idol.face} size={64} />
                <div className="flex-1">
                  <div className="text-[11px] opacity-60">MODEL</div>
                  <div className="font-bold">{picked.idol.stageName}</div>
                  <div className="text-xs opacity-70">
                    {picked.idol.name} · POP {picked.idol.popularity}
                  </div>
                </div>
                <button
                  className={`chip !text-xs ${
                    user?.biasIdolIds.includes(picked.idol.id)
                      ? "!bg-kpink !text-white"
                      : "!bg-white/20"
                  }`}
                  onClick={() => {
                    const r = toggleBiasIdol(picked.idol!.id);
                    if (!r.ok && r.reason) alert(r.reason);
                    setPicked(null);
                  }}
                >
                  {user?.biasIdolIds.includes(picked.idol.id)
                    ? "★ 推し中"
                    : "☆ 推しに追加"}
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm opacity-70">
                この広告にはアイドルモデルはいません。
              </div>
            )}

            <button
              className="btn-ghost w-full mt-3"
              onClick={() => setPicked(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Billboard({ ad, idol }: { ad: CityAd; idol?: Idol }) {
  return (
    <div
      className="relative rounded-lg overflow-hidden border-2 border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.6)]"
      style={{
        height: 70,
        background: `linear-gradient(135deg, ${ad.colorA}, ${ad.colorB})`,
      }}
    >
      {idol && (
        <div className="absolute left-1 top-1">
          <div className="rounded overflow-hidden">
            <IdolFace face={idol.face} size={48} />
          </div>
        </div>
      )}
      <div className="absolute right-1 bottom-1 text-right">
        <div className="text-[8px] tracking-widest uppercase opacity-90 font-black leading-none">
          {ad.brand}
        </div>
        <div className="text-[9px] font-bold leading-tight drop-shadow">
          {ad.product}
        </div>
      </div>
      <div className="absolute right-1 top-1 text-lg">
        {PRODUCT_ICON[ad.kind] ?? "✨"}
      </div>
    </div>
  );
}

function ShopFront({ ad, idol }: { ad: CityAd; idol?: Idol }) {
  return (
    <div className="absolute inset-0 p-2 flex flex-col">
      {/* awning */}
      <div
        className="h-3 -mx-2 -mt-2 mb-1"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 8px, transparent 8px 16px)",
        }}
      />
      <div className="flex-1 flex items-center gap-2">
        {idol && (
          <div className="rounded overflow-hidden border border-white/40">
            <IdolFace face={idol.face} size={36} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-wider text-black/70 leading-none">
            {ad.brand}
          </div>
          <div className="text-[10px] font-bold text-black/90 truncate leading-tight">
            {ad.product}
          </div>
        </div>
        <div className="ml-auto text-xl">{PRODUCT_ICON[ad.kind] ?? "✨"}</div>
      </div>
    </div>
  );
}

function BusAd({
  ad,
  direction,
}: {
  ad: CityAd;
  direction: "left" | "right";
}) {
  return (
    <div
      className="relative rounded-md overflow-hidden border-2 border-black/60 shadow-md"
      style={{
        width: 140,
        height: 40,
        background: `linear-gradient(135deg, ${ad.colorA}, ${ad.colorB})`,
      }}
    >
      <div className="absolute inset-0 flex items-center px-2 gap-2">
        <span className="text-lg">{PRODUCT_ICON[ad.kind] ?? "✨"}</span>
        <div className="min-w-0">
          <div className="text-[8px] uppercase tracking-widest opacity-90 leading-none">
            {ad.brand}
          </div>
          <div className="text-[10px] font-black leading-tight truncate">
            {ad.product}
          </div>
        </div>
      </div>
      {/* wheels */}
      <div
        className={`absolute -bottom-2 w-3 h-3 rounded-full bg-black/80 ${
          direction === "left" ? "left-3" : "right-3"
        }`}
      />
      <div
        className={`absolute -bottom-2 w-3 h-3 rounded-full bg-black/80 ${
          direction === "left" ? "right-3" : "left-3"
        }`}
      />
    </div>
  );
}
