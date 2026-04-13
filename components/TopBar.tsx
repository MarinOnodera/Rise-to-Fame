"use client";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { CoinBadge } from "./CoinBadge";

export function TopBar({ title, back }: { title: string; back?: string }) {
  const user = useGame((s) => s.user);
  return (
    <div className="sticky top-0 z-10 backdrop-blur bg-kdark/70 border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {back && (
            <Link href={back} className="text-white/60 hover:text-white shrink-0">
              ←
            </Link>
          )}
          <div className="min-w-0">
            {user && (
              <div className="text-[11px] leading-tight bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent font-bold truncate">
                {user.displayName || user.nickname}さん、ようこそ！
              </div>
            )}
            <span className="font-display text-base font-bold leading-tight truncate block">
              {title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CoinBadge />
        </div>
      </div>
    </div>
  );
}
