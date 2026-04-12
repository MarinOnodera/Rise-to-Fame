"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { IdolFace } from "@/components/IdolFace";
import { recommendIdols } from "@/lib/recommend";

export default function Discover() {
  const router = useRouter();
  const { user, idols, toggleBiasIdol } = useGame();
  const [phase, setPhase] = useState<"intro" | "thinking" | "result">("intro");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const recs = useMemo(
    () => (user ? recommendIdols(idols, user.biasIdolIds, 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, user?.biasIdolIds.join(","), idols.length]
  );

  if (!user) return null;

  const startThinking = () => {
    setPhase("thinking");
    setTimeout(() => setPhase("result"), 1400);
  };

  return (
    <main className="pb-24">
      <TopBar title="推しアイドルを探しに行く" back="/home" />

      {phase === "intro" && (
        <div className="p-4 flex flex-col gap-4">
          <div
            className="rounded-3xl p-6 text-center"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, #ff3d8b 0%, #7b2cff 50%, #1a0a2a 100%)",
            }}
          >
            <div className="text-4xl">🔮</div>
            <div className="font-display text-xl font-black mt-2">
              あなたの運命の推し、いる。
            </div>
            <div className="text-xs opacity-80 mt-1">
              性格・国・推し傾向から AI が3人セレクト
            </div>
          </div>
          <button className="btn-primary text-lg" onClick={startThinking}>
            ✧ 探しに行く
          </button>
          <div className="text-[11px] opacity-60 text-center">
            ※ 今推しているアイドルの傾向が学習されます
          </div>
        </div>
      )}

      {phase === "thinking" && (
        <div className="p-10 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl animate-pulse">🌀</div>
          <div className="font-bold">AIが街を歩いています…</div>
          <div className="text-xs opacity-70">
            あなたの推し傾向を解析中
          </div>
          <div className="flex gap-1 mt-3">
            <span className="w-2 h-2 bg-kpink rounded-full animate-bounce" />
            <span
              className="w-2 h-2 bg-kpurple rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            />
            <span
              className="w-2 h-2 bg-kgold rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="p-4 flex flex-col gap-3">
          <div className="text-xs opacity-70 px-1">
            ▸ あなたに刺さりそうな3人
          </div>
          {recs.map((r, idx) => (
            <div key={r.idol.id} className="card flex gap-3 items-center">
              <div className="relative">
                <IdolFace face={r.idol.face} size={72} />
                <div className="absolute -top-1 -left-1 chip !bg-kgold !text-black !text-[10px] !font-black !py-0.5 !px-1.5">
                  #{idx + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.idol.stageName}</div>
                <div className="text-[11px] opacity-70 truncate">
                  {r.idol.name} · {r.idol.country}
                </div>
                <div className="text-xs mt-1 opacity-90 italic">
                  “{r.reason}”
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.idol.personality.map((p) => (
                    <span key={p} className="chip !text-[10px] !py-0">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className={`chip !text-xs ${
                  user.biasIdolIds.includes(r.idol.id)
                    ? "!bg-kpink !text-white"
                    : "!bg-white/20"
                }`}
                onClick={() => {
                  const x = toggleBiasIdol(r.idol.id);
                  if (!x.ok && x.reason) alert(x.reason);
                }}
              >
                {user.biasIdolIds.includes(r.idol.id) ? "★" : "☆ 推す"}
              </button>
            </div>
          ))}
          <button
            className="btn-ghost mt-3"
            onClick={() => {
              setRefresh((x) => x + 1);
              startThinking();
            }}
          >
            ↻ もう一度探す
          </button>
        </div>
      )}
    </main>
  );
}
