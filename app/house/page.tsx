"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { RoomEditor } from "@/components/RoomEditor";

export default function HousePage() {
  const router = useRouter();
  const { user, groups } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  if (!user) return null;
  // house は registerUser / migrate で必ず設定される想定
  const room = user.house ?? {
    wallHue: 300,
    floorHue: 30,
    items: [],
  };

  return (
    <main className="pb-10">
      <TopBar title={`${user.displayName || user.nickname}のお家`} back="/home" />
      <div className="px-4 mt-3">
        <div className="text-[11px] opacity-70 leading-5">
          家具やポスターを自由に配置して、自分だけのお部屋を作ろう。
          推しグループのポスターを貼ると、その色で壁にディスプレイされるよ。
        </div>
      </div>
      <div className="px-4 mt-4">
        <RoomEditor
          target="house"
          room={room}
          groups={groups}
          biasGroupIds={user.biasGroupIds}
          roomTitle="お家"
        />
      </div>
    </main>
  );
}
