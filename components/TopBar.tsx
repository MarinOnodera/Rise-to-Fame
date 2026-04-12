"use client";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { CoinBadge } from "./CoinBadge";

export function TopBar({ title, back }: { title: string; back?: string }) {
  const user = useGame((s) => s.user);
  return (
    <div className="sticky top-0 z-10 backdrop-blur bg-kdark/70 border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {back && (
            <Link href={back} className="text-white/60 hover:text-white">
              ←
            </Link>
          )}
          <span className="font-display text-lg font-bold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {user && <span className="chip">@{user.nickname}</span>}
          <CoinBadge />
        </div>
      </div>
    </div>
  );
}
