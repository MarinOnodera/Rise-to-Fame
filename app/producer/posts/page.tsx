"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolPostCard } from "@/components/IdolPostCard";

export default function ProducerPostsPage() {
  const router = useRouter();
  const { user, idols, posts, approvePost, tickIdolPosts, goLive } = useGame();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  const myIdols = useMemo(
    () => idols.filter((i) => i.ownerId === user?.agencyId),
    [idols, user]
  );
  const myIdolIds = useMemo(() => new Set(myIdols.map((i) => i.id)), [myIdols]);

  const pending = posts.filter(
    (p) => myIdolIds.has(p.idolId) && p.approved === null
  );
  const published = posts.filter(
    (p) => myIdolIds.has(p.idolId) && p.approved === true
  );

  if (!user?.agencyId) return null;

  return (
    <main className="pb-24">
      <TopBar title="投稿の確認" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-bold">未承認 {pending.length} 件</div>
            <div className="text-[11px] opacity-70">
              AIが各アイドルの投稿案を生成します。公開前にプロデューサーがチェック。
            </div>
          </div>
          <button
            className="btn-ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await tickIdolPosts();
              setLoading(false);
            }}
          >
            {loading ? "生成中…" : "↻ 新候補"}
          </button>
        </div>

        {myIdols.length > 0 && (
          <div className="card">
            <div className="font-bold mb-1">アイドルをLIVE配信させる</div>
            <div className="text-[11px] opacity-70 mb-2">
              10分間のライブ配信としてフィードに即時公開されます。
            </div>
            <div className="flex flex-wrap gap-2">
              {myIdols
                .filter((i) => i.debuted)
                .map((i) => (
                  <button
                    key={i.id}
                    className="chip"
                    onClick={() => {
                      const r = goLive(i.id, 10);
                      if (!r.ok) alert(r.reason ?? "失敗");
                      else alert(`${i.stageName} がLIVE配信を開始`);
                    }}
                  >
                    🔴 {i.stageName}
                  </button>
                ))}
            </div>
          </div>
        )}

        {pending.length === 0 ? (
          <div className="card text-sm opacity-70 text-center">
            今は未承認の投稿はありません。
          </div>
        ) : (
          pending.map((p) => (
            <IdolPostCard
              key={p.id}
              post={p}
              idol={idols.find((i) => i.id === p.idolId)}
              pending
              onApprove={() => approvePost(p.id, true)}
              onReject={() => approvePost(p.id, false)}
            />
          ))
        )}

        {published.length > 0 && (
          <>
            <div className="text-xs opacity-60 mt-4">公開済み（最新5件）</div>
            {published.slice(0, 5).map((p) => (
              <IdolPostCard
                key={p.id}
                post={p}
                idol={idols.find((i) => i.id === p.idolId)}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
