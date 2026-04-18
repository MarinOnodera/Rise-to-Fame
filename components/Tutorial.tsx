"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";

const STEPS: Array<{ emoji: string; title: string; body: string }> = [
  {
    emoji: "🌆",
    title: "ようこそ MarinLuna へ",
    body: "Seoul の街を歩きながら、推しアイドルを見つけたり、自分の事務所を立ち上げたりできます。",
  },
  {
    emoji: "💖",
    title: "ファンモード",
    body: "最大3グループ・5人まで推せます。毎日AIが書くDMが届き、グッズやチケットを買って応援できます。贈り物も10段階！",
  },
  {
    emoji: "🎬",
    title: "プロデューサーモード",
    body: "事務所を設立し、オーディション/スカウトでアイドルを契約。ハンコ演出で契約成立！育成→グループ結成→デビュー。",
  },
  {
    emoji: "🎪",
    title: "コンサート & 広告",
    body: "ファン数に応じて4段階のコンサートを開催できます (50/500/1000/5000人)。街の広告スロットも購入可能。",
  },
  {
    emoji: "♦",
    title: "コインとお金",
    body: "コインはApp Storeで購入。ファン課金の20%は所属事務所に還元され、登録した銀行口座へ振込されます（プロトタイプは模擬）。",
  },
  {
    emoji: "🪞",
    title: "最後にアバターを作ろう",
    body: "写真からAIで自動生成するか、ヘア/衣装/アクセサリー/背景を組み合わせて、LAの街で遊ぶ「あなた」の姿を決めましょう。",
  },
];

export function Tutorial({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const router = useRouter();
  const { user } = useGame();
  const [step, setStep] = useState(0);
  if (!user || user.tutorialDone) return null;

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function finish(goAvatar: boolean) {
    onFinish();
    if (goAvatar && !user?.avatar) {
      router.push("/avatar");
    }
  }

  return (
    <div className="fixed inset-0 z-[700] bg-black/85 backdrop-blur flex items-center justify-center px-4">
      <div className="w-[min(92vw,380px)] bg-kpanel rounded-3xl p-6 border border-white/10">
        <div className="text-5xl text-center">{s.emoji}</div>
        <div className="text-lg font-black text-center mt-2">{s.title}</div>
        <div className="text-sm opacity-80 mt-3 leading-6">{s.body}</div>

        <div className="flex justify-center gap-1 mt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-6 rounded-full ${
                i === step ? "bg-kpink" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={() => finish(false)}>
            スキップ
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => {
              if (last) finish(true);
              else setStep(step + 1);
            }}
          >
            {last ? "アバターを作る" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
