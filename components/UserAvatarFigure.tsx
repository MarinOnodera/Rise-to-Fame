"use client";

import type {
  AvatarAccessory,
  AvatarEyes,
  AvatarHair,
  AvatarOutfit,
  AvatarPose,
  UserAvatar,
} from "@/lib/types";

/**
 * UserAvatar を "全身〜膝上" のSVGで描画する。
 * - viewBox 120x240 (縦長)。バストアップではなくワイド構図。
 * - 重なり順は常に: 体 < 顔 < 前髪 < アクセサリー。
 * - 背景は別コンポーネント (LAStreetScene) 側で敷く想定。
 */
export function UserAvatarFigure({
  avatar,
  height = 240,
}: {
  avatar: UserAvatar;
  height?: number;
}) {
  const skin = `hsl(${avatar.skinHue}, 55%, 72%)`;
  const skinShade = `hsl(${avatar.skinHue}, 45%, 58%)`;
  const hair = `hsl(${avatar.hairHue}, 70%, 48%)`;
  const hairShade = `hsl(${avatar.hairHue}, 70%, 32%)`;
  const eye = `hsl(${avatar.eyeHue}, 70%, 38%)`;
  const lip = `hsl(${avatar.lipHue}, 70%, 58%)`;
  const fitA = `hsl(${avatar.outfitHueA}, 75%, 55%)`;
  const fitB = `hsl(${avatar.outfitHueB}, 75%, 45%)`;

  const width = Math.round((height * 120) / 240);

  return (
    <svg
      viewBox="0 0 120 240"
      width={width}
      height={height}
      className="pointer-events-none"
      style={{ imageRendering: "auto" }}
    >
      <defs>
        <linearGradient id="fit-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fitA} />
          <stop offset="100%" stopColor={fitB} />
        </linearGradient>
      </defs>

      {/* --- ポーズ変形 (腰/腕) --- */}
      <g transform={poseTransform(avatar.parts.pose)}>
        {/* 脚 */}
        <Legs outfit={avatar.parts.outfit} fitA={fitA} fitB={fitB} skin={skin} />
        {/* 胴 (服) */}
        <Torso
          outfit={avatar.parts.outfit}
          pose={avatar.parts.pose}
          skin={skin}
        />
        {/* 腕 */}
        <Arms pose={avatar.parts.pose} skin={skin} fitA={fitA} />
        {/* 首 */}
        <rect x="54" y="60" width="12" height="12" fill={skinShade} />
        {/* 頭 */}
        <g>
          {/* 後ろ髪 */}
          <HairBack hair={avatar.parts.hair} color={hair} />
          {/* 顔 */}
          <ellipse cx="60" cy="48" rx="18" ry="21" fill={skin} />
          <ellipse cx="60" cy="58" rx="14" ry="4" fill={skinShade} opacity="0.25" />
          {/* 目 */}
          <Eyes shape={avatar.parts.eyes} eye={eye} />
          {/* 鼻 */}
          <path d="M60,50 l-1.5,5 l3,0 z" fill={skinShade} opacity="0.5" />
          {/* 口 */}
          <path
            d="M54,60 Q60,64 66,60 Q60,62 54,60 Z"
            fill={lip}
          />
          {/* 前髪 */}
          <HairFront hair={avatar.parts.hair} color={hair} shade={hairShade} />
          {/* アクセサリー (最前面) */}
          <Accessory kind={avatar.parts.accessory} />
        </g>
      </g>
    </svg>
  );
}

// ---- parts helpers ----

function poseTransform(pose: AvatarPose): string {
  switch (pose) {
    case "hand-on-hip":
      return "translate(0,0)";
    case "walking":
      return "translate(2,0) rotate(-2 60 180)";
    case "peace-sign":
      return "translate(0,0)";
    case "mic-stand":
      return "translate(0,0)";
    default:
      return "translate(0,0)";
  }
}

