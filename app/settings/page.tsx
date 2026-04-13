"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";

// ニックネーム: 記号NG、何語でもOK、1〜20文字
const NICKNAME_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ]{0,19}$/u;

export default function SettingsPage() {
  const router = useRouter();
  const { user, setDisplayName } = useGame();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
    else setNickname(user.displayName || "");
  }, [user, router]);

  if (!user) return null;

  return (
    <main className="pb-24">
      <TopBar title="設定" back="/home" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card">
          <div className="text-xs opacity-70">ユーザーネーム（変更不可）</div>
          <div className="font-mono text-lg mt-1">@{user.nickname}</div>
          <div className="text-[10px] opacity-60 mt-1">
            ログインIDは世界で一意のため変更できません。
          </div>
        </div>

        <div className="card">
          <div className="text-xs opacity-70 mb-1">ニックネーム</div>
          <div className="text-[11px] opacity-70 mb-2">
            推しや画面上であなたを呼ぶときの名前です。何語でもOK（記号はNG）。
          </div>
          <input
            className="input"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setOk(false);
              setError(null);
            }}
            placeholder="推しに呼んでほしい名前"
          />
          {error && <div className="text-kpink text-xs mt-2">{error}</div>}
          {ok && <div className="text-kgold text-xs mt-2">保存しました ✓</div>}
          <button
            className="btn-primary w-full mt-3"
            onClick={() => {
              const v = nickname.trim();
              if (!NICKNAME_RE.test(v)) {
                setError(
                  "1〜20文字・記号や特殊文字は使えません（言語は自由）"
                );
                return;
              }
              setDisplayName(v);
              setError(null);
              setOk(true);
            }}
          >
            保存
          </button>
        </div>
      </div>
    </main>
  );
}
