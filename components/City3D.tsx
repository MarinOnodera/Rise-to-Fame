"use client";

/**
 * 3D サイバーパンク LA × Seoul ストリート。
 * - 自分のアバター (UserAvatar) を三人称視点で操作。
 * - モバイル: 左下バーチャルジョイスティックで全方位移動 / 右側ドラッグでカメラ回転。
 * - デスクトップ: WASD/矢印で移動 / マウスドラッグでカメラ回転。
 * - 移動はカメラ相対 (Robloxと同じ感覚)。
 *
 * SSR 回避: このファイル全体は "use client" で、import 側で dynamic({ ssr:false })
 * すれば確実に Three.js が window を参照するタイミングを制御できる。
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import type { UserAvatar } from "@/lib/types";
import { useGame } from "@/lib/store";
import { deriveSlotKind } from "@/lib/ads";

// 決定論的乱数 (seed 固定で街並みを安定させる)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== 入力ハブ (ジョイスティック + キーボード + カメラドラッグ) =====
type InputState = {
  move: { x: number; y: number }; // -1..1, y は前(-1)/後ろ(+1)
  camYaw: number;                 // ラジアン
  camPitch: number;               // ラジアン
};

function makeInputState(): InputState {
  return { move: { x: 0, y: 0 }, camYaw: 0, camPitch: 0.45 };
}

// ===== バーチャルジョイスティック (左下) =====
function VirtualJoystick({
  onChange,
}: {
  onChange: (x: number, y: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const startRef = useRef<{ cx: number; cy: number; pid: number } | null>(null);
  const RADIUS = 52;

  function start(e: React.PointerEvent) {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    startRef.current = {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      pid: e.pointerId,
    };
    el.setPointerCapture(e.pointerId);
    move(e);
  }
  function move(e: React.PointerEvent) {
    const s = startRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const dx = e.clientX - s.cx;
    const dy = e.clientY - s.cy;
    const dist = Math.min(Math.hypot(dx, dy), RADIUS);
    const ang = Math.atan2(dy, dx);
    const x = (dist / RADIUS) * Math.cos(ang);
    const y = (dist / RADIUS) * Math.sin(ang);
    setKnob({ x: x * RADIUS, y: y * RADIUS });
    onChange(x, y);
  }
  function end(e: React.PointerEvent) {
    if (startRef.current?.pid !== e.pointerId) return;
    startRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <div
      ref={baseRef}
      className="absolute left-4 bottom-4 z-30 w-32 h-32 rounded-full bg-black/35 border-2 border-white/25 backdrop-blur touch-none select-none"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      aria-label="移動コントローラー"
    >
      <div
        className="absolute top-1/2 left-1/2 w-12 h-12 -mt-6 -ml-6 rounded-full bg-gradient-to-br from-kpink to-kpurple shadow-glow border border-white/40 pointer-events-none"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/40 pointer-events-none">
        MOVE
      </div>
    </div>
  );
}

// ===== カメラドラッグ領域 (画面右側で指/マウスをスワイプ) =====
function CameraDragArea({
  onDelta,
}: {
  onDelta: (dx: number, dy: number) => void;
}) {
  const lastRef = useRef<{ x: number; y: number; pid: number } | null>(null);
  function start(e: React.PointerEvent) {
    lastRef.current = { x: e.clientX, y: e.clientY, pid: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const s = lastRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    lastRef.current = { x: e.clientX, y: e.clientY, pid: e.pointerId };
    onDelta(dx, dy);
  }
  function end(e: React.PointerEvent) {
    if (lastRef.current?.pid !== e.pointerId) return;
    lastRef.current = null;
  }
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1/2 z-20 touch-none"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      aria-label="カメラ回転"
    />
  );
}

// ===== 3D アバター (UserAvatar の色相を反映したローポリ) =====
function Avatar3D({
  avatar,
  walkPhase,
}: {
  avatar: UserAvatar;
  walkPhase: number;
}) {
  const skin = useMemo(
    () => new THREE.Color(`hsl(${avatar.skinHue}, 50%, 70%)`),
    [avatar.skinHue]
  );
  const hair = useMemo(
    () => new THREE.Color(`hsl(${avatar.hairHue}, 70%, 55%)`),
    [avatar.hairHue]
  );
  const eye = useMemo(
    () => new THREE.Color(`hsl(${avatar.eyeHue}, 80%, 50%)`),
    [avatar.eyeHue]
  );
  const lip = useMemo(
    () => new THREE.Color(`hsl(${avatar.lipHue}, 80%, 55%)`),
    [avatar.lipHue]
  );
  const outA = useMemo(
    () => new THREE.Color(`hsl(${avatar.outfitHueA}, 70%, 50%)`),
    [avatar.outfitHueA]
  );
  const outB = useMemo(
    () => new THREE.Color(`hsl(${avatar.outfitHueB}, 70%, 45%)`),
    [avatar.outfitHueB]
  );

  const swingLeg = Math.sin(walkPhase) * 0.55;
  const swingArm = Math.sin(walkPhase + Math.PI) * 0.45;

  return (
    <group>
      {/* Head (丸く高解像度な球: カクカク感を排除) */}
      <mesh position={[0, 1.6, 0]} scale={[1, 1.08, 1]} castShadow>
        <sphereGeometry args={[0.23, 48, 48]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      {/* Eyes (front emissive dots) */}
      <mesh position={[-0.06, 1.63, 0.16]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial
          color={eye}
          emissive={eye}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.06, 1.63, 0.16]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial
          color={eye}
          emissive={eye}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {/* Lip */}
      <mesh position={[0, 1.55, 0.17]}>
        <boxGeometry args={[0.06, 0.012, 0.005]} />
        <meshStandardMaterial color={lip} emissive={lip} emissiveIntensity={0.4} />
      </mesh>
      {/* Hair cap (滑らかな半ドーム + 束感のある曲面) */}
      <mesh position={[0, 1.66, -0.015]} scale={[1.04, 0.9, 1.06]} castShadow>
        {/* 上半球だけの部分球にして、頭の形にフィットするヘア */}
        <sphereGeometry
          args={[0.255, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.6]}
        />
        <meshStandardMaterial color={hair} roughness={0.5} />
      </mesh>
      {/* 前髪 (丸みのある束) */}
      <mesh position={[0, 1.58, 0.17]} rotation={[-0.25, 0, 0]} castShadow>
        <sphereGeometry
          args={[0.2, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.42]}
        />
        <meshStandardMaterial color={hair} roughness={0.5} />
      </mesh>
      {/* 長髪系: 背中に流れるロングヘア (ボックスやめてカプセル + 末広がり) */}
      {(avatar.parts.hair === "long-straight" ||
        avatar.parts.hair === "long-wave") && (
        <mesh
          position={[0, 1.28, -0.17]}
          rotation={[0.08, 0, 0]}
          scale={[1.05, 1, 0.55]}
          castShadow
        >
          <capsuleGeometry args={[0.17, 0.52, 8, 20]} />
          <meshStandardMaterial color={hair} roughness={0.55} />
        </mesh>
      )}
      {/* ポニーテール: 結び目 + 後ろに流れる尻尾 */}
      {avatar.parts.hair === "ponytail" && (
        <>
          <mesh position={[0, 1.66, -0.2]} castShadow>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial color={hair} roughness={0.55} />
          </mesh>
          <mesh
            position={[0, 1.42, -0.3]}
            rotation={[0.55, 0, 0]}
            scale={[0.7, 1, 0.7]}
            castShadow
          >
            <capsuleGeometry args={[0.08, 0.38, 8, 16]} />
            <meshStandardMaterial color={hair} roughness={0.55} />
          </mesh>
        </>
      )}
      {/* ボブ: あごのラインに丸くまとまる */}
      {avatar.parts.hair === "bob" && (
        <mesh
          position={[0, 1.48, -0.02]}
          scale={[1.1, 1.15, 1.12]}
          castShadow
        >
          <sphereGeometry
            args={[0.23, 40, 40, 0, Math.PI * 2, 0, Math.PI * 0.78]}
          />
          <meshStandardMaterial color={hair} roughness={0.5} />
        </mesh>
      )}
      {/* ツインお団子 */}
      {avatar.parts.hair === "twin-buns" && (
        <>
          <mesh position={[0.22, 1.82, -0.02]} castShadow>
            <sphereGeometry args={[0.1, 24, 24]} />
            <meshStandardMaterial color={hair} roughness={0.5} />
          </mesh>
          <mesh position={[-0.22, 1.82, -0.02]} castShadow>
            <sphereGeometry args={[0.1, 24, 24]} />
            <meshStandardMaterial color={hair} roughness={0.5} />
          </mesh>
        </>
      )}
      {/* ハーフアップ: 小さな結び目 + ゆるやかな後ろ髪 */}
      {avatar.parts.hair === "half-up" && (
        <>
          <mesh position={[0, 1.84, -0.06]} castShadow>
            <sphereGeometry args={[0.08, 24, 24]} />
            <meshStandardMaterial color={hair} roughness={0.5} />
          </mesh>
          <mesh
            position={[0, 1.4, -0.17]}
            scale={[1, 1, 0.55]}
            castShadow
          >
            <capsuleGeometry args={[0.14, 0.3, 8, 16]} />
            <meshStandardMaterial color={hair} roughness={0.55} />
          </mesh>
        </>
      )}
      {/* モヒカン・フェード: 細く高い稜線 */}
      {avatar.parts.hair === "mohawk-fade" && (
        <mesh
          position={[0, 1.82, 0]}
          scale={[0.35, 1, 1]}
          rotation={[0, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.08, 0.2, 8, 16]} />
          <meshStandardMaterial color={hair} roughness={0.45} />
        </mesh>
      )}
      {/* Torso (outfit A) */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[0.44, 0.6, 0.26]} />
        <meshStandardMaterial
          color={outA}
          emissive={outA}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Belt accent (outfit B) */}
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.28]} />
        <meshStandardMaterial
          color={outB}
          emissive={outB}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Arms */}
      <group position={[0.27, 1.4, 0]}>
        <mesh rotation={[swingArm, 0, 0.12]} position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group position={[-0.27, 1.4, 0]}>
        <mesh rotation={[-swingArm, 0, -0.12]} position={[0, -0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      {/* Legs (outfit B) */}
      <group position={[0.12, 0.82, 0]}>
        <mesh rotation={[swingLeg, 0, 0]} position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.16, 0.72, 0.16]} />
          <meshStandardMaterial color={outB} />
        </mesh>
      </group>
      <group position={[-0.12, 0.82, 0]}>
        <mesh rotation={[-swingLeg, 0, 0]} position={[0, -0.36, 0]} castShadow>
          <boxGeometry args={[0.16, 0.72, 0.16]} />
          <meshStandardMaterial color={outB} />
        </mesh>
      </group>
      {/* アクセサリー (簡易ヒント) */}
      {avatar.parts.accessory === "neon-shades" && (
        <mesh position={[0, 1.65, 0.17]}>
          <boxGeometry args={[0.28, 0.06, 0.02]} />
          <meshStandardMaterial
            color="#000"
            emissive="#ff3d8b"
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>
      )}
      {avatar.parts.accessory === "halo-ring" && (
        <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.02, 8, 24]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffd166"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ===== 写真館 (街中の 3D 建物。ドアから /gallery に入る) =====
function PhotoHall() {
  const { x, z, w, d, h, doorOffsetX, doorW, hue } = PHOTO_HALL;
  const wallMat = useMemo(
    () => new THREE.Color(`hsl(${hue}, 50%, 20%)`),
    []
  );
  const accent = useMemo(
    () => new THREE.Color(`hsl(${(hue + 40) % 360}, 90%, 65%)`),
    []
  );

  // 前面 (z + d/2) だけドア開口を作る。左右のパネルで開口を挟む。
  const frontZ = d / 2 + 0.01;
  const leftW = (w - doorW) / 2;   // ドア左側のパネル幅
  const leftCx = -doorW / 2 - leftW / 2 + doorOffsetX;
  const rightCx = doorW / 2 + leftW / 2 + doorOffsetX;

  // 看板テクスチャ
  const signTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, "#ff3d8b");
    g.addColorStop(1, "#ffd166");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#1a0820";
    ctx.font = "bold 120px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📷 PHOTO HALL", 512, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <group position={[x, 0, z]}>
      {/* 背面 */}
      <mesh position={[0, h / 2, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.3]} />
        <meshStandardMaterial color={wallMat} />
      </mesh>
      {/* 左壁 */}
      <mesh position={[-w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, h, d]} />
        <meshStandardMaterial color={wallMat} />
      </mesh>
      {/* 右壁 */}
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, h, d]} />
        <meshStandardMaterial color={wallMat} />
      </mesh>
      {/* 屋根 */}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.3, d]} />
        <meshStandardMaterial color={wallMat} />
      </mesh>
      {/* 前面ドア左右のパネル (ドア開口を作るために分割) */}
      {leftW > 0 && (
        <mesh
          position={[leftCx, h / 2, frontZ - 0.01]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[leftW, h, 0.3]} />
          <meshStandardMaterial color={wallMat} />
        </mesh>
      )}
      {leftW > 0 && (
        <mesh
          position={[rightCx, h / 2, frontZ - 0.01]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[leftW, h, 0.3]} />
          <meshStandardMaterial color={wallMat} />
        </mesh>
      )}
      {/* ドア枠 (ネオン) */}
      <mesh position={[doorOffsetX, h * 0.55, frontZ]}>
        <planeGeometry args={[doorW + 0.3, h * 0.75]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.3}
          transparent
          opacity={0.25}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 看板 */}
      {signTex && (
        <mesh position={[doorOffsetX, h + 0.9, frontZ + 0.2]}>
          <planeGeometry args={[w * 0.9, 1.6]} />
          <meshStandardMaterial
            map={signTex}
            emissive={"#ffffff"}
            emissiveMap={signTex}
            emissiveIntensity={1.1}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* 入口前の誘導灯 */}
      <pointLight
        position={[doorOffsetX, 2.5, frontZ + 1.2]}
        intensity={1.6}
        color={accent}
        distance={10}
      />
    </group>
  );
}