function Eyes({ shape, eye }: { shape: AvatarEyes; eye: string }) {
  const y = 46;
  const rx =
    shape === "round" ? 3 :
    shape === "sharp" ? 4 :
    shape === "cat" ? 4.5 :
    shape === "wide" ? 5 :
    shape === "droopy" ? 4 : 4;
  const ry =
    shape === "round" ? 3 :
    shape === "sharp" ? 1.8 :
    shape === "cat" ? 2.2 :
    shape === "wide" ? 3.2 :
    shape === "droopy" ? 2.4 : 2.6;
  const tilt = shape === "cat" ? -8 : shape === "droopy" ? 8 : 0;
  return (
    <g>
      <g transform={`rotate(${tilt} 52 ${y})`}>
        <ellipse cx="52" cy={y} rx={rx} ry={ry} fill="white" />
        <ellipse cx="52" cy={y} rx={rx * 0.55} ry={ry * 0.75} fill={eye} />
      </g>
      <g transform={`rotate(${-tilt} 68 ${y})`}>
        <ellipse cx="68" cy={y} rx={rx} ry={ry} fill="white" />
        <ellipse cx="68" cy={y} rx={rx * 0.55} ry={ry * 0.75} fill={eye} />
      </g>
    </g>
  );
}

function HairBack({ hair, color }: { hair: AvatarHair; color: string }) {
  // 後ろ髪は顔の後ろに描画される
  switch (hair) {
    case "long-straight":
      return <path d="M38,30 Q34,60 40,100 L80,100 Q86,60 82,30 Z" fill={color} />;
    case "long-wave":
      return (
        <path
          d="M36,30 Q30,56 38,80 Q34,94 42,104 L78,104 Q86,94 82,80 Q90,56 84,30 Z"
          fill={color}
        />
      );
    case "ponytail":
      return (
        <g fill={color}>
          <path d="M40,30 Q38,60 44,84 L76,84 Q82,60 80,30 Z" />
          <path d="M78,36 Q98,70 86,110 Q80,90 74,70 Z" />
        </g>
      );
    case "twin-buns":
      return (
        <g fill={color}>
          <path d="M40,30 Q38,58 44,78 L76,78 Q82,58 80,30 Z" />
          <circle cx="30" cy="30" r="10" />
          <circle cx="90" cy="30" r="10" />
        </g>
      );
    case "half-up":
      return (
        <path
          d="M38,30 Q34,58 40,96 L80,96 Q86,58 82,30 Z"
          fill={color}
        />
      );
    case "bob":
      return <path d="M40,30 Q36,58 44,72 L76,72 Q84,58 80,30 Z" fill={color} />;
    case "short-crop":
      return <path d="M42,30 Q40,48 46,58 L74,58 Q80,48 78,30 Z" fill={color} />;
    case "undercut":
      return <path d="M44,30 Q42,46 48,54 L72,54 Q78,46 76,30 Z" fill={color} />;
    case "mohawk-fade":
      return (
        <g fill={color}>
          <path d="M56,18 Q60,12 64,18 L66,40 L54,40 Z" />
          <path d="M46,40 L74,40 L72,54 L48,54 Z" opacity="0.5" />
        </g>
      );
  }
}

function HairFront({
  hair,
  color,
  shade,
}: {
  hair: AvatarHair;
  color: string;
  shade: string;
}) {
  switch (hair) {
    case "long-straight":
      return (
        <path d="M42,34 Q60,18 78,34 Q70,28 60,28 Q50,28 42,34 Z" fill={color} />
      );
    case "long-wave":
      return (
        <path
          d="M42,36 Q48,24 60,28 Q72,24 78,36 Q70,30 60,34 Q50,30 42,36 Z"
          fill={color}
        />
      );
    case "bob":
      return (
        <path
          d="M42,38 Q60,22 78,38 Q66,30 60,30 Q54,30 42,38 Z"
          fill={color}
        />
      );
    case "ponytail":
      return <path d="M44,36 Q60,24 76,36 Q68,28 60,30 Q52,28 44,36 Z" fill={color} />;
    case "short-crop":
      return <path d="M44,36 Q60,22 76,36 Q68,28 60,30 Q52,28 44,36 Z" fill={color} />;
    case "undercut":
      return (
        <g>
          <path d="M44,36 Q60,24 76,36 Q68,30 60,32 Q52,30 44,36 Z" fill={color} />
          <rect x="44" y="46" width="32" height="8" fill={shade} opacity="0.4" />
        </g>
      );
    case "twin-buns":
      return <path d="M44,36 Q60,22 76,36 Q68,28 60,30 Q52,28 44,36 Z" fill={color} />;
    case "half-up":
      return (
        <g fill={color}>
          <path d="M42,36 Q60,22 78,36 Q68,28 60,30 Q52,28 42,36 Z" />
          <ellipse cx="60" cy="26" rx="7" ry="5" />
        </g>
      );
    case "mohawk-fade":
      return <path d="M56,20 Q60,14 64,20 L64,38 L56,38 Z" fill={color} />;
  }
}

