"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolPostCard } from "@/components/IdolPostCard";

type Tab = "all" | "bias" | "live";

export default function FanFeedPage() {
  const router = useRouter();
  const { user, idols, posts, likePost, tickIdolPosts } = useGame();
  const [tab, setTab] = useState<Tab>("bias");
  const [live, setLive] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    void tickIdolPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const approved = posts.filter((p) => p.approved === true);
    if (tab === "live")
      return approved.filter(
        (p) => p.kind === "live" && p.liveUntil && new Date(p.liveUntil).getTime() > Date.now()
      );
    if (tab === "bias" && user)
      return approved.filter(
        (p) => user.biasIdolIds.includes(p.idolId) || user.biasGroupIds.includes(p.groupId ?? "")
      );
    return approved;
  }, [posts, tab, user]);

  if (!user) return null;

  const liveIdol = live ? idols.find((i) => i.id === live) : null;

  return (
    <main className="pb-24">
      <TopBar title="フィード" back="/home" />
      <div className="px-4 pt-3 flex gap-2">
        {(["bias", "all", "live"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip ${tab === t ? "!bg-kpink !text-white" : ""}`}
          >
            {t === "bias" ? "推しだけ" : t === "live" ? "LIVE" : "すべて"}
          </button>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="card text-sm opacity-70 text-center">
            まだ投稿がありません。
            {tab === "bias" && "推しを設定すると表示されます。"}
          </div>
        ) : (
          filtered.map((p) => (
            <IdolPostCard
              key={p.id}
              post={p}
              idol={idols.find((i) => i.id === p.idolId)}
              onLike={() => likePost(p.id)}
              onOpenLive={() => setLive(p.idolId)}
            />
          ))
        )}
      </div>

      {liveIdol && (
        <div
          className="fixed inset-0 z-[800] bg-black/90 flex items-center justify-center"
          onClick={() => setLive(null)}
        >
          <div
            className="w-full max-w-md aspect-[9/16] bg-gradient-to-br from-kpink via-kpurple to-black rounded-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-3 left-3 bg-red-600 px-2 py-0.5 rounded-full text-xs tracking-wider animate-pulse">
              ● LIVE
            </div>
            <div className="absolute top-3 right-3 text-xs opacity-80">
              viewers {Math.floor(800 + Math.random() * 4000).toLocaleString()}
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-[200px]">
              {liveIdol.personality.includes("bubbly")
                ? "💗"
                : liveIdol.personality.includes("cool")
                ? "🌙"
                : "✨"}
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <div className="font-bold">{liveIdol.stageName} の配信</div>
              <div className="text-[11px] opacity-80">
                タップで閉じる
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