// ===== ビル =====
function Building({
  x,
  z,
  w,
  d,
  h,
  hue,
  label,
  type,
}: BuildingBox) {
  const base = useMemo(
    () => new THREE.Color(`hsl(${hue}, 35%, 14%)`),
    [hue]
  );
  const accent = useMemo(
    () => new THREE.Color(`hsl(${(hue + 40) % 360}, 90%, 60%)`),
    [hue]
  );

  // 看板テクスチャ (label がある建物のみ)
  const signTex = useMemo(() => {
    if (!label || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    // 背景: ビルの accent 色に合わせたグラデーション
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    const acHex = `hsl(${(hue + 40) % 360}, 90%, 25%)`;
    const acHex2 = `hsl(${(hue + 80) % 360}, 80%, 15%)`;
    g.addColorStop(0, acHex);
    g.addColorStop(1, acHex2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 128);
    // 枠線 (ネオン風)
    ctx.strokeStyle = `hsl(${(hue + 40) % 360}, 100%, 70%)`;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 120);
    // テキスト
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = `hsl(${(hue + 40) % 360}, 100%, 60%)`;
    ctx.shadowBlur = 12;
    ctx.fillText(label, 256, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [label, hue]);

  const signW = Math.min(w * 0.95, 6);
  const signH = signW * 0.25;

  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={base} />
      </mesh>
      {/* 上部ネオン帯 (前面) */}
      <mesh position={[0, h / 2 - 0.2, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.85, 0.3]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      {/* 上部ネオン帯 (側面) */}
      <mesh
        position={[w / 2 + 0.02, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[d * 0.85, 0.3]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* 窓 */}
      <Windows w={w} h={h} d={d} hue={hue} />
      {/* 看板 (ラベル付きビルのみ) */}
      {signTex && (
        <mesh position={[0, h / 2 * 0.35, d / 2 + 0.05]}>
          <planeGeometry args={[signW, signH]} />
          <meshStandardMaterial
            map={signTex}
            emissive="#ffffff"
            emissiveMap={signTex}
            emissiveIntensity={1.2}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* コンサート会場は入口を強調 */}
      {type === "concert" && (
        <>
          {/* アーチ入口 */}
          <mesh position={[0, -h / 2 + 2.5, d / 2 + 0.06]}>
            <planeGeometry args={[3.5, 5]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.8}
              transparent
              opacity={0.3}
              toneMapped={false}
            />
          </mesh>
          {/* 屋上のドーム */}
          <mesh position={[0, h / 2 + 1.2, 0]}>
            <sphereGeometry args={[3.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial
              color={base}
              emissive={accent}
              emissiveIntensity={0.4}
              toneMapped={false}
            />
          </mesh>
          {/* スポットライト (天井から2本) */}
          <pointLight
            position={[-2, h / 2 + 3, 0]}
            intensity={2}
            color={accent}
            distance={18}
          />
          <pointLight
            position={[2, h / 2 + 3, 0]}
            intensity={2}
            color="#ffd166"
            distance={18}
          />
        </>
      )}
      {/* カフェは1F入口にウォームライト */}
      {type === "cafe" && (
        <pointLight
          position={[0, -h / 2 + 1.5, d / 2 + 1]}
          intensity={1.2}
          color="#ffd166"
          distance={8}
        />
      )}
    </group>
  );
}

function Windows({
  w,
  h,
  d,
  hue,
}: {
  w: number;
  h: number;
  d: number;
  hue: number;
}) {
  const items = useMemo(() => {
    const rng = mulberry32(Math.floor(w * 1000 + h * 100 + d * 10));
    const out: { x: number; y: number; on: boolean }[] = [];
    const cols = Math.max(2, Math.floor(w / 0.8));
    const rows = Math.max(3, Math.floor(h / 1.2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({
          x: -w / 2 + (c + 0.5) * (w / cols),
          y: -h / 2 + (r + 0.5) * (h / rows),
          on: rng() > 0.35,
        });
      }
    }
    return out;
  }, [w, h, d]);
  const litCol = useMemo(
    () => new THREE.Color(`hsl(${(hue + 200) % 360}, 100%, 70%)`),
    [hue]
  );
  return (
    <group position={[0, 0, d / 2 + 0.01]}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, 0]}>
          <planeGeometry args={[0.18, 0.32]} />
          <meshStandardMaterial
            color={it.on ? litCol : "#0a0612"}
            emissive={it.on ? litCol : "#000"}
            emissiveIntensity={it.on ? 1.4 : 0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ===== 中央広場 (噴水 + ステージ) =====
function CentralPlaza() {
  const waterCol = useMemo(() => new THREE.Color("#00e6ff"), []);
  return (
    <group position={[0, 0, 0]}>
      {/* 広場の床 (円形タイル) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial
          color="#1a0a30"
          emissive="#2a1050"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* 噴水ベース */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[2.5, 3, 0.8, 32]} />
        <meshStandardMaterial color="#2a1050" />
      </mesh>
      {/* 水面 */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[2.3, 2.3, 0.05, 32]} />
        <meshStandardMaterial
          color={waterCol}
          emissive={waterCol}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
      {/* 中央柱 */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 2.4, 12]} />
        <meshStandardMaterial
          color="#d4af37"
          emissive="#ffd166"
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
      {/* 上部の星オブジェ */}
      <mesh position={[0, 3.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.5]} />
        <meshStandardMaterial
          color="#ffd166"
          emissive="#ffd166"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* 噴水ライト */}
      <pointLight
        position={[0, 2, 0]}
        intensity={2.5}
        color="#00e6ff"
        distance={15}
      />
      {/* 広場四隅のネオンポール */}
      {[
        [5.5, 5.5],
        [-5.5, 5.5],
        [5.5, -5.5],
        [-5.5, -5.5],
      ].map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 3, 8]} />
            <meshStandardMaterial color="#1a0a30" />
          </mesh>
          <pointLight
            position={[0, 3, 0]}
            intensity={0.9}
            color={i % 2 === 0 ? "#ff3d8b" : "#7b2cff"}
            distance={10}
          />
        </group>
      ))}
    </group>
  );
}

// ===== エリア名の地面標識 =====
function AreaSign({
  x,
  z,
  text,
  rotY = 0,
}: {
  x: number;
  z: number;
  text: string;
  rotY?: number;
}) {
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgba(20, 8, 40, 0.85)";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#7b2cff";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 8;
    ctx.fillText(text, 256, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);

  return tex ? (
    <mesh
      rotation={[-Math.PI / 2, 0, rotY]}
      position={[x, 0.03, z]}
    >
      <planeGeometry args={[5, 1.3]} />
      <meshStandardMaterial
        map={tex}
        emissive="#ffffff"
        emissiveMap={tex}
        emissiveIntensity={0.8}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  ) : null;
}

// ===== ヤシの木 =====
function Palm({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const leaves = [0, 1, 2, 3, 4, 5];
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 4, 10]} />
        <meshStandardMaterial color="#3a2812" />
      </mesh>
      {leaves.map((i) => {
        const a = (i / leaves.length) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.7, 4.05, Math.sin(a) * 0.7]}
            rotation={[0, -a, Math.PI / 2.6]}
            castShadow
          >
            <boxGeometry args={[1.6, 0.07, 0.45]} />
            <meshStandardMaterial color="#1f6b3a" />
          </mesh>
        );
      })}
    </group>
  );
}