function Accessory({ kind }: { kind: AvatarAccessory }) {
  switch (kind) {
    case "none":
      return null;
    case "cyber-visor":
      return (
        <g>
          <rect x="40" y="42" width="40" height="8" rx="4" fill="#00f0ff" opacity="0.85" />
          <rect x="40" y="42" width="40" height="2" fill="#fff" opacity="0.7" />
        </g>
      );
    case "neon-shades":
      return (
        <g>
          <rect x="42" y="42" width="16" height="8" rx="2" fill="#111" />
          <rect x="62" y="42" width="16" height="8" rx="2" fill="#111" />
          <rect x="58" y="45" width="4" height="2" fill="#111" />
          <rect x="42" y="42" width="16" height="2" fill="#ff3d8b" opacity="0.9" />
          <rect x="62" y="42" width="16" height="2" fill="#7b2cff" opacity="0.9" />
        </g>
      );
    case "hologram-earring":
      return (
        <g>
          <circle cx="42" cy="54" r="2.2" fill="#00f0ff" />
          <circle cx="78" cy="54" r="2.2" fill="#ff3d8b" />
        </g>
      );
    case "choker-led":
      return (
        <g>
          <rect x="50" y="68" width="20" height="3" fill="#111" />
          <circle cx="56" cy="69.5" r="0.9" fill="#ff3d8b" />
          <circle cx="60" cy="69.5" r="0.9" fill="#00f0ff" />
          <circle cx="64" cy="69.5" r="0.9" fill="#ffd166" />
        </g>
      );
    case "face-decal":
      return (
        <g fill="#ff3d8b">
          <path d="M74,48 l2,-3 l1,3 l3,1 l-3,1 l-1,3 l-2,-3 l-3,-1 z" />
        </g>
      );
    case "halo-ring":
      return (
        <ellipse
          cx="60"
          cy="22"
          rx="18"
          ry="3"
          fill="none"
          stroke="#ffd166"
          strokeWidth="1.5"
        />
      );
  }
}

function Torso({
  outfit,
  pose,
  skin,
}: {
  outfit: AvatarOutfit;
  pose: AvatarPose;
  skin: string;
}) {
  void pose;
  // 服ごとに胴体のシルエットが少し違う
  const base = (
    <path
      d="M42,72 Q34,92 38,130 L82,130 Q86,92 78,72 Q70,76 60,76 Q50,76 42,72 Z"
      fill="url(#fit-grad)"
    />
  );
  switch (outfit) {
    case "crop-jacket":
      return (
        <g>
          {base}
          {/* 裾を短く */}
          <rect x="38" y="112" width="44" height="6" fill="#0b0614" opacity="0.4" />
          {/* 素肌がちらり */}
          <rect x="46" y="118" width="28" height="10" fill={skin} opacity="0.6" />
        </g>
      );
    case "oversize-hoodie":
      return (
        <path
          d="M36,72 Q28,96 34,138 L86,138 Q92,96 84,72 Q72,80 60,80 Q48,80 36,72 Z"
          fill="url(#fit-grad)"
        />
      );
    case "neon-mesh":
      return (
        <g>
          {base}
          <g stroke="#ffffff" strokeWidth="0.5" opacity="0.5">
            {[0,1,2,3,4,5].map((i) => (
              <line key={i} x1={40} y1={80 + i * 10} x2={80} y2={80 + i * 10} />
            ))}
          </g>
        </g>
      );
    case "stage-corset":
      return (
        <g>
          {base}
          <path d="M54,80 L54,126 M66,80 L66,126" stroke="#fff" strokeWidth="0.8" />
        </g>
      );
    case "streetwear":
      return base;
    case "holo-puffer":
      return (
        <g>
          <path
            d="M34,72 Q24,100 34,140 L86,140 Q96,100 86,72 Q72,80 60,80 Q48,80 34,72 Z"
            fill="url(#fit-grad)"
            opacity="0.95"
          />
          <g stroke="#fff" strokeWidth="0.4" opacity="0.5">
            {[0,1,2,3].map((i) => (
              <line key={i} x1={34} y1={86 + i * 14} x2={86} y2={86 + i * 14} />
            ))}
          </g>
        </g>
      );
    case "leather-fit":
      return (
        <g>
          {base}
          <rect x="42" y="72" width="36" height="58" fill="#0b0614" opacity="0.2" />
        </g>
      );
    case "cyber-kimono":
      return (
        <g>
          <path
            d="M38,72 Q32,100 40,140 L80,140 Q88,100 82,72 Q70,78 60,78 Q50,78 38,72 Z"
            fill="url(#fit-grad)"
          />
          <path d="M60,76 L60,140" stroke="#ffd166" strokeWidth="1" />
        </g>
      );
  }
}

