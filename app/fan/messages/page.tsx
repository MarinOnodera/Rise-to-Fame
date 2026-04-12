"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolFace } from "@/components/IdolFace";

export default function MessagesPage() {
  const router = useRouter();
  const { user, idols, markRead, deliverDailyMessages } = useGame();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    (async () => {
      setLoading(true);
      await deliverDailyMessages();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  // 今日届いた分を優先、以降は新しい順（already new-first）
  const inbox = user.inbox;

  return (
    <main className="pb-24">
      <TopBar title="推しメッセ" back="/home" />
      <div className="p-4">
        {loading && inbox.length === 0 && (
          <div className="card flex items-center gap-2 text-sm">
            <span className="inline-block w-2 h-2 bg-kpink rounded-full animate-bounce" />
            <span>推しが下書き中…</span>
          </div>
        )}

        {user.biasIdolIds.length === 0 && (
          <div className="card text-center">
            <div className="text-sm opacity-80">
              推しアイドルを設定すると、毎日1通ずつ届きます。
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {inbox.map((m) => {
            const idol = idols.find((i) => i.id === m.fromIdolId);
            return (
              <button
                key={m.id}
                className={`card text-left flex gap-3 items-start transition ${
                  !m.read ? "ring-1 ring-kpink/40" : ""
                }`}
                onClick={() => markRead(m.id)}
              >
                {idol && (
                  <div className="relative">
                    <IdolFace face={idol.face} size={48} />
                    {!m.read && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-kpink shadow-[0_0_10px_#ff3d8b]" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span className="font-bold">
                      {idol?.stageName ?? "???"}
                    </span>
                    {!m.read && (
                      <span className="chip !bg-kpink !text-white !text-[9px] !py-0 !px-1.5">
                        NEW
                      </span>
                    )}
                    <span className="opacity-50 ml-auto">
                      {new Date(m.at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm whitespace-pre-line leading-relaxed">
                    {m.text.replace(/^\[.+?\]\n/, "")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="btn-ghost w-full mt-4 text-sm"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await deliverDailyMessages();
            setLoading(false);
          }}
        >
          {loading ? "取得中…" : "↻ 新着を確認"}
        </button>
        <div className="text-[10px] opacity-50 text-center mt-2">
          内容はAIが推しの性格から毎日書き下ろしています
        </div>
      </div>
    </main>
  );
}