// ===== 街レイアウト (City と Player で共有) =====
// 当たり判定のために、ビル群の AABB を両方から参照できるよう module レベルに置く。
// seed 固定なのでマウントごとに再生成しても同じ並びになる。

export interface BuildingBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: number;
  label?: string; // 看板テキスト (CanvasTexture で前面に焼き込む)
  type?: "normal" | "concert" | "cafe" | "shop" | "agency" | "residence" | "station";
}

/**
 * MarinLuna Seoul エリアマップ構造。
 *
 *   NW: 事務所エリア          NE: エンタメ通り
 *           道路 (x=0, 南北)
 *   SW: 住宅 & 写真館         SE: ショッピング & 練習生通り
 *
 * 中央に広場 (噴水 + ステージ)。
 * 周辺は遠景スカイラインとして大型ビル群を配置。
 */
export function makeBuildings(): BuildingBox[] {
  const out: BuildingBox[] = [];

  // ===== NE: エンタメ通り (Entertainment District) =====
  out.push(
    // コンサート会場 (最大の建物)
    { x: 20, z: -24, w: 14, d: 12, h: 13, hue: 280, label: "🎤 CONCERT HALL", type: "concert" },
    // ライブハウス
    { x: 30, z: -12, w: 6, d: 5, h: 9, hue: 330, label: "🎵 LIVE HOUSE" },
    // 放送局
    { x: 32, z: -24, w: 5, d: 5, h: 18, hue: 260, label: "📺 MBC STUDIO" },
    // レコーディングスタジオ
    { x: 28, z: -5, w: 5, d: 4, h: 8, hue: 290, label: "🎧 REC STUDIO" },
  );

  // ===== SE: ショッピング & 練習生通り =====
  out.push(
    // カフェ
    { x: 15, z: 5, w: 6, d: 5, h: 7, hue: 340, label: "☕ CLOUD NINE", type: "cafe" },
    // アイドルショップ
    { x: 24, z: 3, w: 5, d: 5, h: 9, hue: 40, label: "🛍️ IDOL SHOP", type: "shop" },
    // レストラン
    { x: 18, z: 14, w: 7, d: 5, h: 6, hue: 15, label: "🍜 HOT POT 24" },
    // テックストア
    { x: 28, z: 10, w: 5, d: 4, h: 12, hue: 200, label: "📱 NEOFOLD" },
    // ドリンクバー
    { x: 22, z: 20, w: 5, d: 4, h: 6, hue: 180, label: "🧋 PICO SODA" },
    // オーディション会場
    { x: 18, z: 28, w: 8, d: 6, h: 9, hue: 270, label: "🎭 AUDITION HALL" },
    // 練習場
    { x: 30, z: 26, w: 6, d: 5, h: 10, hue: 250, label: "💪 TRAINING CTR" },
  );

  // ===== NW: 事務所エリア (Agency District) =====
  out.push(
    // エージェンシータワー
    { x: -20, z: -25, w: 7, d: 6, h: 22, hue: 270, label: "🏢 AGENCY TOWER", type: "agency" },
    // ファッションブランド本社
    { x: -28, z: -18, w: 6, d: 5, h: 14, hue: 45, label: "👗 ATELIER SEOUL", type: "agency" },
    // マネジメント事務所
    { x: -20, z: -15, w: 5, d: 5, h: 12, hue: 230, label: "📊 MANAGEMENT" },
    // MarinLuna 本部 (ゲーム運営)
    { x: -28, z: -28, w: 8, d: 6, h: 16, hue: 310, label: "✨ MarinLuna HQ" },
  );

  // ===== SW: 住宅 & レジャー =====
  // (Photo Hall は PHOTO_HALL 定数で別管理: x=-14, z=-12)
  out.push(
    { x: -20, z: 6, w: 6, d: 5, h: 7, hue: 320, label: "🏠 RESIDENCE", type: "residence" },
    { x: -28, z: 10, w: 5, d: 5, h: 6, hue: 300, label: "🏠 APARTMENT", type: "residence" },
    { x: -22, z: 18, w: 6, d: 5, h: 5, hue: 30, label: "🐱 CAT CAFÉ", type: "cafe" },
    { x: -16, z: 26, w: 5, d: 4, h: 7, hue: 350, label: "💈 BEAUTY SALON" },
    { x: -26, z: 24, w: 5, d: 5, h: 8, hue: 210, label: "🏋️ FITNESS GYM" },
  );

  // ===== 遠景スカイライン (各方角に大型ビルを配置) =====
  const rng = mulberry32(42);
  for (let i = 0; i < 50; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 38 + rng() * 30;
    const bx = Math.cos(angle) * dist;
    const bz = Math.sin(angle) * dist;
    // 道路帯を避ける
    if (Math.abs(bx) < 6) continue;
    out.push({
      x: bx,
      z: bz,
      w: 4 + rng() * 6,
      d: 4 + rng() * 6,
      h: 10 + rng() * 30,
      hue: 230 + (rng() - 0.5) * 120,
    });
  }

  return out;
}

