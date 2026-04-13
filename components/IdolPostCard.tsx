"use client";

import type { Idol, IdolPost } from "@/lib/types";
import { IdolFace } from "./IdolFace";

/**
 * Instagram ライクの投稿カード。画像は本物のメディアが無いので、
 * グラデ + ノイズ + 大きな絵文字で「写真っぽい」ビジュアルを作る。
 * ライブ配信 (kind=live) は赤いLIVEバッジが光る。
 */
export function IdolPostCard({
  post,
  idol,
  onLike,
  onOpenLive,
  pending,
  onApprove,
  onReject,
}: {
  post: IdolPost;
  idol?: Idol;
  onLike?: () => void;
  onOpenLive?: () => void;
  pending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isLive = post.kind === "live";
  const liveActive =
    isLive && post.liveUntil && new Date(post.liveUntil).getTime() > Date.now();

  // 擬似画像: 2色グラデ + 放射グラデ + 絵文字
  const style = {
    background: `
      radial-gradient(circle at ${30 + (post.imageSeed % 40)}% ${20 + ((post.imageSeed * 7) % 50)}%, rgba(255,255,255,0.25) 0%, transparent 60%),
      radial-gradient(circle at ${70 + (post.imageSeed % 20)}% ${80 - ((post.imageSeed * 3) % 40)}%, rgba(0,0,0,0.35) 0%, transparent 65%),
      linear-gradient(135deg, ${post.palette[0]}, ${post.palette[1]})
    `,
  };

  return (
    <div className="card !p-0 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 p-3">
        {idol && <IdolFace face={idol.face} size={32} />}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">
            {idol?.stageName ?? "???"}
          </div>
          <div className="text-[10px] opacity-60">
            {new Date(post.at).toLocaleString()} · {post.kind}
          </div>
        </div>
        {isLive && liveActive && (
          <span className="chip !bg-red-600 !text-white !text-[10px] animate-pulse">
            ● LIVE
          </span>
        )}
      </div>

      {/* image */}
      <button
        type="button"
        onClick={liveActive ? onOpenLive : undefined}
        className="relative block w-full aspect-square"
        style={style}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center text-[120px]"
          style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.35))" }}
        >
          {post.emoji}
        </div>
        {isLive && liveActive && (
          <div className="absolute top-3 left-3 bg-black/60 px-2 py-0.5 rounded-full text-[10px] tracking-widest">
            ▶ TAP TO WATCH
          </div>
        )}
      </button>

      {/* caption + actions */}
      <div className="p-3 flex flex-col gap-2">
        {!pending && (
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={onLike}
              className={`text-xl transition ${
                post.likedByUser ? "scale-110" : ""
              }`}
            >
              {post.likedByUser ? "❤️" : "🤍"}
            </button>
            <span className="text-xs opacity-80">
              {post.likes.toLocaleString()} いいね
            </span>
          </div>
        )}
        <div className="text-sm leading-snug whitespace-pre-line">
          <span className="font-bold mr-2">{idol?.stageName}</span>
          {post.caption}
        </div>

        {pending && (
          <div className="flex gap-2 mt-2">
            <button className="btn-ghost flex-1 text-sm" onClick={onReject}>
              却下
            </button>
            <button className="btn-primary flex-1 text-sm" onClick={onApprove}>
              承認して公開
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
