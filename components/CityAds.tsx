"use client";
import { useGame } from "@/lib/store";

export function CityAds() {
  const ads = useGame((s) => s.ads);
  return (
    <div className="grid grid-cols-2 gap-3">
      {ads.map((ad) => (
        <div
          key={ad.id}
          className="relative h-28 rounded-2xl overflow-hidden border border-white/5"
          style={{
            background: `linear-gradient(135deg, ${ad.colorA}, ${ad.colorB})`,
          }}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-2 left-2 right-2">
            <div className="text-[10px] uppercase tracking-widest opacity-80">
              {ad.kind === "idol"
                ? "OFFICIAL"
                : ad.kind === "cat"
                ? "NYAN"
                : ad.kind === "dog"
                ? "WOOF"
                : ad.kind === "actress"
                ? "BEAUTY"
                : "VARIETY"}
            </div>
            <div className="font-black text-sm leading-tight drop-shadow">
              {ad.title}
            </div>
          </div>
          {ad.kind === "cat" && <div className="absolute top-2 right-2 text-2xl">🐈</div>}
          {ad.kind === "dog" && <div className="absolute top-2 right-2 text-2xl">🐕</div>}
          {ad.kind === "actress" && <div className="absolute top-2 right-2 text-2xl">💋</div>}
          {ad.kind === "variety" && <div className="absolute top-2 right-2 text-2xl">🎤</div>}
          {ad.kind === "idol" && <div className="absolute top-2 right-2 text-2xl">✨</div>}
        </div>
      ))}
    </div>
  );
}
