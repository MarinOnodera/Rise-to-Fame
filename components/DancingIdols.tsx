"use client";

/**
 * ステージで踊る4人のアイドルシルエット + ライト演出。
 * 画像に差し替え可能（将来）。今はCSSアニメーションのみで表現。
 */
export function DancingIdols() {
  return (
    <div className="relative h-[340px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-glow">
      {/* stage background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 110%, #ff3d8b 0%, #7b2cff 40%, #1a0a2a 80%)",
        }}
      />
      {/* spotlight cones */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute left-[18%] top-0 w-40 h-full bg-gradient-to-b from-white/40 to-transparent blur-2xl rotate-[8deg] origin-top animate-[sweep_4s_ease-in-out_infinite]" />
        <div className="absolute right-[18%] top-0 w-40 h-full bg-gradient-to-b from-kgold/40 to-transparent blur-2xl -rotate-[8deg] origin-top animate-[sweep2_5s_ease-in-out_infinite]" />
      </div>

      {/* crowd silhouettes + lightsticks */}
      <div className="absolute bottom-0 left-0 right-0 h-[60px]">
        <div className="absolute inset-x-0 bottom-0 h-10 bg-black/70" />
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="absolute bottom-6 w-1 h-4 rounded bg-kpink shadow-[0_0_10px_#ff3d8b] animate-[cheer_0.9s_ease-in-out_infinite]"
            style={{
              left: `${(i * 6.2 + 2) % 100}%`,
              animationDelay: `${i * 0.09}s`,
              background:
                i % 3 === 0
                  ? "#ffd166"
                  : i % 3 === 1
                  ? "#ff3d8b"
                  : "#7b2cff",
            }}
          />
        ))}
      </div>

      {/* dancers */}
      <div className="absolute inset-0 flex items-end justify-center gap-3 pb-16">
        <Dancer delay={0} variant={0} />
        <Dancer delay={0.15} variant={1} />
        <Dancer delay={0.3} variant={2} />
        <Dancer delay={0.45} variant={3} />
      </div>

      {/* confetti */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-sm animate-[fall_3s_linear_infinite]"
          style={{
            left: `${(i * 11 + 5) % 100}%`,
            top: `-${(i * 13) % 50}px`,
            background: i % 2 ? "#ffd166" : "#ff8ecb",
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes sweep { 0%,100% { transform: rotate(6deg) } 50% { transform: rotate(-6deg) } }
        @keyframes sweep2 { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(10deg) } }
        @keyframes cheer { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes fall { 0% { transform: translateY(-20px) rotate(0) } 100% { transform: translateY(380px) rotate(360deg) } }
        @keyframes bodybounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes hipL { 0%,100% { transform: translateX(0) rotate(0) } 50% { transform: translateX(-3px) rotate(-6deg) } }
        @keyframes hipR { 0%,100% { transform: translateX(0) rotate(0) } 50% { transform: translateX(3px) rotate(6deg) } }
        @keyframes armL { 0%,100% { transform: rotate(-20deg) } 50% { transform: rotate(-85deg) } }
        @keyframes armR { 0%,100% { transform: rotate(20deg) } 50% { transform: rotate(85deg) } }
        @keyframes head { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
      `}</style>
    </div>
  );
}

function Dancer({ delay, variant }: { delay: number; variant: number }) {
  // variantで髪色・衣装色が変わる
  const palettes = [
    { hair: "#0b0614", outfit: "#ff3d8b", skin: "#f5d7b8" },
    { hair: "#ffd166", outfit: "#7b2cff", skin: "#e9b893" },
    { hair: "#ff8ecb", outfit: "#00e5ff", skin: "#f3c49a" },
    { hair: "#3a1a5a", outfit: "#ffd166", skin: "#d8a77b" },
  ];
  const p = palettes[variant % palettes.length];
  const d = `${delay}s`;
  return (
    <div
      className="relative w-14 h-40"
      style={{ animation: `bodybounce 0.6s ease-in-out ${d} infinite` }}
    >
      {/* head */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-8 h-8 rounded-full"
        style={{
          background: p.skin,
          boxShadow: `inset 0 -8px 0 ${p.hair}, 0 -4px 0 ${p.hair}`,
          animation: `head 0.6s ease-in-out ${d} infinite`,
        }}
      >
        {/* hair crown */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-4 rounded-t-full"
          style={{ background: p.hair }}
        />
        {/* eyes */}
        <div className="absolute top-3 left-1.5 w-1 h-1 rounded-full bg-black" />
        <div className="absolute top-3 right-1.5 w-1 h-1 rounded-full bg-black" />
        {/* smile */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2 h-0.5 rounded-full bg-kpink" />
      </div>

      {/* torso */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-8 w-8 h-12 rounded-md"
        style={{ background: p.outfit }}
      />

      {/* arms */}
      <div
        className="absolute top-9 left-0 w-2 h-10 rounded-full origin-top"
        style={{
          background: p.skin,
          animation: `armL 0.6s ease-in-out ${d} infinite`,
        }}
      />
      <div
        className="absolute top-9 right-0 w-2 h-10 rounded-full origin-top"
        style={{
          background: p.skin,
          animation: `armR 0.6s ease-in-out ${d} infinite`,
        }}
      />

      {/* legs */}
      <div
        className="absolute bottom-0 left-2 w-2.5 h-14 rounded-full origin-top"
        style={{
          background: p.hair,
          animation: `hipL 0.6s ease-in-out ${d} infinite`,
        }}
      />
      <div
        className="absolute bottom-0 right-2 w-2.5 h-14 rounded-full origin-top"
        style={{
          background: p.hair,
          animation: `hipR 0.6s ease-in-out ${d} infinite`,
        }}
      />
      {/* shoes */}
      <div className="absolute bottom-[-2px] left-1 w-4 h-2 rounded bg-white/90" />
      <div className="absolute bottom-[-2px] right-1 w-4 h-2 rounded bg-white/90" />
    </div>
  );
}
