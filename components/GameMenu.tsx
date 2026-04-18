"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useGame } from "@/lib/store";

/**
 * ゲーム全画面HUDから呼び出されるサイドドロワー型メニュー。
 * ファンホーム / フィード / メッセージ / ショップ / コイン / アバター / 設定を
 * ここに集約することで、街の画面がアイコン群でごちゃつかないようにする。
 */
export function GameMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useGame();

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!user) return null;

  const unreadCount = user.inbox.filter((m) => !m.read).length;

  const items: Array<{
    href: string;
    emoji: string;
    title: string;
    desc: string;
    badge?: string;
  }> = [
    { href: "/fan", emoji: "💗", title: "ファン ホーム", desc: "推しと会いに行く" },
    { href: "/fan/feed", emoji: "📱", title: "フィード", desc: "推しの投稿・ライブ" },
    {
      href: "/fan/messages",
      emoji: "✉",
      title: "推しメッセ",
      desc: "AIが書くDM",
      badge: unreadCount > 0 ? `${unreadCount}` : undefined,
    },
    { href: "/fan/shop", emoji: "🛍", title: "推しグッズ", desc: "ペンライト/CD/PC" },
    { href: "/fan/discover", emoji: "🔮", title: "推しを探す", desc: "AIマッチ" },
    { href: "/gallery", emoji: "📷", title: "写真館", desc: "広告の名作アーカイブ" },
    { href: "/house", emoji: "🏠", title: "お家", desc: "ポスターや家具を飾ろう" },
    { href: "/office", emoji: "🏢", title: "事務所", desc: "ランクアップで拡大" },
    { href: "/producer", emoji: "🎬", title: "プロデューサー", desc: "事務所を運営" },
    { href: "/avatar", emoji: "🪞", title: "アバター工房", desc: "自分の姿を調整" },
    { href: "/shop/coins", emoji: "♦", title: "コイン購入", desc: "課金で追加" },
    { href: "/settings", emoji: "⚙", title: "設定", desc: "ニックネーム変更" },
  ];

  return (
    <div
      className={`fixed inset-0 z-[500] transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        tabIndex={-1}
        aria-label="メニューを閉じる"
      />
      {/* panel: 右からスライド */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-[min(86vw,380px)] bg-kpanel/95 backdrop-blur-xl border-l border-white/10 transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="font-display text-lg font-black bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent">
            メニュー
          </div>
          <button
            onClick={onClose}
            className="chip !bg-white/10 !text-sm"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="px-4 pb-2 text-[11px] opacity-70">
          {user.displayName || user.nickname} · ♦ {user.coins.toLocaleString()} ·
          🔥 {user.streak}日連続
        </div>
        <div className="px-3 pb-5 overflow-y-auto h-[calc(100%-72px)]">
          <div className="grid grid-cols-2 gap-2">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={onClose}
                className="relative card !p-3 active:scale-95"
              >
                <div className="text-xl leading-none">{it.emoji}</div>
                <div className="font-bold text-sm mt-1">{it.title}</div>
                <div className="text-[10px] opacity-70 leading-tight">
                  {it.desc}
                </div>
                {it.badge && (
                  <span className="absolute top-2 right-2 bg-kpink text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none">
                    {it.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
