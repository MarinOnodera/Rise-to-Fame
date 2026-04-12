"use client";
import type { Idol } from "@/lib/types";
import { IdolFace } from "./IdolFace";

const COUNTRY_FLAG: Record<string, string> = {
  KR: "🇰🇷",
  JP: "🇯🇵",
  CN: "🇨🇳",
  TH: "🇹🇭",
  VN: "🇻🇳",
  US: "🇺🇸",
  CA: "🇨🇦",
  AU: "🇦🇺",
  FR: "🇫🇷",
  BR: "🇧🇷",
  PH: "🇵🇭",
  ID: "🇮🇩",
};

export function IdolCard({
  idol,
  active,
  onClick,
  right,
}: {
  idol: Idol;
  active?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`card text-left flex gap-3 items-center w-full ${
        active ? "ring-2 ring-kpink" : ""
      }`}
    >
      <IdolFace face={idol.face} size={64} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-bold truncate">{idol.stageName}</div>
          <span className="text-xs opacity-70">
            {COUNTRY_FLAG[idol.country] ?? ""}
          </span>
          <span className="text-xs opacity-60">{idol.age}</span>
        </div>
        <div className="text-xs opacity-70 truncate">{idol.name}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {idol.personality.slice(0, 3).map((p) => (
            <span key={p} className="chip !py-0.5 !text-[10px]">
              {p}
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-1 text-[10px] opacity-80">
          <span>V {idol.stats.vocal}</span>
          <span>D {idol.stats.dance}</span>
          <span>R {idol.stats.rap}</span>
          <span>★ {idol.stats.visual}</span>
          <span>♥ {idol.popularity}</span>
        </div>
      </div>
      {right}
    </button>
  );
}
