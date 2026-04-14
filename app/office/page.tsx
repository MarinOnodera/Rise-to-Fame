"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame, OFFICE_UPGRADE_REQS } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { RoomEditor } from "@/components/RoomEditor";

const LEVEL_NAME: Record<number, string> = {
  1: "自室の一角",
  2: "小規模事務所",
  3: "大型事務所",
};

export default function OfficePage() {
  const router = useRouter();
  const { user, groups, upgradeOffice } = useGame();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  if (!user) return null;
  const level = (user.officeLevel ?? 1);
  const room = user.office ?? {
    wallHue: 270,
    floorHue: 240,
    items: [],
  };
  const nextLevel = level < 3 ? level + 1 : null;
  const nextReq = nextLevel
    ? OFFICE_UPGRADE_REQS[nextLevel as 2 | 3]
    : null;

  function handleUpgrade() {
    const r = upgradeOffice();
    if (r.ok) {
      setMsg(`✨ 事務所が ${LEVEL_NAME[r.newLevel ?? level]} にアップグレードされました！`);
    } else {
      setMsg(`⚠ ${r.reason}`);
    }
  }

  return (
    <main className="pb-10">
      <TopBar
        title={`${user.agencyName || "My Office"} · Lv.${level}`}
        back="/home"
      />
      <div className="px-4 mt-3">
        <div className="card flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] opacity-70">現在のランク</div>
            <div className="font-bold">{LEVEL_NAME[level]}</div>
            {nextReq && (
              <div className="text-[11px] opacity-70 mt-1">
                次: {LEVEL_NAME[nextLevel!]} ({nextReq.description})<br />
                コスト: ♦ {nextReq.cost.toLocaleString()}
              </div>
            )}
          </div>
          {nextLevel && (
            <button
              className="btn-primary text-sm whitespace-nowrap"
              onClick={handleUpgrade}
            >
              ▲ ランクアップ
            </button>
          )}
        </div>
        {msg && (
          <div className="text-[12px] mt-2 bg-white/5 rounded-lg px-3 py-2">
            {msg}
          </div>
        )}
      </div>

      <div className="px-4 mt-4">
        <RoomEditor
          target="office"
          room={room}
          groups={groups}
          biasGroupIds={user.biasGroupIds}
          roomTitle="事務所"
        />
      </div>
    </main>
  );
}
