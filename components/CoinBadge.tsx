"use client";
import { useGame } from "@/lib/store";
import Link from "next/link";

export function CoinBadge() {
  const coins = useGame((s) => s.user?.coins ?? 0);
  return (
    <Link
      href="/shop/coins"
      className="chip !bg-kgold !text-black font-bold"
      aria-label="コイン残高"
    >
      ♦ {coins.toLocaleString()}
    </Link>
  );
}
