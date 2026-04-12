"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolFace } from "@/components/IdolFace";

export default function MessagesPage() {
  const router = useRouter();
  const { user, idols, markRead, deliverDailyMessages } = useGame();

  useEffect(() => {
    if (!user) router.replace("/");
    else deliverDailyMessages();
  }, [user, router, deliverDailyMessages]);

  if (!user) return null;

  return (
    <main className="pb-24">
      <TopBar title="推しメッセ" back="/home" />
      <div className="p-4">
        {user.inbox.length === 0 && (
          <div className="card text-center opacity-70">
            推しアイドルを設定すると、毎日1通ずつ届きます。
          </div>
        )}
        <div className="flex flex-col gap-3">
          {user.inbox.map((m) => {
            const idol = idols.find((i) => i.id === m.fromIdolId);
            return (
              <div
                key={m.id}
                className="card flex gap-3 items-start"
                onClick={() => markRead(m.id)}
              >
                {idol && <IdolFace face={idol.face} size={48} />}
                <div className="flex-1">
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span>{idol?.stageName ?? "???"}</span>
                    {!m.read && (
                      <span className="chip !bg-kpink !text-white !text-[10px] !py-0">
                        NEW
                      </span>
                    )}
                    <span className="opacity-50">
                      {new Date(m.at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm whitespace-pre-line">
                    {m.text.replace(/^\[.+?\]\n/, "")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
