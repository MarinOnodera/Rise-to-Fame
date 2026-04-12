"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { DancingIdols } from "@/components/DancingIdols";

// ニックネーム条件: 英数字 + 記号1個、8〜12文字
const NICK_RE = /^(?=.{8,12}$)(?=.*[A-Za-z0-9])(?=.*[!@#$%^&*_\-.])[A-Za-z0-9!@#$%^&*_\-.]+$/;

export default function LandingPage() {
  const { user, initialized, initWorld, registerUser, applyDailyLogin } =
    useGame();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (!initialized) initWorld();
    if (user) applyDailyLogin();
  }, [initialized, user, initWorld, applyDailyLogin]);

  if (!hydrated) return null;

  if (user) {
    return (
      <main className="p-4 flex flex-col gap-5 min-h-screen justify-center">
        <DancingIdols />
        <div className="text-center">
          <div className="text-[10px] opacity-60 tracking-[0.4em]">RISE TO FAME</div>
          <h1 className="font-display text-2xl font-black mt-1 bg-gradient-to-r from-kpink to-kpurple bg-clip-text text-transparent">
            Welcome back, {user.nickname}
          </h1>
          <div className="text-[11px] opacity-70">
            🔥 {user.streak}日連続 · ♦ {user.coins.toLocaleString()}
          </div>
        </div>
        <Link href="/home" className="btn-primary text-lg">
          ゲームスタート ▶
        </Link>
      </main>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!NICK_RE.test(nickname)) {
      setError(
        "8〜12文字、英数字＋記号（!@#$%^&*_-. のいずれか1つ以上）を含めて下さい"
      );
      return;
    }
    // 重複チェックはローカルのみ（本番はサーバー側で）
    try {
      const raw = localStorage.getItem("rise-nicks");
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (list.includes(nickname.toLowerCase())) {
        setError("このニックネームは他のユーザーが使用中です");
        return;
      }
      localStorage.setItem(
        "rise-nicks",
        JSON.stringify([...list, nickname.toLowerCase()])
      );
    } catch {}
    registerUser(nickname);
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
          className="input text-center"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ニックネームを入力"
          autoFocus
        />
        <div className="text-[10px] opacity-60 text-center">
          8〜12文字 / 英数字 + 記号1つ
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