// 写真館: 街の特定位置に固定配置。前面 (z+d/2) 中央に 2m のドア開口がある。
// 中に入ろうとしたプレイヤーは、このドア帯 (doorX ± doorW/2) だけが通過可能。
// プレイヤーが開口を抜けて内側に立つと「入場トリガー」が発火し /gallery へ遷移。
export const PHOTO_HALL = {
  x: -14,    // 左側の街区
  z: -12,
  w: 9,
  d: 6,
  h: 7,
  doorOffsetX: 0, // 建物中心からのズレ
  doorW: 2.4,
  hue: 320,
};

// ===== 街全体 =====
function City() {
  const buildings = useMemo(() => makeBuildings(), []);

  const palms = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = -8; i <= 8; i++) {
      out.push({ x: -5.5, z: i * 6 + 2, s: 0.85 + ((i * 17) % 5) * 0.05 });
      out.push({ x: 5.5, z: i * 6 - 2, s: 0.85 + ((i * 23) % 5) * 0.05 });
    }
    return out;
  }, []);

  return (
    <group>
      {/* 地面 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[0, 0, 0]}
      >
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#120a22" />
      </mesh>
      {/* 道路 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[7, 400]} />
        <meshStandardMaterial
          color="#0a0612"
          emissive="#1a0530"
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* レーン (黄色いダッシュ) */}
      {Array.from({ length: 40 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, -195 + i * 10]}
        >
          <planeGeometry args={[0.22, 2.4]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffd166"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* === 中央広場 (Central Plaza) === */}
      <CentralPlaza />

      {/* === エリア名の地面標識 === */}
      <AreaSign x={22}  z={-18} text="🎤 ENTERTAINMENT" rotY={0} />
      <AreaSign x={22}  z={10}  text="🛍️ SHOPPING" rotY={0} />
      <AreaSign x={-22} z={-20} text="🏢 AGENCY" rotY={0} />
      <AreaSign x={-22} z={12}  text="🏠 RESIDENTIAL" rotY={0} />

      {/* === ビル群 (エリア構造 + 遠景スカイライン) === */}
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
      {/* 写真館 (MarinLuna Photo Hall) */}
      <PhotoHall />
      {/* ヤシ並木 */}
      {palms.map((p, i) => (
        <Palm key={i} x={p.x} z={p.z} scale={p.s} />
      ))}
      {/* 巨大ホログラム看板 (運営の世界観コピー) */}
      <Billboard
        x={0}
        y={14}
        z={-30}
        text="MarinLuna"
        subText="Rise to Fame"
        colorA="#ff3d8b"
        colorB="#7b2cff"
      />
      <Billboard
        x={0}
        y={12}
        z={30}
        text="📍 Seoul"
        subText="K-POP × LA STREET"
        colorA="#00e6ff"
        colorB="#7b2cff"
        rotationY={Math.PI}
      />

      {/* 街の広告枠 (admin/user/empty を slotKind バッジ付きで表示) */}
      <CityAdBoards />
    </group>
  );
}

/**
 * Zustand から ads を取り、ビル群の隙間にビルボードを配置する。
 * placement="billboard" の枠だけ採用 (路面店/バスは将来別オブジェクト化)。
 */
function CityAdBoards() {
  const ads = useGame((s) => s.ads);
  const groups = useGame((s) => s.groups);

  // 広告枠をエリアのビル壁面に配置する。
  // 固定スロット位置を用意し、ads から順に割り当てる。
  const SLOTS: { px: number; py: number; pz: number; rotY: number }[] = [
    // エンタメ通り北側 (コンサート会場横)
    { px: 12, py: 10, pz: -24, rotY: Math.PI / 2 },
    // 事務所エリア (Agency Tower 横)
    { px: -12, py: 12, pz: -25, rotY: -Math.PI / 2 },
    // ショッピング通り (道路沿い)
    { px: 8, py: 8, pz: 5, rotY: Math.PI / 2 },
    // 住宅エリア側
    { px: -10, py: 7, pz: 10, rotY: -Math.PI / 2 },
    // 練習生通り
    { px: 12, py: 8, pz: 22, rotY: Math.PI / 2 },
    // MarinLuna HQ 近く
    { px: -18, py: 10, pz: -32, rotY: 0 },
  ];

  const items = useMemo(() => {
    const billboards = ads.filter((a) => a.placement === "billboard").slice(0, SLOTS.length);
    return billboards.map((ad, i) => ({
      ad,
      ...SLOTS[i % SLOTS.length],
    }));
  }, [ads]);

  return (
    <>
      {items.map(({ ad, px, py, pz, rotY }) => {
        const kind = deriveSlotKind(ad);
        const sponsor =
          kind === "user"
            ? groups.find((g) => g.id === ad.promoteGroupId)?.name
            : undefined;
        const text = kind === "empty" ? "AD SPACE" : ad.brand;
        const sub = kind === "empty" ? "募集中" : ad.product;
        return (
          <Billboard
            key={ad.id}
            x={px}
            y={py}
            z={pz}
            rotationY={rotY}
            text={text}
            subText={sub}
            colorA={ad.colorA}
            colorB={ad.colorB}
            slotKind={kind}
            sponsor={sponsor}
            width={10}
            height={2.6}
          />
        );
      })}
    </>
  );
}

function Billboard({
  x,
  y,
  z,
  text,
  subText,
  colorA = "#ff3d8b",
  colorB = "#7b2cff",
  slotKind,
  sponsor,
  rotationY = 0,
  width = 14,
  height = 3.5,
}: {
  x: number;
  y: number;
  z: number;
  text: string;
  subText?: string;
  colorA?: string;
  colorB?: string;
  // 表示バッジ: admin → "PR", user → "SPONSORED by 〇〇", empty → "AVAILABLE"
  slotKind?: "admin" | "user" | "empty";
  sponsor?: string;
  rotationY?: number;
  width?: number;
  height?: number;
}) {
  // 単純なエミッシブ板。文字は CanvasTexture で焼き込む。
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    // メインテキスト
    ctx.fillStyle = "#fff";
    ctx.font = subText ? "bold 110px sans-serif" : "bold 140px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, subText ? 100 : 128);

    if (subText) {
      ctx.font = "600 52px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(subText, 512, 188);
    }

    // 左上の slotKind バッジ
    if (slotKind) {
      const badge =
        slotKind === "admin"
          ? "PR"
          : slotKind === "user"
            ? `SPONSORED${sponsor ? ` by ${sponsor}` : ""}`
            : "AVAILABLE";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const padX = 18;
      const padY = 10;
      const textW = ctx.measureText(badge).width;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(16, 16, textW + padX * 2, 48);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(badge, 16 + padX, 16 + padY);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, subText, colorA, colorB, slotKind, sponsor]);

  return (
    <mesh position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={tex ?? undefined}
        emissive={"#ffffff"}
        emissiveIntensity={0.9}
        emissiveMap={tex ?? undefined}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ===== プレイヤー (アバター + 物理移動 + 三人称カメラ) =====
// プレイヤー半径 (AABB 衝突判定用)。アバターの胴体幅に合わせる。
const PLAYER_RADIUS = 0.45;

/**
 * AABB 衝突チェック。与えられた (px, pz) がどれかのビル矩形を侵すか。
 * 写真館だけは「ドア開口内」なら侵入許可 (通過できる)。
 */
function collidesBuildings(
  px: number,
  pz: number,
  buildings: BuildingBox[]
): boolean {
  const r = PLAYER_RADIUS;
  // 通常ビル
  for (const b of buildings) {
    if (
      Math.abs(px - b.x) < b.w / 2 + r &&
      Math.abs(pz - b.z) < b.d / 2 + r
    ) {
      return true;
    }
  }
  // 写真館: ドア開口を除いた壁のみブロック。
  const h = PHOTO_HALL;
  const dxh = px - h.x;
  const dzh = pz - h.z;
  const inBounds =
    Math.abs(dxh) < h.w / 2 + r && Math.abs(dzh) < h.d / 2 + r;
  if (inBounds) {
    // ドア帯 (前面、z > h.z + h.d/2 - thickness の付近、|dx - doorOffsetX| < doorW/2)
    const nearFront = dzh > h.d / 2 - r - 0.4; // 前面 ±壁厚
    const inDoorStrip = Math.abs(dxh - h.doorOffsetX) < h.doorW / 2 - r * 0.5;
    if (nearFront && inDoorStrip) {
      // ドア通過中 → 非衝突
      return false;
    }
    return true;
  }
  return false;
}

function Player({
  avatar,
  input,
  onEnterGallery,
}: {
  avatar: UserAvatar;
  input: React.MutableRefObject<InputState>;
  onEnterGallery?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const yawRef = useRef(0); // アバターの向き
  const walkRef = useRef(0); // アニメ位相
  const posRef = useRef(new THREE.Vector3(0, 0, 4));
  const insideHallRef = useRef(false); // エッジトリガー用
  const { camera } = useThree();
  const buildings = useMemo(() => makeBuildings(), []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05); // 大きい dt はクランプ
    const { x: jx, y: jy } = input.current.move;
    const camYaw = input.current.camYaw;
    const camPitch = THREE.MathUtils.clamp(input.current.camPitch, 0.15, 1.0);

    // カメラ相対の移動方向を計算
    // forward = カメラ→アバター方向 (画面奥), right = 画面右方向。
    // right = cross(forward, up) を Three.js (y-up 右手系) で展開すると
    // rightX = -cos(yaw), rightZ = sin(yaw) になる。
    // ここを誤ると左右が逆になるので要注意。
    const speed = 5.5;
    const mag = Math.hypot(jx, jy);
    const forwardX = Math.sin(camYaw);
    const forwardZ = Math.cos(camYaw);
    const rightX = -Math.cos(camYaw);
    const rightZ = Math.sin(camYaw);

    let dx = 0;
    let dz = 0;
    if (mag > 0.05) {
      // jy<0=前, jx>0=右
      dx = (rightX * jx + forwardX * -jy) * speed * dtc;
      dz = (rightZ * jx + forwardZ * -jy) * speed * dtc;
    }

    // スライド衝突: X/Z 軸を独立に試して、壁にぶつかった軸だけ戻す
    const nextX = THREE.MathUtils.clamp(posRef.current.x + dx, -70, 70);
    const nextZ = THREE.MathUtils.clamp(posRef.current.z + dz, -90, 90);
    if (!collidesBuildings(nextX, posRef.current.z, buildings)) {
      posRef.current.x = nextX;
    }
    if (!collidesBuildings(posRef.current.x, nextZ, buildings)) {
      posRef.current.z = nextZ;
    }

    // 写真館の内側に入った瞬間だけ遷移 (エッジトリガー)
    const h = PHOTO_HALL;
    const insideHall =
      Math.abs(posRef.current.x - h.x) < h.w / 2 - PLAYER_RADIUS &&
      Math.abs(posRef.current.z - h.z) < h.d / 2 - PLAYER_RADIUS;
    if (insideHall && !insideHallRef.current && onEnterGallery) {
      onEnterGallery();
    }
    insideHallRef.current = insideHall;

    // アバターの向きを移動方向にスムーズ追従
    if (mag > 0.1) {
      const targetYaw = Math.atan2(dx, dz);
      const cur = yawRef.current;
      let diff = targetYaw - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yawRef.current = cur + diff * Math.min(1, dtc * 12);
      walkRef.current += dtc * 9 * Math.min(1, mag * 1.5);
    } else {
      // 歩行アニメは止める (idle)
      walkRef.current += dtc * 0.5;
    }

    if (groupRef.current) {
      groupRef.current.position.set(
        posRef.current.x,
        0,
        posRef.current.z
      );
      groupRef.current.rotation.y = yawRef.current;
    }

    // 三人称カメラ: アバターから (camYaw, camPitch) 方向後方に距離Dの位置
    const D = 5.5;
    const camOffsetX = Math.sin(camYaw) * Math.cos(camPitch) * D;
    const camOffsetZ = Math.cos(camYaw) * Math.cos(camPitch) * D;
    const camOffsetY = Math.sin(camPitch) * D + 1.6;
    const targetCam = new THREE.Vector3(
      posRef.current.x - camOffsetX,
      camOffsetY,
      posRef.current.z - camOffsetZ
    );
    camera.position.lerp(targetCam, 1 - Math.pow(0.001, dtc));
    camera.lookAt(
      posRef.current.x,
      1.4,
      posRef.current.z
    );
  });

  return (
    <group ref={groupRef}>
      <Avatar3D avatar={avatar} walkPhase={walkRef.current} />
    </group>
  );
}

// ===== ライティング & シーン全体 =====
function SceneInner({
  avatar,
  input,
  onEnterGallery,
}: {
  avatar: UserAvatar;
  input: React.MutableRefObject<InputState>;
  onEnterGallery?: () => void;
}) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x1a0a2e, 0.012);
    scene.background = new THREE.Color(0x14081e);
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.45} color="#7c66c4" />
      <hemisphereLight args={["#ff8acc", "#1a0a30", 0.6]} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={0.9}
        color="#ffd6f0"
        castShadow
      />
      {/* ネオン感を出す追加ポイントライト (中央) */}
      <pointLight position={[0, 8, 0]} intensity={1.6} color="#ff3d8b" distance={40} />
      <pointLight position={[10, 6, -8]} intensity={1.2} color="#7b2cff" distance={30} />
      <pointLight position={[-10, 6, 10]} intensity={1.2} color="#00e6ff" distance={30} />
      <City />
      <Player avatar={avatar} input={input} onEnterGallery={onEnterGallery} />
    </>
  );
}

