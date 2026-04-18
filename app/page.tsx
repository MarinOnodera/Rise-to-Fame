"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { DancingIdols } from "@/components/DancingIdols";
import {
  readBackup,
  requestPersistentStorage,
} from "@/lib/persistence";
import { lockLandscape } from "@/lib/orientation";

// ユーザーネーム（ログインID・変更不可・世界で一意）: 英数字 + 記号1個、8〜12文字
const USERNAME_RE = /^(?=.{8,12}$)(?=.*[A-Za-z0-9])(?=.*[!@#$%^&*_\-.])[A-Za-z0-9!@#$%^&*_\-.]+$/;
// ニックネーム（推しが呼ぶ名前・後から変更可）: 何語でもOK / 記号NG / 1〜20文字
// \p{L} = Letter(全言語), \p{M} = 結合記号, \p{N} = 数字。空白1個まで許容。
const NICKNAME_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ]{0,19}$/u;

export default function LandingPage() {
  const router = useRouter();
  const {
    user,
    initialized,
    initWorld,
    registerUser,
    restoreFromBackup,
    applyDailyLogin,
  } = useGame();
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // バックアップからの復元を試行中かどうか。復元試行の前に登録フォームを
  // チラ見せしないために、初回判定が終わるまでブランク描画する。
  const [restoreChecked, setRestoreChecked] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (!initialized) initWorld();
    // localStorage が飛ばされていた場合でも Cookie バックアップから自動復旧
    if (!user) {
      const b = readBackup();
      if (b) {
        restoreFromBackup(b);
      }
    }
    setRestoreChecked(true);
    if (user) {
      applyDailyLogin();
      // ブラウザにストレージを消さないよう依頼 (ベストエフォート)
      void requestPersistentStorage();
      // 自動ログイン: 登録済みなら問答無用でゲームへ
      router.replace("/home");
    }
  }, [
    initialized,
    user,
    initWorld,
    applyDailyLogin,
    router,
    restoreFromBackup,
  ]);

  if (!hydrated || !restoreChecked) return null;

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
    if (!USERNAME_RE.test(nickname)) {
      setError(
        "ユーザーネームは 8〜12文字、英数字＋記号（!@#$%^&*_-. のいずれか1つ以上）"
      );
      return;
    }
    if (!NICKNAME_RE.test(displayName.trim())) {
      setError("ニックネームは 1〜20文字、記号・特殊文字は使えません（言語は自由）");
      return;
    }
    try {
      const raw = localStorage.getItem("rise-nicks");
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (list.includes(nickname.toLowerCase())) {
        setError("このユーザーネームは他の人が使用中です");
        return;
      }
      localStorage.setItem(
        "rise-nicks",
        JSON.stringify([...list, nickname.toLowerCase()])
      );
    } catch {}
    registerUser(nickname, displayName.trim());
    // 登録直後の操作トリガで永続ストレージを要求しておく (ITPで消されないよう)
    void requestPersistentStorage();
    // 同じユーザー操作スコープで横画面ロックを要求 (モバイルの要件)
    void lockLandscape();
  }

  return (
    <main className="p-4 flex flex-col gap-4 min-h-screen justify-center">
      <DancingIdols />
      <div className="text-center -mt-1">
        <div className="text-[10px] opacity-60 tracking-[0.4em]">RISE TO FAME</div>
        <h1 className="font-display text-3xl font-black mt-1 bg-gradient-to-r from-kpink to-kgold bg-clip-text text-transparent">
          ようこそ MarinLuna へ
        </h1>
      </div>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-2">
        <label className="text-[11px] opacity-70 font-bold">ユーザーネーム</label>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="loginID_123"
          autoFocus
        />
        <div className="text-[10px] opacity-60">
          8〜12文字 / 英数字 + 記号1つ（世界で一意・あとから変更不可）
        </div>
        <label className="text-[11px] opacity-70 font-bold mt-2">ニックネーム</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="推しに呼んでほしい名前"
        />
        <div className="text-[10px] opacity-60">
          何語でもOK（さくら / Sakura / 樱 / 사쿠라 / Lily / 리사 / مريم）
          <br />
          記号は使えません。あとから変更可能。
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
