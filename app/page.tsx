"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { DancingIdols } from "@/components/DancingIdols";

// ログインID: 英数字 + 記号1個、8〜12文字 (世界で一意)
const NICK_RE = /^(?=.{8,12}$)(?=.*[A-Za-z0-9])(?=.*[!@#$%^&*_\-.])[A-Za-z0-9!@#$%^&*_\-.]+$/;
// 呼び名: どの言語でも OK / 1〜20文字
const DISPLAY_RE = /^.{1,20}$/u;

export default function LandingPage() {
  const router = useRouter();
  const { user, initialized, initWorld, registerUser, applyDailyLogin } =
    useGame();
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (!initialized) initWorld();
    if (user) {
      applyDailyLogin();
      // 自動ログイン: 登録済みなら問答無用でゲームへ
      router.replace("/home");
    }
  }, [initialized, user, initWorld, applyDailyLogin, router]);

  if (!hydrated) return null;

  // 既に登録済み→/home に飛ばすまでの間、Dancing画面を出すだけ
  if (user) {
    return (
      <main className="p-4 flex flex-col gap-5 min-h-screen justify-center">
        <DancingIdols />
        <div className="text-center">
          <div className="text-[10px] opacity-60 tracking-[0.4em]">RISE TO FAME</div>
          <h1 className="font-display text-2xl font-black mt-1 bg-gradient-to-r from-kpink to-kpurple bg-clip-text text-transparent">
            Welcome back, {user.displayName || user.nickname}
          </h1>
          <div className="text-[11px] opacity-70">
            🔥 {user.streak}日連続 · ♦ {user.coins.toLocaleString()}
          </div>
        </div>
      </main>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!NICK_RE.test(nickname)) {
      setError(
        "ID は 8〜12文字、英数字＋記号（!@#$%^&*_-. のいずれか1つ以上）"
      );
      return;
    }
    if (!DISPLAY_RE.test(displayName.trim())) {
      setError("呼び名は 1〜20文字で入力してください");
      return;
    }
    try {
      const raw = localStorage.getItem("rise-nicks");
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (list.includes(nickname.toLowerCase())) {
        setError("このIDは他のユーザーが使用中です");
        return;
      }
      localStorage.setItem(
        "rise-nicks",
        JSON.stringify([...list, nickname.toLowerCase()])
      );
    } catch {}
    registerUser(nickname, displayName.trim());
  }

  return (
    <main className="p-4 flex flex-col gap-4 min-h-screen justify-center">
      <DancingIdols />
      <div className="text-center -mt-1">
        <div className="text-[10px] opacity-60 tracking-[0.4em]">RISE TO FAME</div>
        <h1 className="font-display text-3xl font-black mt-1 bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent">
          舞台に立つのは、誰だ？
        </h1>
      </div>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-2">
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ログインID"
          autoFocus
        />
        <div className="text-[10px] opacity-60">
          8〜12文字 / 英数字 + 記号1つ（世界で一意）
        </div>
        <input
          className="input mt-1"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="推しに呼んでほしい名前"
        />
        <div className="text-[10px] opacity-60">
          どの言語でもOK（例: さくら / Sakura / 樱 / 사쿠라 / Lily）
        </div>
        {error && <div className="text-kpink text-xs text-center">{error}</div>}
        <button type="submit" className="btn-primary mt-1 text-lg">
          ▶ START
        </button>
        <div className="text-[10px] opacity-60 text-center">
          登録で ♦500 コイン進呈
        </div>
      </form>
    </main>
  );
}
