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
import {
  isPortrait,
  lockLandscape,
  onOrientationChange,
} from "@/lib/orientation";

/**
 * ホーム画面 = 街の全画面 HUD。
 * - 基本は横向きで遊ぶ前提。ログイン直後に screen.orientation.lock で
 *   自動回転を試み、未対応環境 (iOS Safari 等) のみフォールバックで
 *   「タップして横画面にする」ボタンを出す。
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
    completeTutorial,
  } = useGame();
  const [menuOpen, setMenuOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
    else {
      if (user.mode === null) setMode("fan");
      void deliverDailyMessages();
      void tickIdolPosts();
    }
  }, [user, router, setMode, deliverDailyMessages, tickIdolPosts]);

  // 横画面ロックを試行。ユーザー操作が必要な環境のために、
  // 初回 pointerdown でも再試行する (gesture scope 内だと通る)。
  useEffect(() => {
    if (!user) return;
    void lockLandscape();
    const evaluate = () => setPortrait(isPortrait());
    evaluate();
    const off = onOrientationChange(evaluate);
    const gestureLock = () => {
      void lockLandscape().finally(() => evaluate());
      window.removeEventListener("pointerdown", gestureLock);
    };
    window.addEventListener("pointerdown", gestureLock, { once: true });
    return () => {
      off();
      window.removeEventListener("pointerdown", gestureLock);
    };
  }, [user]);

  if (!user) return null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-kdark">
      {/* フル画面の街 */}
      <div className="absolute inset-0">
        <StreetScene full />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
      </div>

      {/* 上部HUD: ようこそ + コイン + 掲示板 + メニュー */}
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

      {/* 右下: アイコンのみのデュアルCTA (横画面で親指が届きやすい位置) */}
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

      {/* 縦画面フォールバック: タップで横画面にする */}
      {portrait && (
        <button
          className="portrait-hint"
          onClick={() => {
            void lockLandscape().finally(() => setPortrait(isPortrait()));
          }}
        >
          <div className="text-center">
            <div className="text-6xl animate-pulse">📱↺</div>
            <div className="mt-4 font-bold text-lg">横画面に切り替える</div>
            <div className="text-xs opacity-70 mt-1">
              タップで自動的に横向きに回転します
            </div>
            <div className="text-[10px] opacity-50 mt-3">
              ※ iOS Safariでは端末の回転ロックを解除してください
            </div>
          </div>
        </button>
      )}

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
