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
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { UserAvatar } from "@/lib/types";

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
      {/* Head */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial color={skin} />
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
      {/* Hair cap */}
      <mesh position={[0, 1.72, -0.02]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={hair} />
      </mesh>
      {/* Hair tail (long-style hint) */}
      {(avatar.parts.hair === "long-straight" ||
        avatar.parts.hair === "long-wave" ||
        avatar.parts.hair === "ponytail") && (
        <mesh position={[0, 1.35, -0.18]} castShadow>
          <boxGeometry args={[0.32, 0.5, 0.08]} />
          <meshStandardMaterial color={hair} />
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

// ===== ビル =====
function Building({
  x,
  z,
  w,
  d,
  h,
  hue,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: number;
}) {
  const base = useMemo(
    () => new THREE.Color(`hsl(${hue}, 35%, 14%)`),
    [hue]
  );
  const accent = useMemo(
    () => new THREE.Color(`hsl(${(hue + 40) % 360}, 90%, 60%)`),
    [hue]
  );
  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={base} />
      </mesh>
      {/* 上部ネオン帯 */}
      <mesh position={[0, h / 2 - 0.2, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.85, 0.3]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
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
      {/* 窓 (ランダムグリッドのエミッシブ点) */}
      <Windows w={w} h={h} d={d} hue={hue} />
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

// ===== 街全体 =====
function City() {
  const buildings = useMemo(() => {
    const rng = mulberry32(7);
    const out: {
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      hue: number;
    }[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 10 + rng() * 55;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      // 道路 (中央 ±3.5) を避ける
      if (Math.abs(x) < 4) continue;
      out.push({
        x,
        z,
        w: 3 + rng() * 5,
        d: 3 + rng() * 5,
        h: 6 + rng() * 26,
        hue: 250 + (rng() - 0.5) * 110,
      });
    }
    return out;
  }, []);

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
      {/* ビル群 */}
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
      {/* ヤシ並木 */}
      {palms.map((p, i) => (
        <Palm key={i} x={p.x} z={p.z} scale={p.s} />
      ))}
      {/* 巨大ホログラム看板 (中央広場の上) */}
      <Billboard x={0} y={14} z={-30} text="K-POP × LA" />
      <Billboard x={0} y={12} z={30} text="RISE TO FAME" />
    </group>
  );
}

function Billboard({
  x,
  y,
  z,
  text,
}: {
  x: number;
  y: number;
  z: number;
  text: string;
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
    grad.addColorStop(0, "#ff3d8b");
    grad.addColorStop(1, "#7b2cff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 140px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);

  return (
    <mesh position={[x, y, z]}>
      <planeGeometry args={[14, 3.5]} />
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
function Player({
  avatar,
  input,
}: {
  avatar: UserAvatar;
  input: React.MutableRefObject<InputState>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const yawRef = useRef(0); // アバターの向き
  const walkRef = useRef(0); // アニメ位相
  const posRef = useRef(new THREE.Vector3(0, 0, 4));
  const { camera } = useThree();

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

    posRef.current.x = THREE.MathUtils.clamp(
      posRef.current.x + dx,
      -70,
      70
    );
    posRef.current.z = THREE.MathUtils.clamp(
      posRef.current.z + dz,
      -90,
      90
    );

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
}: {
  avatar: UserAvatar;
  input: React.MutableRefObject<InputState>;
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
      <Player avatar={avatar} input={input} />
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
  useKeyboardMove(inputRef);

  return (
    <div className="absolute inset-0 z-0 select-none">
      <Canvas
        shadows
        camera={{ position: [0, 3, 8], fov: 55, near: 0.1, far: 400 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <SceneInner avatar={avatar} input={inputRef} />
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
