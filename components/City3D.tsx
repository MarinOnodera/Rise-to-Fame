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
  return { move: { x: 0, y: 0 }, camYaw: 0, camPitch: 0.6 };
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
  walkPhaseRef,
  walkSpeedRef,
}: {
  avatar: UserAvatar;
  walkPhaseRef: React.MutableRefObject<number>;
  walkSpeedRef: React.MutableRefObject<number>;
}) {
  const skin = useMemo(
    () => new THREE.Color(`hsl(${avatar.skinHue}, 50%, 70%)`),
    [avatar.skinHue]
  );
  const hairCol = useMemo(
    () => new THREE.Color(`hsl(${avatar.hairHue}, 70%, 55%)`),
    [avatar.hairHue]
  );
  const browCol = useMemo(
    () => new THREE.Color(`hsl(${avatar.hairHue}, 55%, 35%)`),
    [avatar.hairHue]
  );
  const eyeCol = useMemo(
    () => new THREE.Color(`hsl(${avatar.eyeHue}, 80%, 45%)`),
    [avatar.eyeHue]
  );
  const lipCol = useMemo(
    () => new THREE.Color(`hsl(${avatar.lipHue}, 70%, 55%)`),
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
  const WHITE = useMemo(() => new THREE.Color("#fff"), []);
  const BLACK = useMemo(() => new THREE.Color("#111"), []);
  const blushCol = useMemo(() => new THREE.Color("hsl(0,50%,75%)"), []);

  const bodyRef = useRef<THREE.Group>(null);
  const hipRRef = useRef<THREE.Group>(null);
  const hipLRef = useRef<THREE.Group>(null);
  const kneeRRef = useRef<THREE.Group>(null);
  const kneeLRef = useRef<THREE.Group>(null);
  const shoulderRRef = useRef<THREE.Group>(null);
  const shoulderLRef = useRef<THREE.Group>(null);
  const elbowRRef = useRef<THREE.Group>(null);
  const elbowLRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = walkSpeedRef.current;
    const p = walkPhaseRef.current;
    const sinP = Math.sin(p);

    if (bodyRef.current) {
      bodyRef.current.position.y = s * (1 - Math.cos(p * 2)) * 0.02;
      bodyRef.current.rotation.x = s * 0.06;
      bodyRef.current.rotation.z = s * sinP * 0.025;
    }
    if (hipRRef.current) hipRRef.current.rotation.x = s * sinP * 0.5;
    if (hipLRef.current) hipLRef.current.rotation.x = -s * sinP * 0.5;
    if (kneeRRef.current)
      kneeRRef.current.rotation.x =
        s * Math.pow(Math.max(0, sinP), 1.5) * 0.9;
    if (kneeLRef.current)
      kneeLRef.current.rotation.x =
        s * Math.pow(Math.max(0, -sinP), 1.5) * 0.9;
    if (shoulderRRef.current) {
      shoulderRRef.current.rotation.x = -s * sinP * 0.45;
      shoulderRRef.current.rotation.z = 0.12;
    }
    if (shoulderLRef.current) {
      shoulderLRef.current.rotation.x = s * sinP * 0.45;
      shoulderLRef.current.rotation.z = -0.12;
    }
    if (elbowRRef.current)
      elbowRRef.current.rotation.x =
        -s * (0.15 + Math.max(0, -sinP) * 0.4);
    if (elbowLRef.current)
      elbowLRef.current.rotation.x =
        -s * (0.15 + Math.max(0, sinP) * 0.4);
  });

  const eyeScaleW: Record<string, number> = {
    almond: 1, round: 1, sharp: 1.3, droopy: 1.05, cat: 1.2, wide: 1.1,
  };
  const eyeScaleH: Record<string, number> = {
    almond: 0.8, round: 1.1, sharp: 0.6, droopy: 0.85, cat: 0.7, wide: 1.1,
  };
  const ew = eyeScaleW[avatar.parts.eyes] ?? 1;
  const eh = eyeScaleH[avatar.parts.eyes] ?? 1;
  const hr = avatar.parts.hair;

  return (
    <group ref={bodyRef}>
      {/* ===== HEAD ===== */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>

      {/* ===== NOSE (small bump) ===== */}
      <mesh position={[0, 1.57, 0.28]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>

      {/* ===== LEFT EYE (white + iris + pupil + highlight) ===== */}
      <group position={[-0.09, 1.62, 0.27]} scale={[ew, eh, 1]}>
        <mesh>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={eyeCol} />
        </mesh>
        <mesh position={[0, 0, 0.048]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={BLACK} />
        </mesh>
        <mesh position={[0.015, 0.016, 0.052]}>
          <sphereGeometry args={[0.01, 6, 6]} />
          <meshStandardMaterial
            color={WHITE}
            emissive={WHITE}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>
      {/* ===== RIGHT EYE ===== */}
      <group position={[0.09, 1.62, 0.27]} scale={[ew, eh, 1]}>
        <mesh>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={WHITE} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={eyeCol} />
        </mesh>
        <mesh position={[0, 0, 0.048]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={BLACK} />
        </mesh>
        <mesh position={[-0.015, 0.016, 0.052]}>
          <sphereGeometry args={[0.01, 6, 6]} />
          <meshStandardMaterial
            color={WHITE}
            emissive={WHITE}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>

      {/* ===== EYEBROWS ===== */}
      <mesh position={[-0.09, 1.69, 0.27]} rotation={[0.3, 0, 0.06]}>
        <boxGeometry args={[0.07, 0.016, 0.012]} />
        <meshStandardMaterial color={browCol} />
      </mesh>
      <mesh position={[0.09, 1.69, 0.27]} rotation={[0.3, 0, -0.06]}>
        <boxGeometry args={[0.07, 0.016, 0.012]} />
        <meshStandardMaterial color={browCol} />
      </mesh>

      {/* ===== MOUTH ===== */}
      <mesh position={[0, 1.52, 0.27]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.012, 0.04, 4, 8]} />
        <meshStandardMaterial color={lipCol} />
      </mesh>

      {/* ===== BLUSH ===== */}
      <mesh position={[-0.18, 1.56, 0.21]} rotation={[0, -0.7, 0]}>
        <circleGeometry args={[0.035, 12]} />
        <meshStandardMaterial
          color={blushCol}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0.18, 1.56, 0.21]} rotation={[0, 0.7, 0]}>
        <circleGeometry args={[0.035, 12]} />
        <meshStandardMaterial
          color={blushCol}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ===== HAIR: base shell (covers top of head, stops above face) ===== */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry
          args={[0.30, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.40]}
        />
        <meshStandardMaterial color={hairCol} roughness={0.5} />
      </mesh>
      {/* Side hair covers ears */}
      <mesh position={[-0.24, 1.62, -0.04]} scale={[0.45, 0.8, 0.5]} castShadow>
        <capsuleGeometry args={[0.12, 0.12, 6, 8]} />
        <meshStandardMaterial color={hairCol} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, 1.62, -0.04]} scale={[0.45, 0.8, 0.5]} castShadow>
        <capsuleGeometry args={[0.12, 0.12, 6, 8]} />
        <meshStandardMaterial color={hairCol} roughness={0.5} />
      </mesh>
      {/* Back of head hair */}
      <mesh position={[0, 1.58, -0.18]} scale={[0.9, 0.85, 0.5]} castShadow>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color={hairCol} roughness={0.5} />
      </mesh>
      {/* Bangs fringe on forehead */}
      <mesh
        position={[0, 1.73, 0.2]}
        rotation={[-0.6, 0, 0]}
        scale={[1.3, 0.5, 0.3]}
      >
        <capsuleGeometry args={[0.08, 0.06, 6, 12]} />
        <meshStandardMaterial color={hairCol} roughness={0.5} />
      </mesh>

      {/* ===== HAIR STYLE ADDITIONS ===== */}
      {(hr === "long-straight" || hr === "long-wave") && (
        <>
          <mesh
            position={[0, 1.25, -0.14]}
            rotation={[0.08, 0, 0]}
            scale={[1.05, 1, 0.55]}
            castShadow
          >
            <capsuleGeometry args={[0.20, 0.5, 6, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
          <mesh position={[-0.22, 1.4, 0.08]} scale={[0.4, 1, 0.4]} castShadow>
            <capsuleGeometry args={[0.08, 0.35, 6, 8]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
          <mesh position={[0.22, 1.4, 0.08]} scale={[0.4, 1, 0.4]} castShadow>
            <capsuleGeometry args={[0.08, 0.35, 6, 8]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
        </>
      )}
      {hr === "ponytail" && (
        <>
          <mesh position={[0, 1.78, -0.2]} castShadow>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
          <mesh
            position={[0, 1.48, -0.32]}
            rotation={[0.5, 0, 0]}
            scale={[0.7, 1, 0.7]}
            castShadow
          >
            <capsuleGeometry args={[0.08, 0.4, 6, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
        </>
      )}
      {hr === "bob" && (
        <>
          <mesh position={[-0.25, 1.5, 0.02]} scale={[0.5, 0.9, 0.5]} castShadow>
            <capsuleGeometry args={[0.1, 0.2, 6, 8]} />
            <meshStandardMaterial color={hairCol} roughness={0.5} />
          </mesh>
          <mesh position={[0.25, 1.5, 0.02]} scale={[0.5, 0.9, 0.5]} castShadow>
            <capsuleGeometry args={[0.1, 0.2, 6, 8]} />
            <meshStandardMaterial color={hairCol} roughness={0.5} />
          </mesh>
        </>
      )}
      {hr === "twin-buns" && (
        <>
          <mesh position={[0.24, 1.86, -0.02]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.5} />
          </mesh>
          <mesh position={[-0.24, 1.86, -0.02]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.5} />
          </mesh>
        </>
      )}
      {hr === "half-up" && (
        <>
          <mesh position={[0, 1.9, -0.06]} castShadow>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.5} />
          </mesh>
          <mesh
            position={[0, 1.38, -0.18]}
            scale={[1, 1, 0.55]}
            castShadow
          >
            <capsuleGeometry args={[0.16, 0.3, 6, 12]} />
            <meshStandardMaterial color={hairCol} roughness={0.55} />
          </mesh>
        </>
      )}
      {hr === "undercut" && (
        <mesh
          position={[0, 1.8, 0.04]}
          rotation={[-0.3, 0, 0]}
          scale={[0.8, 0.7, 1]}
          castShadow
        >
          <capsuleGeometry args={[0.12, 0.1, 6, 12]} />
          <meshStandardMaterial color={hairCol} roughness={0.45} />
        </mesh>
      )}
      {hr === "mohawk-fade" && (
        <mesh
          position={[0, 1.88, 0]}
          scale={[0.35, 1, 1]}
          castShadow
        >
          <capsuleGeometry args={[0.08, 0.2, 6, 12]} />
          <meshStandardMaterial color={hairCol} roughness={0.45} />
        </mesh>
      )}

      {/* ===== TORSO ===== */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[0.44, 0.6, 0.26]} />
        <meshStandardMaterial
          color={outA}
          emissive={outA}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* Belt accent */}
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.28]} />
        <meshStandardMaterial
          color={outB}
          emissive={outB}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* ===== ARMS ===== */}
      <group position={[0.27, 1.4, 0]}>
        <group ref={shoulderRRef}>
          <mesh position={[0, -0.125, 0]} castShadow>
            <boxGeometry args={[0.12, 0.25, 0.12]} />
            <meshStandardMaterial
              color={outA}
              emissive={outA}
              emissiveIntensity={0.1}
            />
          </mesh>
          <group position={[0, -0.25, 0]}>
            <group ref={elbowRRef}>
              <mesh position={[0, -0.125, 0]}>
                <boxGeometry args={[0.11, 0.25, 0.11]} />
                <meshStandardMaterial color={skin} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      <group position={[-0.27, 1.4, 0]}>
        <group ref={shoulderLRef}>
          <mesh position={[0, -0.125, 0]} castShadow>
            <boxGeometry args={[0.12, 0.25, 0.12]} />
            <meshStandardMaterial
              color={outA}
              emissive={outA}
              emissiveIntensity={0.1}
            />
          </mesh>
          <group position={[0, -0.25, 0]}>
            <group ref={elbowLRef}>
              <mesh position={[0, -0.125, 0]}>
                <boxGeometry args={[0.11, 0.25, 0.11]} />
                <meshStandardMaterial color={skin} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* ===== LEGS ===== */}
      <group position={[0.12, 0.82, 0]}>
        <group ref={hipRRef}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <boxGeometry args={[0.16, 0.36, 0.16]} />
            <meshStandardMaterial color={outB} />
          </mesh>
          <group position={[0, -0.36, 0]}>
            <group ref={kneeRRef}>
              <mesh position={[0, -0.18, 0]} castShadow>
                <boxGeometry args={[0.14, 0.36, 0.14]} />
                <meshStandardMaterial color={outB} />
              </mesh>
              <mesh position={[0, -0.39, 0.04]}>
                <boxGeometry args={[0.16, 0.06, 0.22]} />
                <meshStandardMaterial color={BLACK} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      <group position={[-0.12, 0.82, 0]}>
        <group ref={hipLRef}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <boxGeometry args={[0.16, 0.36, 0.16]} />
            <meshStandardMaterial color={outB} />
          </mesh>
          <group position={[0, -0.36, 0]}>
            <group ref={kneeLRef}>
              <mesh position={[0, -0.18, 0]} castShadow>
                <boxGeometry args={[0.14, 0.36, 0.14]} />
                <meshStandardMaterial color={outB} />
              </mesh>
              <mesh position={[0, -0.39, 0.04]}>
                <boxGeometry args={[0.16, 0.06, 0.22]} />
                <meshStandardMaterial color={BLACK} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* ===== ACCESSORIES ===== */}
      {avatar.parts.accessory === "neon-shades" && (
        <>
          <mesh position={[-0.09, 1.63, 0.33]}>
            <boxGeometry args={[0.09, 0.045, 0.012]} />
            <meshStandardMaterial
              color="#111"
              emissive="#ff3d8b"
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0.09, 1.63, 0.33]}>
            <boxGeometry args={[0.09, 0.045, 0.012]} />
            <meshStandardMaterial
              color="#111"
              emissive="#ff3d8b"
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 1.63, 0.33]}>
            <boxGeometry args={[0.04, 0.012, 0.012]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* Temples (arms of glasses) */}
          <mesh position={[-0.16, 1.63, 0.3]} rotation={[0, 0.8, 0]}>
            <boxGeometry args={[0.12, 0.012, 0.012]} />
            <meshStandardMaterial color="#ff3d8b" />
          </mesh>
          <mesh position={[0.16, 1.63, 0.3]} rotation={[0, -0.8, 0]}>
            <boxGeometry args={[0.12, 0.012, 0.012]} />
            <meshStandardMaterial color="#ff3d8b" />
          </mesh>
        </>
      )}
      {avatar.parts.accessory === "cyber-visor" && (
        <mesh position={[0, 1.63, 0.32]}>
          <boxGeometry args={[0.3, 0.05, 0.018]} />
          <meshStandardMaterial
            color="#001133"
            emissive="#00aaff"
            emissiveIntensity={1.2}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
      {avatar.parts.accessory === "halo-ring" && (
        <mesh position={[0, 2.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.02, 8, 24]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffd166"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      )}
      {avatar.parts.accessory === "hologram-earring" && (
        <>
          <mesh position={[-0.28, 1.55, 0.02]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial
              color="#88ffff"
              emissive="#88ffff"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0.28, 1.55, 0.02]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial
              color="#88ffff"
              emissive="#88ffff"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </>
      )}
      {avatar.parts.accessory === "choker-led" && (
        <mesh position={[0, 1.44, 0.04]}>
          <torusGeometry args={[0.15, 0.015, 8, 16]} />
          <meshStandardMaterial
            color="#ff0055"
            emissive="#ff0055"
            emissiveIntensity={1.5}
            toneMapped={false}
          />
        </mesh>
      )}
      {avatar.parts.accessory === "face-decal" && (
        <mesh position={[0.16, 1.58, 0.26]} rotation={[0, 0.5, 0.2]}>
          <planeGeometry args={[0.06, 0.06]} />
          <meshStandardMaterial
            color="#ff66aa"
            emissive="#ff66aa"
            emissiveIntensity={0.8}
            toneMapped={false}
            side={THREE.DoubleSide}
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
    () => new THREE.Color(`hsl(${hue}, 35%, 72%)`),
    []
  );
  const accent = useMemo(
    () => new THREE.Color(`hsl(${(hue + 40) % 360}, 50%, 55%)`),
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

// ===== ビル (カラフル低層 – Roblox / Zootopia 風) =====
function Building({
  x, z, w, d, h, hue, label, type, skyline,
}: BuildingBox) {
  const wallCol = useMemo(() => new THREE.Color(`hsl(${hue}, 35%, 72%)`), [hue]);
  const trimCol = useMemo(() => new THREE.Color(`hsl(${(hue + 30) % 360}, 40%, 55%)`), [hue]);
  const roofCol = useMemo(() => new THREE.Color(`hsl(${(hue + 60) % 360}, 30%, 45%)`), [hue]);

  const faceTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const rng = mulberry32(Math.floor(w * 1000 + h * 100 + d * 10 + hue));
    const wL = `hsl(${hue}, 35%, 72%)`;
    ctx.fillStyle = wL;
    ctx.fillRect(0, 0, 256, 256);
    const floors = Math.max(1, Math.round(h / 4));
    const cols = Math.max(2, Math.round(w / 3));
    const fH = 256 / floors;
    const fW = 256 / cols;
    const pad = 6;
    for (let fy = 0; fy < floors; fy++) {
      for (let fx = 0; fx < cols; fx++) {
        const lit = rng() > 0.2;
        const tint = Math.floor(rng() * 3);
        if (lit) {
          const cs = tint === 0 ? "hsl(210, 40%, 75%)" : tint === 1 ? "hsl(200, 30%, 82%)" : "hsl(220, 25%, 68%)";
          ctx.fillStyle = cs;
        } else {
          ctx.fillStyle = `hsl(210, 20%, 60%)`;
        }
        const wx = fx * fW + pad + 2;
        const wy = fy * fH + pad + 2;
        const ww = fW - pad * 2 - 4;
        const wh = fH - pad * 2 - 4;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = `hsl(${hue}, 20%, 50%)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);
        if (lit && rng() > 0.6) {
          ctx.fillStyle = "rgba(255,255,240,0.12)";
          ctx.fillRect(wx, wy, ww / 2, wh);
        }
      }
      ctx.fillStyle = `hsl(${hue}, 25%, 62%)`;
      ctx.fillRect(0, fy * fH, 256, 3);
    }
    if (label) {
      ctx.fillStyle = `hsl(${(hue + 60) % 360}, 50%, 35%)`;
      ctx.fillRect(0, 0, 256, fH * 0.7);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 128, fH * 0.35);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [w, h, d, hue, label]);

  const floors = Math.max(1, Math.round(h / 4));

  return (
    <group position={[x, 0, z]}>
      {/* メイン壁体 */}
      <mesh position={[0, h / 2, 0]} castShadow={!skyline} receiveShadow={!skyline}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wallCol} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* 前面窓テクスチャ */}
      {faceTex && !skyline && (
        <mesh position={[0, h / 2, d / 2 + 0.02]}>
          <planeGeometry args={[w * 0.92, h * 0.94]} />
          <meshStandardMaterial map={faceTex} roughness={0.6} />
        </mesh>
      )}
      {/* 背面窓テクスチャ */}
      {faceTex && !skyline && (
        <mesh position={[0, h / 2, -d / 2 - 0.02]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[w * 0.92, h * 0.94]} />
          <meshStandardMaterial map={faceTex} roughness={0.6} />
        </mesh>
      )}
      {/* 屋根 */}
      <mesh position={[0, h + 0.15, 0]} castShadow>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color={roofCol} roughness={0.8} />
      </mesh>
      {/* 1F の庇 / awning */}
      {!skyline && (
        <mesh position={[0, 4.2, d / 2 + 0.6]}>
          <boxGeometry args={[w * 0.9, 0.12, 1.2]} />
          <meshStandardMaterial color={trimCol} roughness={0.6} />
        </mesh>
      )}
      {/* 縁取りトリム (上部) */}
      <mesh position={[0, h - 0.1, d / 2 + 0.04]}>
        <boxGeometry args={[w + 0.15, 0.35, 0.1]} />
        <meshStandardMaterial color={trimCol} roughness={0.7} />
      </mesh>
      {/* 1F 基礎帯 */}
      {!skyline && (
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[w + 0.2, 0.6, d + 0.2]} />
          <meshStandardMaterial color={roofCol} roughness={0.85} />
        </mesh>
      )}
      {/* バルコニー (3F 以上のビルに追加) */}
      {!skyline && floors >= 3 && (
        <mesh position={[0, 8.2, d / 2 + 0.4]}>
          <boxGeometry args={[w * 0.7, 0.1, 0.8]} />
          <meshStandardMaterial color={wallCol} roughness={0.7} />
        </mesh>
      )}
      {/* 屋上ユニット (高いビルのみ) */}
      {!skyline && h > 14 && (
        <mesh position={[w * 0.2, h + 0.8, -d * 0.15]}>
          <boxGeometry args={[1.8, 1.2, 1.8]} />
          <meshStandardMaterial color="#999" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}


// ===== 中央広場 (ヴィッラ・デステ風多段カスケード噴水) =====
function CentralPlaza() {
  const waterRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!waterRef.current) return;
    const t = state.clock.elapsedTime;
    waterRef.current.children.forEach((c, i) => {
      if ((c as THREE.Mesh).material && "opacity" in (c as THREE.Mesh).material) {
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity =
          0.35 + Math.sin(t * 2.5 + i * 0.7) * 0.15;
      }
    });
  });

  return (
    <group position={[PLAZA_POS.x, 0, PLAZA_POS.z]}>
      {/* 広場の床 (石畳) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[PLAZA_POS.radius, 48]} />
        <meshStandardMaterial color="#c0b098" roughness={0.85} />
      </mesh>

      {/* ===== ベースプール (最下段) ===== */}
      <mesh position={[0, 0.25, 0]}>
        <torusGeometry args={[5.8, 0.5, 8, 36]} />
        <meshStandardMaterial color="#b8956a" metalness={0.15} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.5, 36]} />
        <meshStandardMaterial color="#6699aa" emissive="#445566" emissiveIntensity={0.5} transparent opacity={0.7} metalness={0.4} roughness={0.15} />
      </mesh>

      {/* ===== 第1段 (ワイドステップ) ===== */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[4.0, 4.5, 0.8, 28]} />
        <meshStandardMaterial color="#b8956a" metalness={0.12} roughness={0.78} />
      </mesh>
      {/* 段上の水面 */}
      <mesh position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.8, 28]} />
        <meshStandardMaterial color="#7799aa" emissive="#556677" emissiveIntensity={0.4} transparent opacity={0.6} metalness={0.3} roughness={0.2} />
      </mesh>
      {/* カスケード (第1段→プール) */}
      <group ref={waterRef}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={`c1${i}`} position={[Math.cos(a) * 4.3, 0.5, Math.sin(a) * 4.3]} rotation={[0, -a, 0]}>
              <planeGeometry args={[1.4, 0.7]} />
              <meshStandardMaterial color="#bbddee" emissive="#99bbcc" emissiveIntensity={0.8} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>

      {/* ===== 第2段 ===== */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[2.6, 3.2, 0.9, 22]} />
        <meshStandardMaterial color="#8b7050" metalness={0.2} roughness={0.72} />
      </mesh>
      {/* カスケード (第2段→第1段) */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={`c2${i}`} position={[Math.cos(a) * 2.9, 1.2, Math.sin(a) * 2.9]} rotation={[0, -a, 0]}>
            <planeGeometry args={[1.0, 0.5]} />
            <meshStandardMaterial color="#bbddee" emissive="#99bbcc" emissiveIntensity={0.7} transparent opacity={0.3} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* ===== 第3段 (中央台座) ===== */}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[1.4, 2.0, 1.0, 16]} />
        <meshStandardMaterial color="#c4a86c" metalness={0.25} roughness={0.65} />
      </mesh>
      {/* アーチ装飾 (台座上のリング) */}
      <mesh position={[0, 2.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.08, 8, 20]} />
        <meshStandardMaterial color="#d4af37" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* ===== 中央柱 + 装飾頂部 ===== */}
      <mesh position={[0, 3.6, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 2.0, 12]} />
        <meshStandardMaterial color="#c4a86c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.8, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#d4af37" emissive="#ffd166" emissiveIntensity={0.6} metalness={0.7} roughness={0.25} toneMapped={false} />
      </mesh>

      {/* ===== 垂直水ジェット ===== */}
      {/* メインジェット (中央) */}
      <mesh position={[0, 6.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 5, 6]} />
        <meshStandardMaterial color="#ddeeff" emissive="#bbddff" emissiveIntensity={2.5} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* サイドジェット (4本) */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={`vj${i}`} position={[Math.cos(a) * 1.2, 5.5, Math.sin(a) * 1.2]}>
            <cylinderGeometry args={[0.03, 0.03, 3.5, 6]} />
            <meshStandardMaterial color="#ddeeff" emissive="#bbddff" emissiveIntensity={2} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        );
      })}

      {/* ===== アーチ型水ジェット (放物線状に外へ) ===== */}
      {Array.from({ length: 4 }).map((_, i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={`arc${i}`} position={[Math.cos(a) * 3.2, 2.2, Math.sin(a) * 3.2]} rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]}>
            <cylinderGeometry args={[0.025, 0.025, 3.5, 6]} />
            <meshStandardMaterial color="#ddeeff" emissive="#ccddee" emissiveIntensity={2} transparent opacity={0.45} toneMapped={false} />
          </mesh>
        );
      })}

      {/* ===== ゴールデン照明 (暖色アップライト) ===== */}
      <pointLight position={[0, 1, 0]} intensity={4} color="#ffaa44" distance={20} />

      {/* ===== 周辺の装飾 ===== */}
      {/* 石柱ポール + ゴールドランプ */}
      {[
        [7, 7], [-7, 7], [7, -7], [-7, -7],
        [9.5, 0], [-9.5, 0], [0, 9.5], [0, -9.5],
      ].map(([px, pz], i) => (
        <group key={`pole${i}`} position={[px, 0, pz]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 3, 6]} />
            <meshStandardMaterial color="#8b7050" metalness={0.35} roughness={0.55} />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshStandardMaterial color="#ffd166" emissive="#ffaa44" emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* 植栽 (低木) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`bush${i}`} position={[Math.cos(a) * 10, 0.5, Math.sin(a) * 10]}>
            <sphereGeometry args={[0.7, 6, 6]} />
            <meshStandardMaterial color="#2a6b35" roughness={0.85} />
          </mesh>
        );
      })}

      {/* ベンチ (4個、対角線上) */}
      {[Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((a, i) => (
        <group key={`bench${i}`} position={[Math.cos(a) * 8, 0, Math.sin(a) * 8]} rotation={[0, -a + Math.PI / 2, 0]}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[1.8, 0.08, 0.5]} />
            <meshStandardMaterial color="#6b4226" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.55, -0.22]}>
            <boxGeometry args={[1.8, 0.5, 0.06]} />
            <meshStandardMaterial color="#6b4226" roughness={0.8} />
          </mesh>
          <mesh position={[-0.75, 0.18, 0]}>
            <boxGeometry args={[0.06, 0.36, 0.4]} />
            <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.75, 0.18, 0]}>
            <boxGeometry args={[0.06, 0.36, 0.4]} />
            <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
          </mesh>
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#4488aa";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = "#334455";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
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

// ===== 昼夜サイクル (1日=15分=900秒) =====
// 0-300s: 朝, 300-600s: 昼, 600-900s: 夜
function lerpHex(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  ca.lerp(new THREE.Color(b), t);
  return "#" + ca.getHexString();
}

type CyclePhase = "morning" | "day" | "night";
function getCycleState(): { phase: CyclePhase; t: number; seconds: number } {
  const s = (Date.now() / 1000) % 900;
  if (s < 300) return { phase: "morning", t: s / 300, seconds: s };
  if (s < 600) return { phase: "day", t: (s - 300) / 300, seconds: s };
  return { phase: "night", t: (s - 600) / 300, seconds: s };
}

function skyColors(s: number): [string, string, string] {
  if (s < 100) {
    const t = s / 100;
    return [lerpHex("#2a3060", "#5588cc", t), lerpHex("#4a4080", "#88bbee", t), lerpHex("#ff8855", "#bbddff", t)];
  }
  if (s < 300) {
    const t = (s - 100) / 200;
    return [lerpHex("#5588cc", "#4499dd", t), lerpHex("#88bbee", "#aaddff", t), lerpHex("#bbddff", "#eef6ff", t)];
  }
  if (s < 600) {
    return ["#4499dd", "#88ccee", "#ddeeff"];
  }
  if (s < 700) {
    const t = (s - 600) / 100;
    return [lerpHex("#4499dd", "#445588", t), lerpHex("#88ccee", "#776688", t), lerpHex("#ddeeff", "#ff8844", t)];
  }
  if (s < 800) {
    const t = (s - 700) / 100;
    return [lerpHex("#445588", "#1a2244", t), lerpHex("#776688", "#2a2248", t), lerpHex("#ff8844", "#3a2858", t)];
  }
  const t = (s - 800) / 100;
  return [lerpHex("#1a2244", "#2a3060", t), lerpHex("#2a2248", "#4a4080", t), lerpHex("#3a2858", "#ff8855", t)];
}

function DynamicSky() {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 256;
    canvasRef.current = c;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texRef.current = t;
    if (matRef.current) matRef.current.map = t;
  }, []);

  useFrame(() => {
    const now = Date.now() / 1000;
    if (now - lastRef.current < 0.5) return;
    lastRef.current = now;
    const c = canvasRef.current;
    const t = texRef.current;
    if (!c || !t) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const [top, mid, horizon] = skyColors(now % 900);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.5, mid);
    g.addColorStop(1.0, horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 256);
    t.needsUpdate = true;
    if (matRef.current && !matRef.current.map) matRef.current.map = t;
  });

  return (
    <mesh>
      <sphereGeometry args={[1100, 32, 32]} />
      <meshBasicMaterial ref={matRef} side={THREE.BackSide} />
    </mesh>
  );
}

// ===== ホログラム =====
function HologramFigure({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 1.2) * 0.5;
    ref.current.rotation.y = state.clock.elapsedTime * 0.3;
  });

  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh>
        <capsuleGeometry args={[0.6, 2.5, 8, 16]} />
        <meshStandardMaterial
          color="#00e6ff"
          emissive="#00e6ff"
          emissiveIntensity={2}
          transparent
          opacity={0.25}
          toneMapped={false}
          wireframe
        />
      </mesh>
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color="#ff3d8b"
          emissive="#ff3d8b"
          emissiveIntensity={2}
          transparent
          opacity={0.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.05, 8, 32]} />
        <meshStandardMaterial
          color="#00e6ff"
          emissive="#00e6ff"
          emissiveIntensity={3}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ===== 空飛ぶ乗り物 =====
function FlyingVehicle({
  radius,
  height,
  speed,
  phase,
  color,
}: {
  radius: number;
  height: number;
  speed: number;
  phase: number;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const col = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    ref.current.position.set(
      Math.cos(t) * radius,
      height + Math.sin(t * 2) * 2,
      Math.sin(t) * radius
    );
    ref.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.3, 1.8, 8, 12]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={2}
          toneMapped={false}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <pointLight position={[0, 0, -1]} intensity={1} color={color} distance={15} />
      <mesh position={[0, 0, -1.2]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={4}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function FlyingVehicles() {
  const vehicles = useMemo(
    () => [
      { radius: 120, height: 45, speed: 0.15, phase: 0, color: "#ff3d8b" },
      { radius: 150, height: 55, speed: -0.1, phase: Math.PI * 0.7, color: "#00e6ff" },
      { radius: 100, height: 38, speed: 0.2, phase: Math.PI * 1.3, color: "#ffd166" },
      { radius: 130, height: 48, speed: -0.12, phase: Math.PI * 0.3, color: "#7b2cff" },
    ],
    []
  );
  return (
    <>
      {vehicles.map((v, i) => (
        <FlyingVehicle key={i} {...v} />
      ))}
    </>
  );
}

// ===== 道路ネットワーク定数 =====
const ROAD_XS = [-200, -100, 0, 100, 200];
const ROAD_ZS = [-200, -100, 0, 100, 200];

const PLAZA_POS = { x: 50, z: 50, radius: 25 };

function roadWidth(pos: number): number {
  return pos === 0 ? 14 : 8;
}

function isOnRoad(x: number, z: number): boolean {
  for (const rx of ROAD_XS) {
    if (Math.abs(x - rx) < roadWidth(rx) / 2 + 2) return true;
  }
  for (const rz of ROAD_ZS) {
    if (Math.abs(z - rz) < roadWidth(rz) / 2 + 2) return true;
  }
  return false;
}

function generateCarRoutes(count: number, rng: () => number): number[][][] {
  const routes: number[][][] = [];
  for (let r = 0; r < count; r++) {
    let cx = ROAD_XS[Math.floor(rng() * ROAD_XS.length)];
    let cz = ROAD_ZS[Math.floor(rng() * ROAD_ZS.length)];
    const route: number[][] = [[cx, cz]];
    let prevX = cx, prevZ = cz;
    for (let step = 0; step < 20; step++) {
      const neighbors: number[][] = [];
      const xi = ROAD_XS.indexOf(cx);
      const zi = ROAD_ZS.indexOf(cz);
      if (xi > 0) neighbors.push([ROAD_XS[xi - 1], cz]);
      if (xi < 4) neighbors.push([ROAD_XS[xi + 1], cz]);
      if (zi > 0) neighbors.push([cx, ROAD_ZS[zi - 1]]);
      if (zi < 4) neighbors.push([cx, ROAD_ZS[zi + 1]]);
      const noBack = neighbors.filter(n => !(n[0] === prevX && n[1] === prevZ));
      const pool = noBack.length > 0 ? noBack : neighbors;
      const next = pool[Math.floor(rng() * pool.length)];
      route.push(next);
      prevX = cx; prevZ = cz;
      cx = next[0]; cz = next[1];
    }
    routes.push(route);
  }
  return routes;
}

// ===== NPC 車 (ルート追従 + 交差点でランダム方向) =====
function NPCCar({
  route,
  speed,
  laneOffset,
  color,
}: {
  route: number[][];
  speed: number;
  laneOffset: number;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const col = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!ref.current || route.length < 2) return;
    const segTime = 100 / speed;
    const totalTime = (route.length - 1) * segTime;
    const loopT = ((state.clock.elapsedTime % totalTime) + totalTime) % totalTime;
    const segIdx = Math.min(Math.floor(loopT / segTime), route.length - 2);
    const segP = (loopT / segTime) - segIdx;
    const from = route[segIdx];
    const to = route[segIdx + 1];
    const x = from[0] + (to[0] - from[0]) * segP;
    const z = from[1] + (to[1] - from[1]) * segP;
    const dxx = to[0] - from[0];
    const dzz = to[1] - from[1];
    const len = Math.hypot(dxx, dzz);
    if (len > 0) {
      ref.current.position.set(x + (-dzz / len) * laneOffset, 0.35, z + (dxx / len) * laneOffset);
      ref.current.rotation.y = Math.atan2(dxx, dzz);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.2, 0.55, 2.6]} />
        <meshStandardMaterial color={col} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.0, 0.4, 1.4]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.4, 0.2, 1.35]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[-0.4, 0.2, 1.35]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[0.4, 0.2, -1.35]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[-0.4, 0.2, -1.35]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

function NPCCars() {
  const data = useMemo(() => {
    const rng = mulberry32(999);
    const routes = generateCarRoutes(6, rng);
    const colors = ["#ff3d8b", "#7b2cff", "#ffd166", "#00e6ff", "#ff6644", "#44ff88"];
    return routes.map((route, i) => ({
      route,
      speed: 6 + rng() * 5,
      laneOffset: rng() > 0.5 ? 2.8 : -2.8,
      color: colors[i % colors.length],
    }));
  }, []);
  return (
    <>
      {data.map((d, i) => (
        <NPCCar key={i} {...d} />
      ))}
    </>
  );
}

// ===== NPC 歩行者 (ランダムウォーク AI) =====
function NPCPedestrian({
  startX, startZ, skinHue, outfitHue, seed,
}: {
  startX: number; startZ: number; skinHue: number; outfitHue: number; seed: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const skin = useMemo(() => new THREE.Color(`hsl(${skinHue}, 50%, 70%)`), [skinHue]);
  const outfit = useMemo(() => new THREE.Color(`hsl(${outfitHue}, 70%, 45%)`), [outfitHue]);
  const stateRef = useRef({
    x: startX, z: startZ,
    targetX: startX + 10, targetZ: startZ + 10,
    paused: false, pauseEnd: 0,
    rng: mulberry32(seed),
  });

  useFrame((state, dt) => {
    if (!ref.current) return;
    const s = stateRef.current;
    const now = state.clock.elapsedTime;

    if (s.paused) {
      if (now > s.pauseEnd) {
        s.paused = false;
        const angle = s.rng() * Math.PI * 2;
        const dist = 10 + s.rng() * 40;
        s.targetX = THREE.MathUtils.clamp(s.x + Math.cos(angle) * dist, -450, 450);
        s.targetZ = THREE.MathUtils.clamp(s.z + Math.sin(angle) * dist, -450, 450);
      }
    } else {
      const dx = s.targetX - s.x;
      const dz = s.targetZ - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) {
        if (s.rng() < 0.2) {
          s.paused = true;
          s.pauseEnd = now + 2 + s.rng() * 4;
        } else {
          const angle = s.rng() * Math.PI * 2;
          const d = 10 + s.rng() * 40;
          s.targetX = THREE.MathUtils.clamp(s.x + Math.cos(angle) * d, -450, 450);
          s.targetZ = THREE.MathUtils.clamp(s.z + Math.sin(angle) * d, -450, 450);
        }
      } else {
        const speed = 1.5;
        const step = Math.min(speed * Math.min(dt, 0.05), dist);
        s.x += (dx / dist) * step;
        s.z += (dz / dist) * step;
        ref.current.rotation.y = Math.atan2(dx, dz);
      }
    }
    ref.current.position.set(s.x, 0, s.z);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 1.0, 0]}>
        <capsuleGeometry args={[0.18, 0.8, 8, 12]} />
        <meshStandardMaterial color={outfit} emissive={outfit} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color={skin} />
      </mesh>
    </group>
  );
}

function NPCPedestrians() {
  const peds = useMemo(() => {
    const rng = mulberry32(7777);
    return Array.from({ length: 10 }, (_, i) => ({
      startX: (rng() - 0.5) * 700,
      startZ: (rng() - 0.5) * 700,
      skinHue: Math.floor(rng() * 40 + 15),
      outfitHue: Math.floor(rng() * 360),
      seed: 8000 + i,
    }));
  }, []);
  return (
    <>
      {peds.map((p, i) => (
        <NPCPedestrian key={i} {...p} />
      ))}
    </>
  );
}

// ===== 水辺 (リゾート要素) =====
function WaterBody() {
  const ref = useRef<THREE.Mesh>(null);
  const waterCol = useMemo(() => new THREE.Color("#1188cc"), []);

  useFrame((state) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
  });

  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 420]}>
        <planeGeometry args={[1400, 250]} />
        <meshStandardMaterial
          color={waterCol}
          emissive={waterCol}
          emissiveIntensity={0.35}
          transparent
          opacity={0.75}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
      {/* 岸壁 */}
      <mesh position={[0, -0.15, 295]}>
        <boxGeometry args={[1400, 0.6, 0.5]} />
        <meshStandardMaterial color="#2a1a3a" />
      </mesh>
    </group>
  );
}

// ===== モノレール =====
// ===== モノレール定数 =====
const MONO_RX = 350;
const MONO_RZ = 300;
const MONO_H = 20;
const MONO_STATION_ANGLE = Math.PI * 0.45;
const MONO_STATION_X = Math.cos(MONO_STATION_ANGLE) * MONO_RX;
const MONO_STATION_Z = Math.sin(MONO_STATION_ANGLE) * MONO_RZ;
const MONO_LOOP_TIME = 10;
const MONO_SPEED = (Math.PI * 2) / MONO_LOOP_TIME;
const MONO_STOP_DURATION = 4;

function MonorailTrack() {
  const pillars = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      out.push({ x: Math.cos(a) * MONO_RX, z: Math.sin(a) * MONO_RZ });
    }
    return out;
  }, []);

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, MONO_H, 0]} scale={[MONO_RX, MONO_RZ, 1]}>
        <torusGeometry args={[1, 0.12, 6, 64]} />
        <meshStandardMaterial color="#ddb8c0" metalness={0.5} roughness={0.2} />
      </mesh>
      {pillars.filter((_, i) => i % 3 === 0).map((p, i) => (
        <mesh key={i} position={[p.x, MONO_H / 2, p.z]}>
          <cylinderGeometry args={[0.12, 0.18, MONO_H, 6]} />
          <meshStandardMaterial color="#c9a0a8" metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function MonorailTrain({
  ridingRef,
  onDismount,
}: {
  ridingRef: React.MutableRefObject<boolean>;
  onDismount: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const angleRef = useRef(MONO_STATION_ANGLE);
  const stoppedRef = useRef(0);
  const ridingStartRef = useRef(false);
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (!ref.current) return;
    const dtc = Math.min(dt, 0.05);

    const atStation =
      Math.abs(((angleRef.current - MONO_STATION_ANGLE) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.15;

    if (atStation && stoppedRef.current < MONO_STOP_DURATION) {
      stoppedRef.current += dtc;
      if (ridingRef.current && !ridingStartRef.current) {
        ridingStartRef.current = true;
      }
      if (ridingRef.current && ridingStartRef.current && stoppedRef.current > MONO_STOP_DURATION * 0.8) {
        // second stop after a full loop
      }
    } else {
      if (stoppedRef.current >= MONO_STOP_DURATION) {
        stoppedRef.current = 0;
        if (ridingRef.current && ridingStartRef.current) {
          const looped =
            Math.abs(((angleRef.current - MONO_STATION_ANGLE) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.3;
          if (looped) {
            ridingRef.current = false;
            ridingStartRef.current = false;
            onDismount();
          }
        }
      }
      angleRef.current += dtc * MONO_SPEED;
    }

    const a = angleRef.current;
    const tx = Math.cos(a) * MONO_RX;
    const tz = Math.sin(a) * MONO_RZ;
    ref.current.position.set(tx, MONO_H + 0.6, tz);
    ref.current.rotation.y = -a + Math.PI / 2;

    if (ridingRef.current) {
      const camInside = new THREE.Vector3(0, 1.4, -0.5);
      camInside.applyEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
      camInside.add(new THREE.Vector3(tx, MONO_H + 0.6, tz));
      camera.position.lerp(camInside, 1 - Math.pow(0.001, dtc));
      const lookAhead = new THREE.Vector3(
        Math.cos(a - 0.1) * MONO_RX,
        MONO_H + 1.5,
        Math.sin(a - 0.1) * MONO_RZ
      );
      camera.lookAt(lookAhead);
    }
  });

  const pink = useMemo(() => new THREE.Color("#f5b8c4"), []);
  const yellow = useMemo(() => new THREE.Color("#fde68a"), []);
  const windowCol = useMemo(() => new THREE.Color("#aaddff"), []);

  return (
    <group ref={ref}>
      {/* 3 cars */}
      {[0, -4.5, -9].map((cz, ci) => (
        <group key={ci} position={[0, 0, cz]}>
          {/* Body - rounded using capsule */}
          <mesh castShadow>
            <capsuleGeometry args={[0.9, 2.5, 6, 12]} />
            <meshStandardMaterial
              color={ci === 0 ? yellow : pink}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>
          {/* Roof accent */}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[1.5, 0.08, 3.5]} />
            <meshStandardMaterial color={ci === 0 ? pink : yellow} />
          </mesh>
          {/* Windows left */}
          {[-0.8, 0, 0.8].map((wz, wi) => (
            <mesh key={`wl${wi}`} position={[0.82, 0.1, wz]}>
              <boxGeometry args={[0.03, 0.5, 0.55]} />
              <meshStandardMaterial
                color={windowCol}
                emissive={windowCol}
                emissiveIntensity={0.5}
                toneMapped={false}
              />
            </mesh>
          ))}
          {/* Windows right */}
          {[-0.8, 0, 0.8].map((wz, wi) => (
            <mesh key={`wr${wi}`} position={[-0.82, 0.1, wz]}>
              <boxGeometry args={[0.03, 0.5, 0.55]} />
              <meshStandardMaterial
                color={windowCol}
                emissive={windowCol}
                emissiveIntensity={0.5}
                toneMapped={false}
              />
            </mesh>
          ))}
          {/* Bottom stripe */}
          <mesh position={[0, -0.75, 0]}>
            <boxGeometry args={[1.85, 0.06, 3.8]} />
            <meshStandardMaterial color="#e8739a" />
          </mesh>
        </group>
      ))}
      {/* Front headlight */}
      <mesh position={[0, 0, 3.5]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* Interior decor (visible through windows when riding) */}
      {/* Hanging ads */}
      <mesh position={[0, 0.5, -1]}>
        <boxGeometry args={[0.6, 0.35, 0.02]} />
        <meshStandardMaterial color="#ffb6c1" emissive="#ffb6c1" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.5, -5.5]}>
        <boxGeometry args={[0.6, 0.35, 0.02]} />
        <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={0.3} />
      </mesh>
      {/* Heart photo spot in middle car */}
      <mesh position={[0, 0, -4.5]}>
        <torusGeometry args={[0.3, 0.06, 8, 16]} />
        <meshStandardMaterial color="#ff6b8a" emissive="#ff6b8a" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ===== モノレール駅 =====
export const MONO_STATION = {
  x: MONO_STATION_X,
  z: MONO_STATION_Z,
  w: 14,
  d: 10,
  h: MONO_H + 3,
  doorW: 3,
};

function MonorailStation() {
  const stationH = MONO_STATION.h;
  const wallCol = useMemo(() => new THREE.Color("#f0dce0"), []);
  const roofCol = useMemo(() => new THREE.Color("#d4a0aa"), []);
  const archCol = useMemo(() => new THREE.Color("#c88898"), []);

  const signTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "#ffb6c1");
    g.addColorStop(1, "#fde68a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#6b2040";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚝 MARIN LUNA STATION", 256, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <group position={[MONO_STATION.x, 0, MONO_STATION.z]}>
      {/* Main building walls */}
      <mesh position={[0, stationH / 2, 0]} castShadow>
        <boxGeometry args={[MONO_STATION.w, stationH, MONO_STATION.d]} />
        <meshStandardMaterial color={wallCol} roughness={0.7} />
      </mesh>
      {/* Arched entrance (front) */}
      <mesh position={[0, 4, MONO_STATION.d / 2 + 0.05]}>
        <boxGeometry args={[MONO_STATION.doorW + 1, 8, 0.3]} />
        <meshStandardMaterial color={archCol} />
      </mesh>
      {/* Arch top */}
      <mesh position={[0, 8.5, MONO_STATION.d / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.4, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={archCol} />
      </mesh>
      {/* Platform at track height */}
      <mesh position={[0, MONO_H - 0.15, 0]}>
        <boxGeometry args={[MONO_STATION.w + 2, 0.3, MONO_STATION.d + 2]} />
        <meshStandardMaterial color="#e8d0d4" roughness={0.6} />
      </mesh>
      {/* Platform canopy */}
      <mesh position={[0, MONO_H + 3, 0]}>
        <boxGeometry args={[MONO_STATION.w + 3, 0.2, MONO_STATION.d + 3]} />
        <meshStandardMaterial color={roofCol} />
      </mesh>
      {/* Canopy supports */}
      {[[-5, -3], [5, -3], [-5, 3], [5, 3]].map(([px, pz], i) => (
        <mesh key={i} position={[px, MONO_H + 1.5, pz]}>
          <cylinderGeometry args={[0.1, 0.1, 3, 6]} />
          <meshStandardMaterial color={archCol} />
        </mesh>
      ))}
      {/* Sign */}
      {signTex && (
        <mesh position={[0, stationH + 1, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[8, 2]} />
          <meshStandardMaterial
            map={signTex}
            emissive="#fff"
            emissiveIntensity={0.5}
            emissiveMap={signTex}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Clock on front */}
      <mesh position={[0, stationH - 2, MONO_STATION.d / 2 + 0.2]}>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color="#fffbe6" />
      </mesh>
      <mesh position={[0, stationH - 2, MONO_STATION.d / 2 + 0.25]}>
        <boxGeometry args={[0.05, 0.7, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, stationH - 2, MONO_STATION.d / 2 + 0.25]} rotation={[0, 0, Math.PI / 3]}>
        <boxGeometry args={[0.04, 0.5, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Interior stairs visual (simple ramp inside) */}
      <mesh position={[0, MONO_H / 2, -1]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[2, 0.15, MONO_H * 0.7]} />
        <meshStandardMaterial color="#d4c0c4" />
      </mesh>
    </group>
  );
}

// ===== 街路樹 (スタイライズド広葉樹) =====
function StreetTree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const rng = mulberry32(Math.floor(x * 100 + z * 10));
  const leafHue = 100 + Math.floor(rng() * 40);
  const leafCol = `hsl(${leafHue}, 55%, 38%)`;
  const trunkH = 2.5 + rng() * 1.5;
  const crownR = 1.5 + rng() * 0.8;
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.18, trunkH, 6]} />
        <meshStandardMaterial color="#6b4226" roughness={0.9} />
      </mesh>
      <mesh position={[0, trunkH + crownR * 0.6, 0]} castShadow>
        <sphereGeometry args={[crownR, 10, 8]} />
        <meshStandardMaterial color={leafCol} roughness={0.85} />
      </mesh>
      <mesh position={[crownR * 0.4, trunkH + crownR * 0.3, crownR * 0.3]} castShadow>
        <sphereGeometry args={[crownR * 0.7, 8, 6]} />
        <meshStandardMaterial color={`hsl(${leafHue + 10}, 50%, 42%)`} roughness={0.85} />
      </mesh>
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
  label?: string;
  type?: "normal" | "concert" | "cafe" | "shop" | "station";
  skyline?: boolean;
}

function overlapsAny(x: number, z: number, w: number, d: number, list: BuildingBox[]): boolean {
  for (const b of list) {
    if (Math.abs(x - b.x) < (w + b.w) / 2 + 12 && Math.abs(z - b.z) < (d + b.d) / 2 + 12) return true;
  }
  if (Math.hypot(x - PLAZA_POS.x, z - PLAZA_POS.z) < PLAZA_POS.radius + 5) return true;
  return false;
}

export function makeBuildings(): BuildingBox[] {
  const out: BuildingBox[] = [];
  const rng = mulberry32(42);
  const hues = [15, 25, 35, 45, 160, 180, 200, 210, 330, 340, 350, 0, 60, 120];
  const pickHue = () => hues[Math.floor(rng() * hues.length)] + Math.floor((rng() - 0.5) * 20);

  const labels: { label: string; type?: BuildingBox["type"] }[] = [
    { label: "FLOURISH BAKERY", type: "cafe" },
    { label: "☕ Coffee Culture", type: "cafe" },
    { label: "🛍️ IDOL SHOP", type: "shop" },
    { label: "🏢 AGENCY" },
    { label: "🎶 K-Dance Studio" },
    { label: "🎵 LIVE HOUSE" },
    { label: "📺 MBC Studio" },
    { label: "🎧 Recording" },
    { label: "🎤 Noraebang" },
    { label: "🍜 Ramen St." },
    { label: "📱 NEOFOLD" },
    { label: "🧋 PIKO SODA" },
    { label: "🎮 Game Center" },
    { label: "👗 Atelier" },
    { label: "✨ MarinLuna HQ" },
    { label: "📡 Media Tower" },
    { label: "🐱 Cat Cafe", type: "cafe" },
    { label: "💈 Beauty Salon" },
    { label: "🏋️ Fitness" },
    { label: "📚 Bookstore" },
  ];
  let labelIdx = 0;

  for (let gx = -420; gx <= 420; gx += 40) {
    for (let gz = -420; gz <= 280; gz += 40) {
      const cx = gx + (rng() - 0.5) * 8;
      const cz = gz + (rng() - 0.5) * 8;
      if (isOnRoad(cx, cz)) continue;
      if (Math.hypot(cx - PLAZA_POS.x, cz - PLAZA_POS.z) < PLAZA_POS.radius + 8) continue;
      if (cz > 280) continue;
      if (Math.hypot(cx - LUNA_DOME.x, cz - LUNA_DOME.z) < LUNA_DOME.radius + 15) continue;
      if (rng() < 0.25) continue;

      const floors = 2 + Math.floor(rng() * 4);
      const h = floors * 4;
      const bw = 7 + rng() * 5;
      const bd = 6 + rng() * 4;

      if (overlapsAny(cx, cz, bw, bd, out)) continue;

      const bld: BuildingBox = { x: cx, z: cz, w: bw, d: bd, h, hue: pickHue() };
      if (labelIdx < labels.length && rng() < 0.3) {
        bld.label = labels[labelIdx].label;
        bld.type = labels[labelIdx].type;
        labelIdx++;
      }
      out.push(bld);
    }
  }

  for (let i = 0; labelIdx < labels.length && i < out.length; i++) {
    if (!out[i].label) {
      out[i].label = labels[labelIdx].label;
      out[i].type = labels[labelIdx].type;
      labelIdx++;
    }
  }

  return out;
}

function makeSkyline(): BuildingBox[] {
  const out: BuildingBox[] = [];
  const rng = mulberry32(1234);
  const hues = [15, 30, 45, 60, 120, 160, 200, 210, 330, 350];
  for (let i = 0; i < 80; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 550 + rng() * 350;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const scale = 1.2 + rng() * 0.3;
    out.push({
      x, z,
      w: (8 + rng() * 12) * scale,
      d: (8 + rng() * 12) * scale,
      h: (20 + rng() * 80) * scale,
      hue: hues[Math.floor(rng() * hues.length)] + (rng() - 0.5) * 30,
      skyline: true,
    });
  }
  return out;
}

// 写真館: 街の特定位置に固定配置。前面 (z+d/2) 中央に 2m のドア開口がある。
// 中に入ろうとしたプレイヤーは、このドア帯 (doorX ± doorW/2) だけが通過可能。
// プレイヤーが開口を抜けて内側に立つと「入場トリガー」が発火し /gallery へ遷移。
export const PHOTO_HALL = {
  x: -50,
  z: -50,
  w: 9,
  d: 6,
  h: 7,
  doorOffsetX: 0, // 建物中心からのズレ
  doorW: 2.4,
  hue: 320,
};

export const LUNA_DOME = {
  x: 350,
  z: -300,
  radius: 35,
  domeH: 26,
  baseH: 8,
  doorW: 6,
};

// ===== LUNA DOME (大規模コンサート会場) =====
function LunaDome() {
  const { x, z, radius, domeH, baseH, doorW } = LUNA_DOME;
  const laserRef = useRef<THREE.Group>(null);

  const signTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, "#ff3d8b");
    g.addColorStop(1, "#7b2cff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 110px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 24;
    ctx.fillText("LUNA DOME", 512, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const crowd = useMemo(() => {
    const rng = mulberry32(3333);
    const out: { x: number; y: number; z: number; color: string }[] = [];
    const colors = ["#ff3d8b", "#00e6ff", "#7b2cff", "#ffd166"];
    for (let i = 0; i < 30; i++) {
      const angle = rng() * Math.PI * 2;
      const r = 10 + rng() * 16;
      const tier = Math.floor((r - 10) / 5.5);
      out.push({
        x: Math.cos(angle) * r,
        y: 2 + tier * 1.8 + rng() * 0.6,
        z: Math.sin(angle) * r,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    return out;
  }, []);

  useFrame((state) => {
    if (laserRef.current) {
      laserRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* ドーム外殻 (半球) */}
      <mesh position={[0, baseH, 0]}>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#d8d8e8" metalness={0.5} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* グリッドワイヤーフレーム */}
      <mesh position={[0, baseH, 0]}>
        <sphereGeometry args={[radius + 0.15, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#88ccff" wireframe transparent opacity={0.12} emissive="#88ccff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* 円筒ベース */}
      <mesh position={[0, baseH / 2, 0]}>
        <cylinderGeometry args={[radius, radius + 1, baseH, 32]} />
        <meshStandardMaterial color="#2a2040" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* ネオンバンド (ドーム接合部) */}
      <mesh position={[0, baseH, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.15, 8, 48]} />
        <meshStandardMaterial color="#ff3d8b" emissive="#ff3d8b" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* 地面ネオンリング */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius + 1.5, 0.12, 8, 48]} />
        <meshStandardMaterial color="#7b2cff" emissive="#7b2cff" emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* エントランス (+z側) */}
      <group position={[0, 0, radius]}>
        <mesh position={[-doorW / 2 - 0.3, baseH / 2, 0]}>
          <boxGeometry args={[0.6, baseH, 1.2]} />
          <meshStandardMaterial color="#7b2cff" emissive="#7b2cff" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        <mesh position={[doorW / 2 + 0.3, baseH / 2, 0]}>
          <boxGeometry args={[0.6, baseH, 1.2]} />
          <meshStandardMaterial color="#7b2cff" emissive="#7b2cff" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        <mesh position={[0, baseH, 0]}>
          <boxGeometry args={[doorW + 1.2, 0.5, 1.2]} />
          <meshStandardMaterial color="#ff3d8b" emissive="#ff3d8b" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3, 2]}>
          <sphereGeometry args={[0.3, 6, 6]} />
          <meshStandardMaterial color="#7b2cff" emissive="#7b2cff" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </group>

      {/* LUNA DOME サイン */}
      {signTex && (
        <mesh position={[0, baseH + 3.5, radius + 1.5]}>
          <planeGeometry args={[16, 4]} />
          <meshStandardMaterial map={signTex} emissive="#ffffff" emissiveMap={signTex} emissiveIntensity={1.2} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ===== 内部 ===== */}
      {/* ステージ (中央) */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[5, 6, 2, 24]} />
        <meshStandardMaterial color="#1a0a30" emissive="#2a1050" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 2.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5, 24]} />
        <meshStandardMaterial color="#ff3d8b" emissive="#ff3d8b" emissiveIntensity={0.8} transparent opacity={0.4} toneMapped={false} />
      </mesh>

      {/* 観客席 (3段の同心円リング) */}
      {[0, 1, 2].map(tier => (
        <mesh key={`tier${tier}`} position={[0, 1.5 + tier * 1.8, 0]}>
          <torusGeometry args={[12 + tier * 5, 1.8, 4, 48]} />
          <meshStandardMaterial color="#1a0e2e" emissive="#0a0518" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* 天井スクリーン (4面) */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={`scr${i}`} position={[Math.cos(a) * 10, domeH - 4, Math.sin(a) * 10]} rotation={[0.25, -a + Math.PI / 2, 0]}>
            <planeGeometry args={[7, 4]} />
            <meshStandardMaterial color="#111" emissive="#88aaff" emissiveIntensity={0.9} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* コンサート照明 */}
      <pointLight position={[0, domeH - 2, 0]} intensity={4} color="#ff3d8b" distance={50} />
      <pointLight position={[0, domeH - 5, 0]} intensity={2.5} color="#7b2cff" distance={40} />
      <pointLight position={[0, 4, 0]} intensity={3} color="#ffffff" distance={15} />

      {/* レーザービーム (回転) */}
      <group ref={laserRef} position={[0, baseH + domeH * 0.3, 0]}>
        {Array.from({ length: 4 }).map((_, i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={`ls${i}`} rotation={[Math.cos(a) * 0.5, a, 0]}>
              <cylinderGeometry args={[0.02, 0.02, domeH * 1.2, 4]} />
              <meshStandardMaterial color="#00e6ff" emissive="#00e6ff" emissiveIntensity={5} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          );
        })}
      </group>

      {/* 観客ペンライト */}
      {crowd.map((l, i) => (
        <mesh key={`cl${i}`} position={[l.x, l.y, l.z]}>
          <sphereGeometry args={[0.1, 4, 4]} />
          <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ===== 道路ネットワーク (2車線 + 歩道 + 縁石) =====
function RoadNetwork() {
  const asphalt = "#555";
  const sidewalkCol = "#c8c0b4";
  const curbCol = "#999";
  const lineCol = "#eee";
  return (
    <group>
      {ROAD_XS.map((rx) => {
        const w = roadWidth(rx);
        const swW = 3.5;
        return (
          <group key={`vr${rx}`}>
            {/* アスファルト */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[rx, 0.02, 0]} receiveShadow>
              <planeGeometry args={[w, 1200]} />
              <meshStandardMaterial color={asphalt} roughness={0.9} />
            </mesh>
            {/* 中央線 (白破線) */}
            {Array.from({ length: 25 }).map((_, i) => (
              <mesh key={`cl${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[rx, 0.03, -480 + i * 40]}>
                <planeGeometry args={[0.2, 5]} />
                <meshStandardMaterial color={lineCol} roughness={0.5} />
              </mesh>
            ))}
            {/* 左歩道 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[rx - w / 2 - swW / 2, 0.12, 0]}>
              <planeGeometry args={[swW, 1200]} />
              <meshStandardMaterial color={sidewalkCol} roughness={0.85} />
            </mesh>
            {/* 右歩道 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[rx + w / 2 + swW / 2, 0.12, 0]}>
              <planeGeometry args={[swW, 1200]} />
              <meshStandardMaterial color={sidewalkCol} roughness={0.85} />
            </mesh>
            {/* 左縁石 */}
            <mesh position={[rx - w / 2 - 0.15, 0.07, 0]}>
              <boxGeometry args={[0.3, 0.14, 1200]} />
              <meshStandardMaterial color={curbCol} roughness={0.8} />
            </mesh>
            {/* 右縁石 */}
            <mesh position={[rx + w / 2 + 0.15, 0.07, 0]}>
              <boxGeometry args={[0.3, 0.14, 1200]} />
              <meshStandardMaterial color={curbCol} roughness={0.8} />
            </mesh>
          </group>
        );
      })}
      {ROAD_ZS.map((rz) => {
        const w = roadWidth(rz);
        const swW = 3.5;
        return (
          <group key={`hr${rz}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, rz]} receiveShadow>
              <planeGeometry args={[1200, w]} />
              <meshStandardMaterial color={asphalt} roughness={0.9} />
            </mesh>
            {Array.from({ length: 25 }).map((_, i) => (
              <mesh key={`cl${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-480 + i * 40, 0.03, rz]}>
                <planeGeometry args={[5, 0.2]} />
                <meshStandardMaterial color={lineCol} roughness={0.5} />
              </mesh>
            ))}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, rz - w / 2 - swW / 2]}>
              <planeGeometry args={[1200, swW]} />
              <meshStandardMaterial color={sidewalkCol} roughness={0.85} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, rz + w / 2 + swW / 2]}>
              <planeGeometry args={[1200, swW]} />
              <meshStandardMaterial color={sidewalkCol} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.07, rz - w / 2 - 0.15]}>
              <boxGeometry args={[1200, 0.14, 0.3]} />
              <meshStandardMaterial color={curbCol} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.07, rz + w / 2 + 0.15]}>
              <boxGeometry args={[1200, 0.14, 0.3]} />
              <meshStandardMaterial color={curbCol} roughness={0.8} />
            </mesh>
          </group>
        );
      })}
      {/* 横断歩道 (主要交差点) */}
      {ROAD_XS.filter((_, i) => i % 2 === 0).map(rx =>
        ROAD_ZS.filter((_, j) => j % 2 === 0).map(rz => (
          <group key={`xw${rx}_${rz}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[rx - 3 + i * 1.5, 0.04, rz + roadWidth(rz) / 2 + 1]}>
                <planeGeometry args={[1.0, 3]} />
                <meshStandardMaterial color="#eee" roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))
      )}
    </group>
  );
}

// ===== 街全体 =====
function City() {
  const buildings = useMemo(() => makeBuildings(), []);
  const skyline = useMemo(() => makeSkyline(), []);

  const trees = useMemo(() => {
    const rng = mulberry32(555);
    const out: { x: number; z: number; s: number }[] = [];
    for (const rx of ROAD_XS) {
      const w = roadWidth(rx);
      for (let z = -400; z <= 280; z += 35 + Math.floor(rng() * 15)) {
        out.push({ x: rx + w / 2 + 5.5 + rng() * 1.5, z: z + rng() * 6, s: 1.0 + rng() * 0.4 });
        out.push({ x: rx - w / 2 - 5.5 - rng() * 1.5, z: z + rng() * 6, s: 1.0 + rng() * 0.4 });
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ x: PLAZA_POS.x + Math.cos(a) * 20, z: PLAZA_POS.z + Math.sin(a) * 20, s: 1.1 + rng() * 0.3 });
    }
    return out;
  }, []);

  const streetLamps = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (const rx of ROAD_XS) {
      const w = roadWidth(rx);
      for (let z = -400; z <= 280; z += 60) {
        out.push({ x: rx + w / 2 + 2, z });
      }
    }
    return out;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#4a8c3f" roughness={0.9} />
      </mesh>

      <RoadNetwork />
      <CentralPlaza />

      <AreaSign x={150}  z={-150} text="🎤 엔터테인먼트" rotY={0} />
      <AreaSign x={150}  z={150}  text="🛍️ 쇼핑거리" rotY={0} />

      {buildings.map((b, i) => (
        <Building key={`fg${i}`} {...b} />
      ))}
      {skyline.map((b, i) => (
        <Building key={`sk${i}`} {...b} />
      ))}

      <PhotoHall />
      <LunaDome />
      <WaterBody />
      <MonorailTrack />
      <MonorailStation />

      {trees.map((p, i) => (
        <StreetTree key={i} x={p.x} z={p.z} scale={p.s} />
      ))}

      <Billboard x={0} y={18} z={-250} text="MarinLuna" subText="Rise to Fame" colorA="#ff6688" colorB="#6688cc" width={20} height={5} />
      <Billboard x={0} y={16} z={250} text="📍 SEOUL" subText="K-POP CITY" colorA="#44aacc" colorB="#6688cc" rotationY={Math.PI} width={18} height={4.5} />
      <Billboard x={-280} y={16} z={-80} text="✨ DREAM STAGE" subText="꿈의 무대" colorA="#ee9944" colorB="#ee6688" rotationY={Math.PI / 2} width={16} height={4} />
      <Billboard x={280} y={14} z={80} text="🎤 DEBUT" subText="THE WORLD IS WATCHING" colorA="#6688cc" colorB="#44aacc" rotationY={-Math.PI / 2} width={16} height={4} />

      <CityAdBoards />
      <NPCCars />
      <NPCPedestrians />
      <FlyingVehicles />

      {streetLamps.map((l, i) => (
        <group key={`sl${i}`}>
          <mesh position={[l.x, 2.5, l.z]}>
            <cylinderGeometry args={[0.05, 0.07, 5, 4]} />
            <meshStandardMaterial color="#666" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[l.x, 5.2, l.z]}>
            <cylinderGeometry args={[0.3, 0.15, 0.25, 8]} />
            <meshStandardMaterial color="#ddd" roughness={0.5} />
          </mesh>
          <mesh position={[l.x, 5.4, l.z]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#ffffee" emissive="#ffffee" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
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
    { px: 30, py: 8, pz: -60, rotY: Math.PI / 2 },
    { px: -30, py: 10, pz: -80, rotY: -Math.PI / 2 },
    { px: 25, py: 7, pz: 30, rotY: Math.PI / 2 },
    { px: -25, py: 6, pz: 40, rotY: -Math.PI / 2 },
    { px: 35, py: 8, pz: 80, rotY: Math.PI / 2 },
    { px: -35, py: 9, pz: -100, rotY: 0 },
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
  // MonorailStation: door on front (+z side)
  const ms = MONO_STATION;
  const msDx = px - ms.x;
  const msDz = pz - ms.z;
  const msInBounds =
    Math.abs(msDx) < ms.w / 2 + r && Math.abs(msDz) < ms.d / 2 + r;
  if (msInBounds) {
    const nearFront = msDz > ms.d / 2 - r - 0.4;
    const inDoorStrip = Math.abs(msDx) < ms.doorW / 2 - r * 0.5;
    if (nearFront && inDoorStrip) return false;
    return true;
  }

  // LUNA DOME: 円形壁 + 入口開口
  const dd = LUNA_DOME;
  const ddx = px - dd.x;
  const ddz = pz - dd.z;
  const dDist = Math.hypot(ddx, ddz);
  if (dDist > dd.radius - r && dDist < dd.radius + r) {
    if (ddz > 0 && Math.abs(ddx) < dd.doorW / 2) return false;
    return true;
  }
  return false;
}

function Player({
  avatar,
  input,
  onEnterGallery,
  ridingRef,
  dismountPosRef,
}: {
  avatar: UserAvatar;
  input: React.MutableRefObject<InputState>;
  onEnterGallery?: () => void;
  ridingRef: React.MutableRefObject<boolean>;
  dismountPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const yawRef = useRef(0);
  const walkRef = useRef(0);
  const walkSpeedRef = useRef(0);
  const posRef = useRef(new THREE.Vector3(PLAZA_POS.x, 0, PLAZA_POS.z + 12));
  const insideHallRef = useRef(false);
  const insideStationRef = useRef(false);
  const wasRidingRef = useRef(false);
  const { camera } = useThree();
  const buildings = useMemo(() => makeBuildings(), []);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05); // 大きい dt はクランプ
    const { x: jx, y: jy } = input.current.move;
    const camYaw = input.current.camYaw;
    const camPitch = THREE.MathUtils.clamp(input.current.camPitch, 0.15, 1.15);

    // カメラ相対の移動方向を計算
    // forward = カメラ→アバター方向 (画面奥), right = 画面右方向。
    // right = cross(forward, up) を Three.js (y-up 右手系) で展開すると
    // rightX = -cos(yaw), rightZ = sin(yaw) になる。
    // ここを誤ると左右が逆になるので要注意。
    const speed = 14;
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
    const nextX = THREE.MathUtils.clamp(posRef.current.x + dx, -480, 480);
    const nextZ = THREE.MathUtils.clamp(posRef.current.z + dz, -480, 480);
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

    // モノレール駅に入った瞬間 → 乗車開始 (エッジトリガー)
    const ms = MONO_STATION;
    const insideStation =
      Math.abs(posRef.current.x - ms.x) < ms.w / 2 - PLAYER_RADIUS &&
      Math.abs(posRef.current.z - ms.z) < ms.d / 2 - PLAYER_RADIUS;
    if (insideStation && !insideStationRef.current && !ridingRef.current) {
      ridingRef.current = true;
    }
    insideStationRef.current = insideStation;

    if (ridingRef.current) {
      wasRidingRef.current = true;
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (wasRidingRef.current) {
      wasRidingRef.current = false;
      posRef.current.copy(dismountPosRef.current);
      insideStationRef.current = true;
    }
    if (groupRef.current) groupRef.current.visible = true;

    // アバターの向きを移動方向にスムーズ追従
    if (mag > 0.1) {
      const targetYaw = Math.atan2(dx, dz);
      const cur = yawRef.current;
      let diff = targetYaw - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yawRef.current = cur + diff * Math.min(1, dtc * 12);
      walkRef.current += dtc * 9 * Math.min(1, mag * 1.5);
      walkSpeedRef.current = THREE.MathUtils.lerp(walkSpeedRef.current, Math.min(1, mag), dtc * 8);
    } else {
      walkRef.current += dtc * 0.5;
      walkSpeedRef.current = THREE.MathUtils.lerp(walkSpeedRef.current, 0, dtc * 6);
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
    const D = 8;
    const camOffsetX = Math.sin(camYaw) * Math.cos(camPitch) * D;
    const camOffsetZ = Math.cos(camYaw) * Math.cos(camPitch) * D;
    const camOffsetY = Math.sin(camPitch) * D + 2.2;
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
      <Avatar3D avatar={avatar} walkPhaseRef={walkRef} walkSpeedRef={walkSpeedRef} />
    </group>
  );
}

// ===== 動的ライティング (明るい昼夜サイクル) =====
function DynamicLighting() {
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  useFrame(() => {
    const { phase, t } = getCycleState();
    let ambI: number, dirI: number;
    let ambCol: string, dirCol: string;

    if (phase === "morning") {
      ambI = 0.5 + t * 0.3;
      dirI = 0.6 + t * 0.6;
      ambCol = lerpHex("#8899bb", "#bbccdd", t);
      dirCol = lerpHex("#ffaa66", "#ffeedd", t);
      const fogCol = new THREE.Color(lerpHex("#aabbcc", "#bbddee", t));
      scene.fog = new THREE.FogExp2(fogCol.getHex(), 0.0015);
    } else if (phase === "day") {
      ambI = 0.8;
      dirI = 1.2;
      ambCol = "#bbccdd";
      dirCol = "#ffeedd";
      scene.fog = new THREE.FogExp2(0xbbddee, 0.001);
    } else {
      ambI = 0.8 - t * 0.5;
      dirI = 1.2 - t * 0.8;
      ambCol = lerpHex("#bbccdd", "#556688", t);
      dirCol = lerpHex("#ffeedd", "#8888aa", t);
      const fogCol = new THREE.Color(lerpHex("#bbddee", "#334466", t));
      scene.fog = new THREE.FogExp2(fogCol.getHex(), 0.0012 + t * 0.0008);
    }

    if (ambRef.current) { ambRef.current.intensity = ambI; ambRef.current.color.set(ambCol); }
    if (dirRef.current) { dirRef.current.intensity = dirI; dirRef.current.color.set(dirCol); }
    if (hemiRef.current) { hemiRef.current.intensity = phase === "day" ? 0.6 : 0.4; }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.7} color="#bbccdd" />
      <hemisphereLight ref={hemiRef} args={["#aaddff", "#446633", 0.5]} />
      <directionalLight ref={dirRef} position={[60, 50, 30]} intensity={1.0} color="#ffeedd" castShadow />
      <directionalLight position={[-30, 40, -20]} intensity={0.3} color="#aabbff" />
    </>
  );
}

// ===== シーン全体 =====
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
  const ridingRef = useRef(false);
  const playerPosRef = useRef(new THREE.Vector3(PLAZA_POS.x, 0, PLAZA_POS.z + 12));

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0xbbddee, 0.001);
    scene.background = null;
  }, [scene]);

  const handleDismount = useCallback(() => {
    playerPosRef.current.set(MONO_STATION.x, 0, MONO_STATION.z + MONO_STATION.d / 2 + 2);
  }, []);

  return (
    <>
      <DynamicSky />
      <DynamicLighting />
      <City />
      <MonorailTrain ridingRef={ridingRef} onDismount={handleDismount} />
      <Player avatar={avatar} input={input} onEnterGallery={onEnterGallery} ridingRef={ridingRef} dismountPosRef={playerPosRef} />
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
        camera={{ position: [0, 8, 14], fov: 62, near: 0.1, far: 2500 }}
        dpr={[1, 1.5]}
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
            1.15
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
