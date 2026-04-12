"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";

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
      <main className="p-6 flex flex-col gap-6 min-h-screen justify-center">
        <div className="text-center">
          <div className="text-xs opacity-60 tracking-[0.3em]">RISE TO FAME</div>
          <h1 className="heading mt-2 bg-gradient-to-r from-kpink to-kpurple bg-clip-text text-transparent">
            Welcome back, {user.nickname}
          </h1>
          <div className="mt-2 text-sm opacity-80">
            連続ログイン {user.streak} 日目 / コイン ♦ {user.coins.toLocaleString()}
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
    <main className="p-6 flex flex-col gap-6 min-h-screen justify-center">
      <div className="text-center">
        <div className="text-xs opacity-60 tracking-[0.3em]">RISE TO FAME</div>
        <h1 className="heading mt-2 bg-gradient-to-r from-kpink to-kpurple bg-clip-text text-transparent">
          舞台に立つのは誰だ？
        </h1>
        <p className="opacity-80 text-sm mt-2">
          K-Pop カルチャーを、売り出す側でも、推す側でも。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-3">
        <label className="text-sm opacity-80">ニックネーム</label>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例: Bias_Lover7"
          autoFocus
        />
        <div className="text-[11px] opacity-60">
          8〜12文字 / 英数字 + 記号（!@#$%^&*_-. のいずれか1つ以上）/ 他ユーザーと重複不可
        </div>
        {error && <div className="text-kpink text-xs">{error}</div>}
        <button type="submit" className="btn-primary mt-1">
          ゲームを始める
        </button>
        <div className="text-[11px] opacity-60 text-center">
          登録ボーナス ♦ 500 コイン進呈
        </div>
      </form>
    </main>
  );
}
