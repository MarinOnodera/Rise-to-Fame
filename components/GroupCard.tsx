"use client";
import type { Group } from "@/lib/types";
import Link from "next/link";

export function GroupCard({
  group,
  biased,
  onToggleBias,
}: {
  group: Group;
  biased?: boolean;
  onToggleBias?: () => void;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/5 p-4"
      style={{
        background: `linear-gradient(135deg, ${group.colorA}, ${group.colorB})`,
      }}
    >
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-black drop-shadow">{group.name}</div>
            {group.dominant && (
              <span className="chip badge-dom !text-[10px] !font-bold">
                DOMINANT
              </span>
            )}
          </div>
          <div className="text-xs opacity-90">{group.concept}</div>
          <div className="text-[10px] opacity-80 mt-1">
            {group.memberIds.length} members · POP {group.popularity}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {onToggleBias && (
            <button
              onClick={onToggleBias}
              className={`chip !text-xs ${
                biased ? "!bg-kpink !text-white" : "!bg-white/20"
              }`}
            >
              {biased ? "★ 推し中" : "☆ 推す"}
            </button>
          )}
          <Link
            href={`/fan/group/${group.id}`}
            className="chip !bg-white/20 !text-xs"
          >
            見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