// ===== キーボード入力 (WASD/矢印) → InputState.move =====
function useKeyboardMove(input: React.MutableRefObject<InputState>) {
  useEffect(() => {
    const keys = new Set<string>();
    const tick = () => {
      let x = 0;
      let y = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      const m = Math.hypot(x, y);
      if (m > 0) {
        // ジョイスティックが操作中でない場合のみキー入力を反映
        const j = input.current.move;
        if (Math.hypot(j.x, j.y) < 0.05) {
          input.current.move = { x: x / m, y: y / m };
        }
      } else {
        // キーが全部離れたらキー由来の値だけクリア
        // (ジョイ操作とぶつからないように、常に上書きはしない)
      }
      raf = requestAnimationFrame(tick);
    };
    const down = (e: KeyboardEvent) => {
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      if (keys.size === 0) {
        // キー入力がクリアされたら move もクリア
        input.current.move = { x: 0, y: 0 };
      }
    };
    let raf = requestAnimationFrame(tick);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input]);
}

// ===== 公開: City3D 本体 =====
export function City3D({ avatar }: { avatar: UserAvatar }) {
  const inputRef = useRef<InputState>(makeInputState());
  const router = useRouter();
  useKeyboardMove(inputRef);

  const handleEnterGallery = useCallback(() => {
    router.push("/gallery");
  }, [router]);

  return (
    <div className="absolute inset-0 z-0 select-none">
      <Canvas
        shadows
        camera={{ position: [0, 3, 8], fov: 55, near: 0.1, far: 400 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <SceneInner avatar={avatar} input={inputRef} onEnterGallery={handleEnterGallery} />
      </Canvas>

      {/* オーバーレイ操作 */}
      <CameraDragArea
        onDelta={(dx, dy) => {
          // 横ドラッグ = ヨー回転、縦 = ピッチ
          inputRef.current.camYaw -= dx * 0.005;
          inputRef.current.camPitch = THREE.MathUtils.clamp(
            inputRef.current.camPitch + dy * 0.004,
            0.15,
            1.0
          );
        }}
      />
      <VirtualJoystick
        onChange={(x, y) => {
          inputRef.current.move = { x, y };
        }}
      />
    </div>
  );
}
