"use client";

/**
 * 2D 部屋エディター (家 / 事務所 共通)。
 * - 8x6 のグリッドに家具 / ポスターを配置
 * - 壁色 / 床色の色相調整
 * - 配置アイテムのタップで削除 / ドラッグで移動
 * - ポスターは推しグループまたは任意のグループを選ぶと、そのカラーで貼られる
 *
 * 3D にしない理由: 編集 UX は 2D の方が明快で、パフォーマンスも確保できる。
 * 将来的に 3D 化する場合も、データモデル (RoomState / RoomItem) はそのまま流用可能。
 */

import { useMemo, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import type { Group, RoomItem, RoomItemKind, RoomState } from "@/lib/types";

const GRID_W = 8;
const GRID_H = 6;

const ITEM_LABELS: Record<RoomItemKind, string> = {
  poster: "ポスター",
  plant: "観葉植物",
  sofa: "ソファ",
  desk: "デスク",
  lamp: "ネオンランプ",
  rug: "ラグ",
  shelf: "棚",
  tv: "TV",
  bed: "ベッド",
  trophy: "トロフィー",
};

const ITEM_EMOJI: Record<RoomItemKind, string> = {
  poster: "🖼️",
  plant: "🪴",
  sofa: "🛋️",
  desk: "🪑",
  lamp: "💡",
  rug: "🟣",
  shelf: "📚",
  tv: "📺",
  bed: "🛏️",
  trophy: "🏆",
};

// 新規追加時のカラーパレット候補
const PALETTE: [string, string][] = [
  ["#ff3d8b", "#7b2cff"],
  ["#ffd166", "#ff3d8b"],
  ["#00e6ff", "#7b2cff"],
  ["#1f6b3a", "#ffd166"],
  ["#ff7ac6", "#312150"],
];

export function RoomEditor({
  target,
  room,
  groups,
  biasGroupIds,
  roomTitle,
}: {
  target: "house" | "office";
  room: RoomState;
  groups: Group[];
  biasGroupIds: string[];
  roomTitle: string;
}) {
  const { addRoomItem, removeRoomItem, moveRoomItem, setRoomHue } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const wallCol = `hsl(${room.wallHue}, 45%, 22%)`;
  const wallAccent = `hsl(${room.wallHue}, 65%, 38%)`;
  const floorCol = `hsl(${room.floorHue}, 30%, 18%)`;
  const floorAccent = `hsl(${room.floorHue}, 55%, 30%)`;

  // ドラッグ: 選択中アイテムをタップしたマスに移動させる
  function handleCellClick(gx: number, gy: number) {
    if (selectedId) {
      moveRoomItem(target, selectedId, gx, gy);
    }
  }

  function handleAdd(kind: RoomItemKind, groupId?: string) {
    const [colorA, colorB] = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    // グループポスターなら、そのグループの色を使う
    let cA = colorA;
    let cB = colorB;
    if (groupId) {
      const g = groups.find((x) => x.id === groupId);
      if (g) {
        cA = g.colorA;
        cB = g.colorB;
      }
    }
    // 空いているセルを探して配置
    const occupied = new Set(room.items.map((i) => `${i.x},${i.y}`));
    let placed = false;
    outer: for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!occupied.has(`${x},${y}`)) {
          addRoomItem(target, {
            kind,
            x,
            y,
            groupId,
            colorA: cA,
            colorB: cB,
          });
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) {
      addRoomItem(target, {
        kind,
        x: 0,
        y: 0,
        groupId,
        colorA: cA,
        colorB: cB,
      });
    }
    setAddMenuOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 部屋ビュー */}
      <div
        ref={boardRef}
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-white/15 shadow-glow"
        style={{
          background: `linear-gradient(180deg, ${wallCol} 0%, ${wallCol} 40%, ${floorCol} 40%, ${floorCol} 100%)`,
        }}
      >
        {/* 壁のネオンライン */}
        <div
          className="absolute left-0 right-0 h-[3px]"
          style={{ top: "40%", background: wallAccent, boxShadow: `0 0 12px ${wallAccent}` }}
        />
        {/* 床のパースライン */}
        <div
          className="absolute left-0 right-0 h-[2px]"
          style={{ top: "44%", background: floorAccent, opacity: 0.7 }}
        />

        {/* グリッド (下半分 = 床) */}
        <div className="absolute inset-0 flex flex-col">
          {/* 壁エリア (上 40%): ポスター専用 */}
          <div className="relative" style={{ height: "40%" }}>
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_W}, 1fr)`,
                gridTemplateRows: `repeat(2, 1fr)`,
              }}
            >
              {Array.from({ length: GRID_W * 2 }).map((_, i) => {
                const gx = i % GRID_W;
                const gy = Math.floor(i / GRID_W); // 0..1 on wall (mapped to y=4,5)
                const wallY = gy + 4;
                return (
                  <button
                    key={`w-${i}`}
                    onClick={() => handleCellClick(gx, wallY)}
                    className="border border-white/5 hover:bg-white/5"
                    aria-label={`壁マス ${gx},${wallY}`}
                  />
                );
              })}
            </div>
            {/* 壁アイテム (y >= 4) */}
            {room.items
              .filter((i) => i.y >= 4)
              .map((i) => (
                <ItemView
                  key={i.id}
                  item={i}
                  onWall
                  group={groups.find((g) => g.id === i.groupId)}
                  selected={selectedId === i.id}
                  onSelect={() =>
                    setSelectedId((cur) => (cur === i.id ? null : i.id))
                  }
                />
              ))}
          </div>

          {/* 床エリア (下 60%) */}
          <div className="relative flex-1">
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_W}, 1fr)`,
                gridTemplateRows: `repeat(4, 1fr)`,
              }}
            >
              {Array.from({ length: GRID_W * 4 }).map((_, i) => {
                const gx = i % GRID_W;
                const gy = Math.floor(i / GRID_W); // 0..3 on floor (mapped y=0..3)
                return (
                  <button
                    key={`f-${i}`}
                    onClick={() => handleCellClick(gx, gy)}
                    className="border border-white/5 hover:bg-white/5"
                    aria-label={`床マス ${gx},${gy}`}
                  />
                );
              })}
            </div>
            {/* 床アイテム (y < 4) */}
            {room.items
              .filter((i) => i.y < 4)
              .map((i) => (
                <ItemView
                  key={i.id}
                  item={i}
                  group={groups.find((g) => g.id === i.groupId)}
                  selected={selectedId === i.id}
                  onSelect={() =>
                    setSelectedId((cur) => (cur === i.id ? null : i.id))
                  }
                />
              ))}
          </div>
        </div>

        {/* 選択中の操作ヒント */}
        {selectedId && (
          <div className="absolute top-2 left-2 right-2 text-[11px] bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-white flex items-center justify-between gap-2">
            <span>移動: マスをタップ / 削除はゴミ箱</span>
            <button
              className="chip !bg-kpink !text-white text-[11px]"
              onClick={() => {
                removeRoomItem(target, selectedId);
                setSelectedId(null);
              }}
            >
              🗑️ 削除
            </button>
          </div>
        )}
      </div>

      {/* 追加 / 色 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setAddMenuOpen((v) => !v)}
          className="btn-primary text-sm"
        >
          ＋ アイテム追加
        </button>
        <HuePicker
          label="壁"
          value={room.wallHue}
          onChange={(v) => setRoomHue(target, v, room.floorHue)}
        />
        <HuePicker
          label="床"
          value={room.floorHue}
          onChange={(v) => setRoomHue(target, room.wallHue, v)}
        />
      </div>

      {addMenuOpen && (
        <AddMenu
          groups={groups}
          biasGroupIds={biasGroupIds}
          onAdd={handleAdd}
          onClose={() => setAddMenuOpen(false)}
          roomTitle={roomTitle}
        />
      )}
    </div>
  );
}

function ItemView({
  item,
  group,
  selected,
  onSelect,
  onWall,
}: {
  item: RoomItem;
  group?: Group;
  selected: boolean;
  onSelect: () => void;
  onWall?: boolean;
}) {
  // グリッド座標 → 左%・上%
  const leftPct = (item.x + 0.5) * (100 / GRID_W);
  const topPct = onWall
    ? ((item.y - 4) + 0.5) * 50 // 壁は2段で50%ずつ
    : (item.y + 0.5) * 25;      // 床は4段で25%ずつ
  const size = onWall ? 10 : 14;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${
        selected ? "ring-2 ring-kpink shadow-glow scale-110" : ""
      } transition`}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${size * 3}px`,
        height: `${size * 3}px`,
        background: `linear-gradient(135deg, ${item.colorA}, ${item.colorB})`,
        boxShadow:
          item.kind === "lamp"
            ? `0 0 18px ${item.colorA}`
            : "0 2px 8px rgba(0,0,0,0.6)",
      }}
      aria-label={`${ITEM_LABELS[item.kind]} ${item.x},${item.y}`}
    >
      <div className="text-xl drop-shadow-sm">{ITEM_EMOJI[item.kind]}</div>
      {item.kind === "poster" && group && (
        <div className="absolute -bottom-3 text-[8px] px-1 py-[1px] rounded bg-black/75 truncate max-w-[3.5rem]">
          {group.name}
        </div>
      )}
    </button>
  );
}

function HuePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs bg-white/5 rounded-full px-3 py-1.5">
      <span className="opacity-75">{label}</span>
      <input
        type="range"
        min={0}
        max={360}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-kpink"
      />
      <span
        className="w-4 h-4 rounded-full border border-white/30"
        style={{ background: `hsl(${value}, 60%, 45%)` }}
      />
    </label>
  );
}

function AddMenu({
  groups,
  biasGroupIds,
  onAdd,
  onClose,
  roomTitle,
}: {
  groups: Group[];
  biasGroupIds: string[];
  onAdd: (k: RoomItemKind, groupId?: string) => void;
  onClose: () => void;
  roomTitle: string;
}) {
  const biasGroups = useMemo(
    () => groups.filter((g) => biasGroupIds.includes(g.id)),
    [groups, biasGroupIds]
  );
  const others = useMemo(
    () => groups.filter((g) => !biasGroupIds.includes(g.id)).slice(0, 6),
    [groups, biasGroupIds]
  );

  const KINDS: RoomItemKind[] = [
    "plant",
    "sofa",
    "desk",
    "lamp",
    "rug",
    "shelf",
    "tv",
    "bed",
    "trophy",
  ];

  return (
    <div className="fixed inset-0 z-[800] bg-black/80 backdrop-blur flex items-end sm:items-center justify-center px-3 pb-3">
      <div className="w-full sm:max-w-md bg-kpanel rounded-2xl border border-white/10 p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold">{roomTitle} にアイテムを追加</div>
          <button onClick={onClose} className="chip !text-xs">閉じる</button>
        </div>

        <div className="text-[11px] opacity-70 mt-2">家具 / 装飾</div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => onAdd(k)}
              className="card !p-2 text-center hover:border-kpink"
            >
              <div className="text-2xl">{ITEM_EMOJI[k]}</div>
              <div className="text-[11px] mt-1">{ITEM_LABELS[k]}</div>
            </button>
          ))}
        </div>

        <div className="text-[11px] opacity-70 mt-4">推しポスター</div>
        {biasGroups.length === 0 && (
          <div className="text-[11px] opacity-50 mt-1">
            まだ推しグループがありません
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {biasGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => onAdd("poster", g.id)}
              className="card !p-2 text-left hover:border-kpink"
              style={{
                background: `linear-gradient(135deg, ${g.colorA}, ${g.colorB})`,
              }}
            >
              <div className="text-xl">🖼️</div>
              <div className="text-[11px] font-bold truncate">{g.name}</div>
            </button>
          ))}
        </div>

        {others.length > 0 && (
          <>
            <div className="text-[11px] opacity-70 mt-3">その他のグループ</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {others.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onAdd("poster", g.id)}
                  className="card !p-2 text-left"
                  style={{
                    background: `linear-gradient(135deg, ${g.colorA}, ${g.colorB})`,
                  }}
                >
                  <div className="text-xl">🖼️</div>
                  <div className="text-[11px] font-bold truncate">{g.name}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

