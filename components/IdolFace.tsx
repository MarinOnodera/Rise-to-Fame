"use client";
import type { FaceSeed } from "@/lib/types";

/**
 * K-Pop Demon Hunters風を目指した「仮の顔」SVGアバター。
 * 実本番では face シードを元に画像生成API（Stable Diffusion / Imagen 等）に
 * 差し替える想定。ここでは一意性を視覚化するための決定論的な合成。
 */
export function IdolFace({
  face,
  size = 72,
}: {
  face: FaceSeed;
  size?: number;
}) {
  const skin = `hsl(${face.skin},45%,72%)`;
  const shade = `hsl(${face.skin},45%,58%)`;
  const hair = `hsl(${face.hairColor},70%,${30 + (face.hair % 4) * 6}%)`;
  const eye = `hsl(${face.eyeColor},65%,32%)`;
  const lips = `hsl(${(face.accent + 330) % 360},70%,55%)`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="rounded-2xl shadow-glow"
      style={{ background: `linear-gradient(135deg, ${hair}, ${shade})` }}
    >
      {/* hair back */}
      <path
        d={`M10,60 Q10,20 50,${14 + face.hair} Q90,20 90,60 L90,95 L10,95 Z`}
        fill={hair}
      />
      {/* face */}
      <ellipse cx="50" cy={50 + face.jaw} rx="24" ry={28 - (face.jaw % 4)} fill={skin} />
      {/* jaw shade */}
      <ellipse cx="50" cy={60 + face.jaw} rx="22" ry="5" fill={shade} opacity="0.25" />
      {/* eyes */}
      <g>
        <ellipse
          cx={40}
          cy={48 + (face.eyeShape % 4)}
          rx={5 + (face.eyeShape % 3)}
          ry={3}
          fill="white"
        />
        <ellipse cx={40} cy={48 + (face.eyeShape % 4)} rx={2.5} ry={2.5} fill={eye} />
        <ellipse
          cx={60}
          cy={48 + (face.eyeShape % 4)}
          rx={5 + (face.eyeShape % 3)}
          ry={3}
          fill="white"
        />
        <ellipse cx={60} cy={48 + (face.eyeShape % 4)} rx={2.5} ry={2.5} fill={eye} />
      </g>
      {/* nose */}
      <path
        d={`M50,${52 + (face.jaw % 2)} l-2,5 l4,0 z`}
        fill={shade}
        opacity="0.5"
      />
      {/* lips */}
      <path
        d={`M44,${64 + (face.lips % 3)} Q50,${68 + (face.lips % 3)} 56,${64 + (face.lips % 3)} Q50,${66 + (face.lips % 3)} 44,${64 + (face.lips % 3)} Z`}
        fill={lips}
      />
      {/* freckles */}
      {face.freckle && (
        <g fill={shade} opacity="0.55">
          <circle cx="44" cy="56" r="0.8" />
          <circle cx="50" cy="57" r="0.8" />
          <circle cx="56" cy="56" r="0.8" />
        </g>
      )}
      {/* hair front */}
      <path
        d={`M20,38 Q50,${10 + (face.hair % 6)} 80,38 Q66,26 50,26 Q34,26 20,38 Z`}
        fill={hair}
      />
    </svg>
  );
}
