"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import type { UserAvatar } from "@/lib/types";
import { id as newId } from "@/lib/rng";
import {
  AVATAR_PRESETS,
  getPresetsByGender,
  type AvatarPreset,
} from "@/lib/avatar-presets";
import { UserAvatarFigure } from "@/components/UserAvatarFigure";

type GenderChoice = "male" | "female";
type Step = "gender" | "pick";

export default function AvatarStudioPage() {
  const router = useRouter();
  const { user, setAvatar } = useGame();
  const [step, setStep] = useState<Step>("gender");
  const [gender, setGender] = useState<GenderChoice>("female");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.avatar?.presetId) {
      const preset = AVATAR_PRESETS.find((p) => p.id === user.avatar!.presetId);
      if (preset) {
        setGender(preset.gender);
        setSelected(preset.id);
        setStep("pick");
      }
    }
  }, [user, router]);

  if (!user) return null;

  function chooseGender(g: GenderChoice) {
    setGender(g);
    setSelected(null);
    setStep("pick");
  }

  function save() {
    if (!selected) return;
    const preset = AVATAR_PRESETS.find((p) => p.id === selected);
    if (!preset) return;
    const avatar: UserAvatar = {
      ...preset.avatar,
      id: user!.avatar?.id ?? newId("ava_"),
      createdAt: new Date().toISOString(),
    };
    setAvatar(avatar);
    setStatus("✓ 保存しました");
    if (!user?.avatar) {
      setTimeout(() => router.replace("/home"), 600);
    } else {
      setTimeout(() => setStatus(null), 1500);
    }
  }

  const presets = getPresetsByGender(gender);

  return (
    <main className="pb-32">
      <TopBar
        title="アバター選択"
        back={step === "pick" ? undefined : "/home"}
      />

      {step === "gender" && (
        <section className="px-4 mt-6">
          <h2 className="text-center text-lg font-bold mb-1">
            アバターの性別を選んでね
          </h2>
          <p className="text-center text-xs opacity-60 mb-6">
            あとからいつでも変更できます
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => chooseGender("female")}
              className="card !p-5 flex flex-col items-center gap-2 w-36 hover:!border-kpink transition-colors"
            >
              <span className="text-5xl">👧</span>
              <span className="font-bold text-sm">女の子</span>
            </button>
            <button
              onClick={() => chooseGender("male")}
              className="card !p-5 flex flex-col items-center gap-2 w-36 hover:!border-kpink transition-colors"
            >
              <span className="text-5xl">👦</span>
              <span className="font-bold text-sm">男の子</span>
            </button>
          </div>
        </section>
      )}

      {step === "pick" && (
        <section className="px-4 mt-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setStep("gender")}
              className="text-xs text-kpink font-bold"
            >
              ← 性別を変える
            </button>
            <span className="text-xs opacity-60">
              {gender === "female" ? "👧 女の子" : "👦 男の子"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={selected === preset.id}
                onSelect={() => setSelected(preset.id)}
              />
            ))}
          </div>

          {status && (
            <div className="text-center text-sm mt-3 text-kpink font-bold">
              {status}
            </div>
          )}
        </section>
      )}

      {step === "pick" && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-kdark/90 backdrop-blur border-t border-white/10">
          <button
            className="btn-primary w-full disabled:opacity-40"
            disabled={!selected}
            onClick={save}
          >
            このアバターに決定！
          </button>
        </div>
      )}
    </main>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: AvatarPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const previewAvatar: UserAvatar = {
    ...preset.avatar,
    id: "preview",
    createdAt: "",
  };

  return (
    <button
      onClick={onSelect}
      className={`card !p-3 text-center transition-all ${
        selected
          ? "!border-kpink ring-2 ring-kpink/60 scale-[1.02]"
          : "opacity-85 hover:opacity-100"
      }`}
    >
      <div className="w-full aspect-[3/4] flex items-center justify-center mb-2">
        <UserAvatarFigure avatar={previewAvatar} height={140} />
      </div>
      <div className="font-bold text-sm">{preset.label}</div>
      <div className="text-[10px] opacity-60 leading-snug mt-0.5">
        {preset.description}
      </div>
    </button>
  );
}
