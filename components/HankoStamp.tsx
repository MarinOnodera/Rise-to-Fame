"use client";

import { useEffect, useState } from "react";

export interface HankoResult {
  success: boolean;
  rate: number;
  name: string;
}

/**
 * 契約成功/失敗のハンコ演出。
 * - 1.8s ほどで自動クローズ
 * - 成功: 赤ハンコが上から降ってきて「契約成功！」
 * - 失敗: ハンコが傾いて斜めに落ち、「契約失敗…」
 */
export function HankoStamp({
  result,
  onClose,
}: {
  result: HankoResult | null;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"hidden" | "drop" | "land" | "done">(
    "hidden"
  );

  useEffect(() => {
    if (!result) {
      setStage("hidden");
      return;
    }
    setStage("drop");
    const t1 = setTimeout(() => setStage("land"), 450);
    const t2 = setTimeout(() => setStage("done"), 2200);
    const t3 = setTimeout(() => onClose(), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [result, onClose]);

  if (!result) return null;

  const ok = result.success;
  const stampColor = ok ? "#d21f1f" : "#6b7280";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => {
        setStage("done");
        onClose();
      }}
    >
      <div className="relative w-[300px] h-[360px] flex items-center justify-center">
        {/* 契約書 */}
        <div
          className="absolute inset-0 rounded-md bg-[#fdf7e6] shadow-2xl"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 26px)",
          }}
        >
          <div className="absolute top-5 left-0 right-0 text-center text-black/80 font-bold tracking-widest">
            専属契約書
          </div>
          <div className="absolute top-14 left-6 right-6 text-[11px] text-black/70 leading-5">
            甲（事務所）と乙（{result.name}）は、専属芸能マネジメント契約を締結する。
            本件契約の成立条件は、当該オーディション/スカウトにおける成功確率
            <span className="font-bold"> {Math.round(result.rate * 100)}% </span>
            を充足することとする。
          </div>
          <div className="absolute bottom-4 right-6 text-[10px] text-black/60">
            {new Date().toLocaleDateString("ja-JP")}
          </div>
        </div>

        {/* ハンコ */}
        <div
          className="absolute"
          style={{
            width: 120,
            height: 120,
            top: stage === "drop" ? -40 : 140,
            left: 140,
            transform:
              stage === "drop"
                ? "rotate(-12deg) scale(1.6)"
                : stage === "land"
                ? ok
                  ? "rotate(-6deg) scale(1)"
                  : "rotate(-28deg) scale(0.95)"
                : "rotate(-6deg) scale(1)",
            transition:
              stage === "land"
                ? "top .22s cubic-bezier(.4,2,.6,1), transform .22s cubic-bezier(.4,2,.6,1)"
                : "top .42s cubic-bezier(.5,.1,.8,.3), transform .42s ease-out",
            filter: stage === "land" ? "none" : "blur(0.5px)",
            opacity: stage === "hidden" ? 0 : 1,
          }}
        >
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-white font-black text-lg border-[6px]"
            style={{
              borderColor: stampColor,
              color: stampColor,
              background: "rgba(255,255,255,0.02)",
              boxShadow: stage === "land" ? `0 0 0 2px ${stampColor}` : "none",
              textShadow: "0 0 2px rgba(0,0,0,0.1)",
              transform: "rotate(0deg)",
            }}
          >
            {ok ? "契 約" : "不 成 立"}
          </div>
        </div>

        {/* ジャッジ */}
        <div
          className={`absolute -bottom-14 left-0 right-0 text-center text-3xl font-black ${
            ok ? "text-kgold" : "text-white/80"
          }`}
          style={{
            opacity: stage === "land" || stage === "done" ? 1 : 0,
            transform:
              stage === "land" || stage === "done"
                ? "scale(1)"
                : "scale(0.8)",
            transition: "opacity .25s .1s, transform .25s .1s",
            textShadow: ok
              ? "0 0 18px rgba(255,209,102,0.6)"
              : "0 0 12px rgba(0,0,0,0.6)",
          }}
        >
          {ok ? "契約成功！" : "契約失敗…"}
          <div className="text-xs opacity-70 font-normal mt-1">
            成功確率 {Math.round(result.rate * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
