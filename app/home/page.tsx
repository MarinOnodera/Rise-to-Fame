"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { StreetScene } from "@/components/StreetScene";
import { Tutorial } from "@/components/Tutorial";
import { GameMenu } from "@/components/GameMenu";
import { WeeklyTopAutoModal, WeeklyTopManual } from "@/components/WeeklyTop";
import { CoinBadge } from "@/components/CoinBadge";

/**
 * ホーム画面 = 街の全画面 HUD。
 * - 基本は横向きで遊ぶ前提。縦向きの場合は「回してね」ヒントを出す。
 * - 背景は StreetScene をフルブリード。画面にUIが収まるようにスクロール禁止。
 * - ナビは右上のメニューボタン1つに集約し、ドロワーで選択。
 * - 今週のトップは当日1回モーダル + 掲示板ボタンで何度でも開ける。
 */
export default function HomePage() {
  const router = useRouter();
  const {
    user,
    setMode,
    deliverDailyMessages,
    tickIdolPosts,
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
    }
  }, [user, router, setMode, deliverDailyMessages, tickIdolPosts]);

  if (!user) return null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-kdark">
      {/* フル画面の街 */}
      <div className="absolute inset-0">
        <StreetScene full />
        {/* 下から上への暗いグラデでHUDを読みやすく */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
      </div>

      {/* 上部HUD: ようこそ + コイン + メニュー */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 sm:px-5 py-2 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] leading-tight bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent font-bold truncate">
            {user.displayName || user.nickname}さん、ようこそ！
          </div>
          <div className="font-display text-sm sm:text-base font-bold leading-tight truncate">
            LA × Seoul Street
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

      {/* 街中の掲示板タイル (タップで今週のトップ) */}
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
        {/* 掲示板の脚 */}
        <div className="mx-auto w-[6px] h-4 bg-[#1a0826]" />
      </button>

      {/* 下部のデュアルCTA (画面に常に収まる) */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-3 sm:px-5 pb-3 sm:pb-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-3xl mx-auto">
          <Link
            href="/fan/discover"
            className="card !p-3 flex items-center gap-2 border-kpink/50 bg-gradient-to-br from-kpink/35 to-kpurple/30 active:scale-95"
          >
            <span className="text-xl sm:text-2xl">🔮</span>
            <span className="flex flex-col leading-tight">
              <span className="font-bold text-xs sm:text-sm">
                推しアイドルを探しに行く
              </span>
              <span className="text-[10px] opacity-70">
                AIがあなたに合う3人を選ぶ
              </span>
            </span>
          </Link>
          <Link
            href="/producer"
            className="card !p-3 flex items-center gap-2 border-kgold/50 bg-gradient-to-br from-kgold/35 to-kpink/30 active:scale-95"
          >
            <span className="text-xl sm:text-2xl">🎬</span>
            <span className="flex flex-col leading-tight">
              <span className="font-bold text-xs sm:text-sm">
                アイドルグループを作成する
              </span>
              <span className="text-[10px] opacity-70">
                プロデューサーとして事務所設立
              </span>
            </span>
          </Link>
        </div>
      </div>

      {/* 縦向き時のガイド (任意: 横でも動くが基本は横) */}
      <div className="portrait-hint" aria-hidden>
        <div className="text-center">
          <div className="text-5xl animate-pulse">📱↺</div>
          <div className="mt-3 font-bold">画面を横にしてね</div>
          <div className="text-xs opacity-70 mt-1">
            ゲームは横画面でプレイする設計です
          </div>
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
