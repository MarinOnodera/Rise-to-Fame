"use client";

import type { AvatarBackground, UserAvatar } from "@/lib/types";
import { UserAvatarFigure } from "./UserAvatarFigure";

/**
 * LA × K-Pop × 近未来サイバーパンクのワイドビュー背景。
 *
 * 設計方針:
 * - viewBox 400x300 の「ワイドスクリーン」。アバターは膝上〜全身で右下寄り、
 *   画面の 1/3 程度のスケール感 (= "街の一部にキャラがいる" 構図)。
 * - 背景はぼかさない: blur フィルタや opacity を使わず、建物・ネオン・空の
 *   ディテールがすべて輪郭線入りでクッキリ見える = Deep Focus / Pan Focus。
 * - カラーは LA サンセット (マゼンタ→パープル→ゴールド) にネオン (cyan / pink)。
 * - 開放感: 画面上半分は必ず空を広く取り、椰子や建物で埋めきらない。
 */
export function LAStreetScene({
  background,
  avatar,
  className = "",
}: {
  background: AvatarBackground;
  avatar?: UserAvatar | null;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={`w-full h-auto rounded-2xl border border-white/10 shadow-glow ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <Gradients bg={background} />
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20,0 L0,0 L0,20" fill="none" stroke="#ff3d8b" strokeWidth="0.3" opacity="0.3" />
        </pattern>
      </defs>

      {/* Sky */}
      <rect width="400" height="300" fill="url(#sky)" />
      {/* Sun / moon */}
      <Sun bg={background} />
      {/* Background-specific city layers */}
      {background === "la-sunset-blvd" && <SunsetBlvd />}
      {background === "dtla-neon" && <DTLANeon />}
      {background === "venice-boardwalk" && <VeniceBoardwalk />}
      {background === "hollywood-sign" && <HollywoodHills />}
      {background === "k-town-night" && <KTownNight />}
      {background === "rooftop-skyline" && <RooftopSkyline />}
      {/* Ground */}
      <rect x="0" y="240" width="400" height="60" fill="url(#ground)" />
      {/* Perspective grid (subtle cyber floor) */}
      <rect x="0" y="240" width="400" height="60" fill="url(#grid)" opacity="0.5" />

      {/* Avatar layer: 右下寄り、キャラの高さは画面の ~55% */}
      {avatar && (
        <g transform="translate(235, 100)">
          <AvatarInline avatar={avatar} />
        </g>
      )}
    </svg>
  );
}

function AvatarInline({ avatar }: { avatar: UserAvatar }) {
  // UserAvatarFigure は foreignObject を使わずに埋め込み。viewBox 120x240 を
  // 内包させるため、svg を入れ子にする (SVG 1.1 で valid)。
  return (
    <svg width="130" height="180" viewBox="0 0 120 240">
      <g>
        <UserAvatarFigure avatar={avatar} height={240} />
      </g>
    </svg>
  );
}

function Gradients({ bg }: { bg: AvatarBackground }) {
  const skies: Record<AvatarBackground, [string, string, string]> = {
    "la-sunset-blvd": ["#ffb36b", "#ff3d8b", "#7b2cff"],
    "dtla-neon": ["#1a0033", "#3a0d5c", "#0b0614"],
    "venice-boardwalk": ["#ffd9a8", "#ff8ecb", "#7b2cff"],
    "hollywood-sign": ["#ffc87a", "#ff3d8b", "#4b1973"],
    "k-town-night": ["#180424", "#3a0d5c", "#ff3d8b"],
    "rooftop-skyline": ["#ffd166", "#ff3d8b", "#7b2cff"],
  };
  const [a, b, c] = skies[bg];
  return (
    <>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={a} />
        <stop offset="55%" stopColor={b} />
        <stop offset="100%" stopColor={c} />
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#120828" />
        <stop offset="100%" stopColor="#05020d" />
      </linearGradient>
    </>
  );
}

function Sun({ bg }: { bg: AvatarBackground }) {
  const night = bg === "dtla-neon" || bg === "k-town-night";
  return (
    <g>
      <circle
        cx="310"
        cy={night ? 70 : 150}
        r={night ? 22 : 44}
        fill={night ? "#f5f0ff" : "#ffeaa7"}
        opacity={night ? 0.95 : 0.9}
      />
      {!night && (
        <circle cx="310" cy="150" r="60" fill="#ffeaa7" opacity="0.2" />
      )}
    </g>
  );
}

// --- Scenes ---

function SunsetBlvd() {
  return (
    <g>
      {/* 遠景の低層ビル */}
      <g fill="#2b0a44">
        <rect x="0" y="180" width="60" height="60" />
        <rect x="58" y="170" width="44" height="70" />
        <rect x="100" y="190" width="50" height="50" />
        <rect x="148" y="175" width="38" height="65" />
        <rect x="186" y="185" width="54" height="55" />
        <rect x="240" y="180" width="46" height="60" />
        <rect x="286" y="190" width="40" height="50" />
        <rect x="326" y="175" width="74" height="65" />
      </g>
      {/* 窓の光 */}
      <g fill="#ffd166">
        {Array.from({ length: 28 }).map((_, i) => (
          <rect
            key={i}
            x={10 + (i * 14) % 390}
            y={190 + ((i * 7) % 40)}
            width="2"
            height="3"
            opacity={0.7 + ((i % 3) * 0.1)}
          />
        ))}
      </g>
      {/* ネオン看板 (ピンク/シアン) */}
      <rect x="30" y="158" width="70" height="18" fill="#ff3d8b" />
      <text x="35" y="172" fontSize="12" fontWeight="900" fill="#fff" fontFamily="monospace">
        LA ☆ KPOP
      </text>
      <rect x="120" y="150" width="52" height="14" fill="#00f0ff" />
      <text x="124" y="162" fontSize="10" fontWeight="900" fill="#111" fontFamily="monospace">
        SUNSET
      </text>
      <rect x="180" y="160" width="40" height="12" fill="#ffd166" />
      <text x="183" y="170" fontSize="8" fontWeight="900" fill="#111" fontFamily="monospace">
        RISE FM
      </text>
      {/* 椰子の木 */}
      <Palm x={20} scale={1} />
      <Palm x={120} scale={0.8} />
      <Palm x={380} scale={1.1} />
      {/* 道路 */}
      <path d="M0,240 L400,240 L400,260 L0,260 Z" fill="#1a0a2a" />
      <g stroke="#ffd166" strokeWidth="2" strokeDasharray="12 8">
        <line x1="0" y1="250" x2="400" y2="250" />
      </g>
    </g>
  );
}

function DTLANeon() {
  return (
    <g>
      {/* 高層ビル群 */}
      <g fill="#0d0322">
        <rect x="0" y="100" width="50" height="140" />
        <rect x="48" y="80" width="60" height="160" />
        <rect x="108" y="120" width="40" height="120" />
        <rect x="148" y="60" width="70" height="180" />
        <rect x="218" y="100" width="50" height="140" />
        <rect x="268" y="70" width="60" height="170" />
        <rect x="328" y="110" width="72" height="130" />
      </g>
      {/* 窓 (無数の点光源) */}
      <g fill="#ffd166">
        {Array.from({ length: 80 }).map((_, i) => (
          <rect
            key={i}
            x={4 + (i * 17) % 396}
            y={80 + ((i * 11) % 160)}
            width="2"
            height="2"
            opacity={0.5 + ((i % 4) * 0.12)}
          />
        ))}
      </g>
      {/* 垂直ネオン */}
      <rect x="72" y="85" width="6" height="140" fill="#ff3d8b" />
      <rect x="180" y="65" width="6" height="170" fill="#00f0ff" />
      <rect x="290" y="75" width="6" height="160" fill="#ffd166" />
      {/* ホログラム看板 */}
      <rect x="10" y="110" width="40" height="22" fill="#7b2cff" stroke="#ff3d8b" strokeWidth="1" />
      <text x="14" y="126" fontSize="11" fill="#fff" fontFamily="monospace" fontWeight="900">DTLA</text>
      <rect x="220" y="130" width="46" height="18" fill="#00f0ff" />
      <text x="224" y="143" fontSize="10" fill="#111" fontFamily="monospace" fontWeight="900">NEO SEOUL</text>
      {/* ドローン */}
      <g>
        <circle cx="80" cy="40" r="2" fill="#ff3d8b" />
        <circle cx="260" cy="30" r="2" fill="#00f0ff" />
        <circle cx="350" cy="50" r="2" fill="#ffd166" />
      </g>
    </g>
  );
}

function VeniceBoardwalk() {
  return (
    <g>
      {/* 海 */}
      <rect x="0" y="170" width="400" height="70" fill="#3ab0c9" />
      {/* 波のハイライト */}
      <g stroke="#fff" strokeWidth="1" opacity="0.6">
        <line x1="20" y1="185" x2="60" y2="185" />
        <line x1="100" y1="195" x2="160" y2="195" />
        <line x1="220" y1="190" x2="280" y2="190" />
        <line x1="320" y1="200" x2="380" y2="200" />
      </g>
      {/* 遠景: 低層ビル + 観覧車 */}
      <g fill="#2b0a44">
        <rect x="0" y="145" width="80" height="30" />
        <rect x="80" y="135" width="60" height="40" />
        <rect x="140" y="150" width="48" height="25" />
      </g>
      <g>
        <circle cx="320" cy="150" r="35" fill="none" stroke="#ff3d8b" strokeWidth="1.5" />
        <circle cx="320" cy="150" r="3" fill="#ffd166" />
        {[0,1,2,3,4,5,6,7].map((i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1="320"
              y1="150"
              x2={320 + Math.cos(a) * 35}
              y2={150 + Math.sin(a) * 35}
              stroke="#00f0ff"
              strokeWidth="0.8"
            />
          );
        })}
      </g>
      {/* 椰子 */}
      <Palm x={40} scale={1.2} />
      <Palm x={220} scale={0.9} />
      <Palm x={380} scale={1} />
    </g>
  );
}

function HollywoodHills() {
  return (
    <g>
      {/* 山 */}
      <path d="M0,230 L80,160 L160,210 L240,150 L320,195 L400,165 L400,240 L0,240 Z" fill="#3a0d5c" />
      <path d="M0,240 L100,195 L200,230 L300,200 L400,225 L400,240 Z" fill="#1a0433" />
      {/* HOLLYWOOD サイン */}
      <g fill="#fff" stroke="#111" strokeWidth="0.5">
        {"HOLLYWOOD".split("").map((ch, i) => (
          <g key={i} transform={`translate(${168 + i * 10}, 140)`}>
            <rect width="8" height="14" />
            <text x="1.5" y="10" fontSize="9" fontWeight="900" fill="#111" fontFamily="monospace">
              {ch}
            </text>
          </g>
        ))}
      </g>
      {/* 椰子 */}
      <Palm x={40} scale={1} />
      <Palm x={360} scale={1.1} />
    </g>
  );
}

function KTownNight() {
  return (
    <g>
      {/* 低層~中層の店舗密集 */}
      <g fill="#0d0322">
        <rect x="0" y="140" width="80" height="100" />
        <rect x="80" y="120" width="60" height="120" />
        <rect x="140" y="150" width="70" height="90" />
        <rect x="210" y="130" width="60" height="110" />
        <rect x="270" y="145" width="70" height="95" />
        <rect x="340" y="125" width="60" height="115" />
      </g>
      {/* ハングル風ネオン (絵ベース、実文字を避けて装飾扱い) */}
      <g>
        <rect x="8" y="150" width="60" height="16" fill="#ff3d8b" />
        <text x="12" y="163" fontSize="11" fontWeight="900" fill="#fff" fontFamily="monospace">
          K-TOWN
        </text>
        <rect x="84" y="128" width="52" height="14" fill="#00f0ff" />
        <text x="88" y="140" fontSize="10" fontWeight="900" fill="#111" fontFamily="monospace">
          24H BBQ
        </text>
        <rect x="214" y="140" width="52" height="14" fill="#ffd166" />
        <text x="218" y="152" fontSize="10" fontWeight="900" fill="#111" fontFamily="monospace">
          KARAOKE
        </text>
        <rect x="274" y="152" width="60" height="14" fill="#7b2cff" />
        <text x="278" y="164" fontSize="10" fontWeight="900" fill="#fff" fontFamily="monospace">
          NEO SOJU
        </text>
      </g>
      {/* 窓の明かり */}
      <g fill="#ffd166">
        {Array.from({ length: 40 }).map((_, i) => (
          <rect
            key={i}
            x={6 + (i * 19) % 388}
            y={160 + ((i * 9) % 70)}
            width="2"
            height="2"
            opacity={0.6 + ((i % 3) * 0.15)}
          />
        ))}
      </g>
      {/* 提灯的な光 */}
      <g fill="#ff3d8b">
        <circle cx="90" cy="180" r="3" />
        <circle cx="120" cy="180" r="3" />
        <circle cx="150" cy="180" r="3" />
      </g>
    </g>
  );
}

function RooftopSkyline() {
  return (
    <g>
      {/* 遠景スカイライン */}
      <g fill="#2b0a44">
        <rect x="0" y="150" width="50" height="90" />
        <rect x="50" y="135" width="40" height="105" />
        <rect x="90" y="155" width="60" height="85" />
        <rect x="150" y="125" width="50" height="115" />
        <rect x="200" y="150" width="45" height="90" />
        <rect x="245" y="130" width="55" height="110" />
        <rect x="300" y="140" width="50" height="100" />
        <rect x="350" y="155" width="50" height="85" />
      </g>
      {/* ネオン縦 */}
      <rect x="72" y="140" width="4" height="100" fill="#ff3d8b" />
      <rect x="172" y="130" width="4" height="110" fill="#00f0ff" />
      <rect x="272" y="135" width="4" height="105" fill="#ffd166" />
      {/* 手前のルーフトップ縁 */}
      <rect x="0" y="232" width="400" height="8" fill="#0b0614" />
      {/* グローホログラム */}
      <g opacity="0.6">
        <rect x="30" y="180" width="40" height="28" fill="none" stroke="#ff3d8b" strokeWidth="0.8" />
        <rect x="120" y="170" width="48" height="30" fill="none" stroke="#00f0ff" strokeWidth="0.8" />
      </g>
      {/* 窓 */}
      <g fill="#ffd166">
        {Array.from({ length: 50 }).map((_, i) => (
          <rect
            key={i}
            x={6 + (i * 13) % 394}
            y={138 + ((i * 8) % 90)}
            width="2"
            height="2"
            opacity={0.5 + ((i % 4) * 0.12)}
          />
        ))}
      </g>
    </g>
  );
}

function Palm({ x, scale }: { x: number; scale: number }) {
  // 椰子の木 (トランク + 葉)
  return (
    <g transform={`translate(${x}, 240) scale(${scale})`}>
      <path d="M0,0 Q-3,-50 0,-100 Q3,-50 0,0 Z" fill="#2a0b1e" />
      <g fill="#0d3a1a">
        <path d="M0,-100 Q-30,-110 -45,-95 Q-20,-100 0,-95 Z" />
        <path d="M0,-100 Q30,-110 45,-95 Q20,-100 0,-95 Z" />
        <path d="M0,-100 Q-20,-130 -35,-118 Q-12,-115 0,-102 Z" />
        <path d="M0,-100 Q20,-130 35,-118 Q12,-115 0,-102 Z" />
        <path d="M0,-100 Q-4,-130 6,-135 Q2,-118 0,-102 Z" />
      </g>
    </g>
  );
}

// UIから参照するラベル
export const BACKGROUND_LABELS: Record<AvatarBackground, string> = {
  "la-sunset-blvd": "Sunset Blvd · 夕焼け椰子並木",
  "dtla-neon": "Downtown LA · ネオン高層",
  "venice-boardwalk": "Venice · 海と観覧車",
  "hollywood-sign": "Hollywood Hills · サインと空",
  "k-town-night": "Koreatown · 夜のBBQ街",
  "rooftop-skyline": "Rooftop · スカイラインの縁",
};
