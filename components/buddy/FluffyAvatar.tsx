"use client";

import { useState } from "react";
import type { BuddyCharacter } from "@/lib/buddy/types";

/**
 * バディの顔を表示する。
 * - /public/buddy/buddy-{n}.png が置かれていれば画像表示。
 * - 画像読み込み失敗時は fallbackA/B のグラデで「もこもこ」っぽい代替を描画する。
 *   これにより画像配置前でも UI が壊れない。
 */
export function FluffyAvatar({
  character,
  size = 96,
  className = "",
  bouncing = false,
}: {
  character: BuddyCharacter;
  size?: number;
  className?: string;
  bouncing?: boolean;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`relative rounded-full overflow-hidden shadow-lg ${
          bouncing ? "animate-[buddyBounce_2.4s_ease-in-out_infinite]" : ""
        } ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${character.fallbackA}, ${character.fallbackB} 80%)`,
        }}
        aria-label={character.name}
      >
        <span
          className="absolute rounded-full bg-black"
          style={{
            width: size * 0.13,
            height: size * 0.16,
            top: size * 0.42,
            left: size * 0.32,
          }}
        />
        <span
          className="absolute rounded-full bg-black"
          style={{
            width: size * 0.13,
            height: size * 0.16,
            top: size * 0.42,
            left: size * 0.55,
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            width: size * 0.18,
            height: size * 0.16,
            top: size * 0.6,
            left: size * 0.41,
            background: "#ff8eb0",
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={character.imageSrc}
      alt={character.name}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`rounded-full object-cover shadow-lg ${
        bouncing ? "animate-[buddyBounce_2.4s_ease-in-out_infinite]" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
