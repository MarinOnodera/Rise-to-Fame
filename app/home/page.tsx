"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { Tutorial } from "@/components/Tutorial";
import { GameMenu } from "@/components/GameMenu";
import { WeeklyTopAutoModal, WeeklyTopManual } from "@/components/WeeklyTop";
import { CoinBadge } from "@/components/CoinBadge";
import type { UserAvatar } from "@/lib/types";

// 3D シティはクライアントオンリー (Three.js は window 必須)
const City3D = dynamic(
  () => import("@/components/City3D").then((m) => m.City3D),
  { ssr: false }
);

// アバター未作成ユーザー向けのデフォルトアバター。
// 街だけ先に見せて、/avatar でいつでも自分の見た目に置き換えられる。
const FALLBACK_AVATAR: UserAvatar = {
  id: "fallback_avatar",
  source: "preset",
  presetId: "f-natural",
  skinHue: 25,
  hairHue: 30,
  eyeHue: 30,
  lipHue: 350,
  outfitHueA: 180,
  outfitHueB: 190,
  parts: {
    hair: "long-straight",
    eyes: "almond",
    outfit: "oversize-hoodie",
    accessory: "none",
    background: "la-sunset-blvd",
    pose: "idle",
  },
  createdAt: new Date(0).toISOString(),
};
/**
 * ホーム画面 = 街の全画面 HUD。
 * - 横・縦どちらでもプレイ可能。
 * - 背景は StreetScene をフルブリード、UIは画面内に収める。
 * - ナビは右上のメニューボタン1つに集約。
 * - デュアルCTAは文字なしのアイコンボタン (タップで各選択画面へ)。
 */
export default function HomePage() {
  const router = useRouter();
  const {
    user,
    setMode,
    deliverDailyMessages,
    tickIdolPosts,
    tickAdsRollover,
    tickAdEconomy,
    completeTutorial,
  } = useGame();
  const [menuOpen, setMenuOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
    else {
      if (user.mode === null) setMode("fan");
      void deliverDailyMessages();
      void tickIdolPosts();
      // 週またぎ判定 + 期限切れ user 広告枠の整理 (idempotent)
      tickAdsRollover();
      // AI ファン経済シミュレーション (1h 単位 idempotent)
      tickAdEconomy();
    }
  }, [
    user, router, setMode,
    deliverDailyMessages, tickIdolPosts,
    tickAdsRollover, tickAdEconomy,
  ]);

  if (!user) return null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-kdark">
      {/* フル画面の街: 常に 3D。アバター未作成時は仮アバターで表示。 */}
      <div className="absolute inset-0">
        <City3D avatar={user.avatar ?? FALLBACK_AVATAR} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/65 via-black/15 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
      </div>

      {/* 上部HUD: ようこそ + コイン + 掲示板 + メニュー */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 sm:px-5 py-2 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] leading-tight bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent font-bold truncate">
            {user.displayName || user.nickname}さん、ようこそ MarinLuna へ！
          </div>
          <div className="font-display text-sm sm:text-base font-bold leading-tight truncate">
            📍 Seoul
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CoinBadge />
          <button
            onClick={() => setTopOpen(true)}
            className="chip !bg-white/15 !text-xs"
            aria-label="今週のトップ掲示板"
            title="今週のトップ"
          >
            📰
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="chip !bg-gradient-to-r !from-kpink !to-kpurple !text-white !font-bold"
            aria-label="メニューを開く"
          >
            ☰ メニュー
          </button>
        </div>
      </div>

      {/* 街中の掲示板タイル */}
      <button
        onClick={() => setTopOpen(true)}
        className="absolute z-10 left-3 sm:left-5 top-20 sm:top-24 active:scale-95"
        aria-label="今週のトップ3を見る"
      >
        <div className="relative rounded-xl overflow-hidden border-2 border-kgold/80 shadow-glow bg-gradient-to-br from-kpink/90 to-kpurple/90 px-3 py-2 text-left backdrop-blur">
          <div className="text-[8px] tracking-[0.3em] opacity-80">
            BULLETIN BOARD
          </div>
          <div className="text-xs font-black leading-tight">今週のトップ3</div>
          <div className="text-[9px] opacity-80 mt-0.5">タップで確認</div>
        </div>
        <div className="mx-auto w-[6px] h-4 bg-[#1a0826]" />
      </button>

      {/* 右下: アイコンのみのデュアルCTA */}
      <div className="absolute bottom-0 right-0 z-20 pb-3 pr-3 sm:pb-4 sm:pr-4">
        <div className="flex items-end gap-2 sm:gap-3">
          <CtaIconButton
            href="/fan/discover"
            emoji="🔮"
            label="推しアイドルを探す"
            tone="from-kpink to-kpurple"
          />
          <CtaIconButton
            href="/producer"
            emoji="🎬"
            label="アイドルグループを作成する"
            tone="from-kgold to-kpink"
          />
        </div>
      </div>

      {/* Overlays */}
      {!user.tutorialDone && <Tutorial onFinish={completeTutorial} />}
      <WeeklyTopAutoModal />
      <WeeklyTopManual open={topOpen} onClose={() => setTopOpen(false)} />
      <GameMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </main>
  );
}

/**
 * アイコンのみの丸ボタン。タップすると対応する選択画面に遷移する。
 * labelは画面に常時表示せずにフローティングチップだけ出して認知性は残す。
 */
function CtaIconButton({
  href,
  emoji,
  label,
  tone,
}: {
  href: string;
  emoji: string;
  label: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1 active:scale-95"
      aria-label={label}
      title={label}
    >
      <span
        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${tone} shadow-glow flex items-center justify-center text-xl sm:text-2xl border border-white/25`}
      >
        {emoji}
      </span>
      <span className="chip !bg-black/60 !text-[9px] !text-white/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
        {label}
      </span>
    </Link>
  );
}