function Arms({
  pose,
  skin,
  fitA,
}: {
  pose: AvatarPose;
  skin: string;
  fitA: string;
}) {
  // 腕はポーズで形を変える。服のそで色 fitA は長袖系だけに適用。
  const sleeve = fitA;
  if (pose === "hand-on-hip") {
    return (
      <g>
        {/* 左腕: まっすぐ下 */}
        <rect x="30" y="76" width="10" height="50" fill={sleeve} rx="3" />
        <circle cx="35" cy="130" r="5" fill={skin} />
        {/* 右腕: 腰に当てる */}
        <path d="M82,80 Q96,96 88,120 L78,120 Q80,100 78,84 Z" fill={sleeve} />
        <circle cx="82" cy="120" r="4.5" fill={skin} />
      </g>
    );
  }
  if (pose === "peace-sign") {
    return (
      <g>
        <rect x="30" y="76" width="10" height="50" fill={sleeve} rx="3" />
        <circle cx="35" cy="130" r="5" fill={skin} />
        <path d="M80,78 Q96,60 92,40 L84,40 Q84,60 74,78 Z" fill={sleeve} />
        <circle cx="92" cy="40" r="5" fill={skin} />
        {/* Vサイン */}
        <rect x="90" y="30" width="2" height="8" fill={skin} />
        <rect x="94" y="30" width="2" height="8" fill={skin} />
      </g>
    );
  }
  if (pose === "walking") {
    return (
      <g>
        <rect x="28" y="78" width="10" height="48" fill={sleeve} rx="3" transform="rotate(12 33 102)" />
        <rect x="82" y="78" width="10" height="48" fill={sleeve} rx="3" transform="rotate(-12 87 102)" />
      </g>
    );
  }
  if (pose === "mic-stand") {
    return (
      <g>
        <rect x="30" y="76" width="10" height="50" fill={sleeve} rx="3" />
        <circle cx="35" cy="130" r="5" fill={skin} />
        <path d="M80,78 L92,60 L96,64 L84,84 Z" fill={sleeve} />
        <circle cx="93" cy="60" r="4.5" fill={skin} />
        {/* マイク */}
        <rect x="90" y="40" width="3" height="18" fill="#222" />
        <circle cx="91.5" cy="38" r="4" fill="#333" />
        <circle cx="91.5" cy="38" r="2" fill="#ff3d8b" />
      </g>
    );
  }
  // idle
  return (
    <g>
      <rect x="30" y="76" width="10" height="50" fill={sleeve} rx="3" />
      <circle cx="35" cy="130" r="5" fill={skin} />
      <rect x="80" y="76" width="10" height="50" fill={sleeve} rx="3" />
      <circle cx="85" cy="130" r="5" fill={skin} />
    </g>
  );
}

function Legs({
  outfit,
  fitA,
  fitB,
  skin,
}: {
  outfit: AvatarOutfit;
  fitA: string;
  fitB: string;
  skin: string;
}) {
  const pants = outfit === "crop-jacket" || outfit === "stage-corset" ? skin : fitB;
  void fitA;
  return (
    <g>
      <rect x="44" y="130" width="14" height="80" fill={pants} rx="4" />
      <rect x="62" y="130" width="14" height="80" fill={pants} rx="4" />
      {/* スニーカー */}
      <rect x="42" y="208" width="18" height="6" rx="2" fill="#fff" />
      <rect x="60" y="208" width="18" height="6" rx="2" fill="#fff" />
      <rect x="42" y="212" width="18" height="2" fill="#ff3d8b" />
      <rect x="60" y="212" width="18" height="2" fill="#7b2cff" />
    </g>
  );
}
