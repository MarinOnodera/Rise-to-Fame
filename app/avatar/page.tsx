"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { ImagePicker } from "@/components/ImagePicker";
import { BACKGROUND_LABELS, LAStreetScene } from "@/components/LAStreetScene";
import type {
  AvatarAccessory,
  AvatarBackground,
  AvatarCategory,
  AvatarEyes,
  AvatarHair,
  AvatarOutfit,
  AvatarPose,
  UserAvatar,
} from "@/lib/types";
import { id as newId } from "@/lib/rng";

// パーツ選択肢 (カテゴリ単位で定義: 追加も容易)
const OPTIONS: {
  hair: AvatarHair[];
  eyes: AvatarEyes[];
  outfit: AvatarOutfit[];
  accessory: AvatarAccessory[];
  background: AvatarBackground[];
  pose: AvatarPose[];
} = {
  hair: [
    "long-straight","long-wave","bob","ponytail","short-crop","undercut","twin-buns","half-up","mohawk-fade",
  ],
  eyes: ["almond","round","sharp","droopy","cat","wide"],
  outfit: [
    "crop-jacket","oversize-hoodie","neon-mesh","stage-corset","streetwear","holo-puffer","leather-fit","cyber-kimono",
  ],
  accessory: [
    "none","cyber-visor","neon-shades","hologram-earring","choker-led","face-decal","halo-ring",
  ],
  background: [
    "la-sunset-blvd","dtla-neon","venice-boardwalk","hollywood-sign","k-town-night","rooftop-skyline",
  ],
  pose: ["idle","hand-on-hip","peace-sign","walking","mic-stand"],
};

const LABELS: Record<AvatarCategory, string> = {
  hair: "ヘア",
  eyes: "瞳",
  outfit: "衣装",
  accessory: "アクセサリー",
  background: "背景シーン",
  pose: "ポーズ",
};

const PART_LABELS: Record<string, string> = {
  // hair
  "long-straight": "ロング・ストレート",
  "long-wave": "ロング・ウェーブ",
  "bob": "ボブ",
  "ponytail": "ポニーテール",
  "short-crop": "ショート",
  "undercut": "アンダーカット",
  "twin-buns": "ツインお団子",
  "half-up": "ハーフアップ",
  "mohawk-fade": "モヒカン・フェード",
  // eyes
  "almond": "アーモンド",
  "round": "まんまる",
  "sharp": "シャープ",
  "droopy": "たれ目",
  "cat": "キャット",
  "wide": "パッチリ",
  // outfit
  "crop-jacket": "クロップジャケット",
  "oversize-hoodie": "オーバーサイズフーディ",
  "neon-mesh": "ネオンメッシュ",
  "stage-corset": "ステージコルセット",
  "streetwear": "LAストリート",
  "holo-puffer": "ホロ・パファー",
  "leather-fit": "レザーフィット",
  "cyber-kimono": "サイバー着物",
  // accessory
  "none": "なし",
  "cyber-visor": "サイバーバイザー",
  "neon-shades": "ネオンシェード",
  "hologram-earring": "ホロイヤリング",
  "choker-led": "LEDチョーカー",
  "face-decal": "フェイスデカール",
  "halo-ring": "ヘイロー",
  // pose
  "idle": "スタンド",
  "hand-on-hip": "腰手",
  "peace-sign": "ピース",
  "walking": "ウォーク",
  "mic-stand": "マイク",
};

function defaultAvatar(): UserAvatar {
  return {
    id: newId("ava_"),
    source: "manual",
    skinHue: 28,
    hairHue: 280,
    eyeHue: 200,
    lipHue: 340,
    outfitHueA: 320,
    outfitHueB: 260,
    parts: {
      hair: "long-wave",
      eyes: "almond",
      outfit: "crop-jacket",
      accessory: "neon-shades",
      background: "la-sunset-blvd",
      pose: "hand-on-hip",
    },
    createdAt: new Date().toISOString(),
  };
}

export default function AvatarStudioPage() {
  const router = useRouter();
  const { user, setAvatar } = useGame();
  const [draft, setDraft] = useState<UserAvatar>(() => defaultAvatar());
  const [status, setStatus] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [tab, setTab] = useState<AvatarCategory>("hair");

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.avatar) setDraft(user.avatar);
  }, [user, router]);

  const categories: AvatarCategory[] = useMemo(
    () => ["hair", "eyes", "outfit", "accessory", "background", "pose"],
    []
  );

  if (!user) return null;

  function updatePart<K extends AvatarCategory>(
    key: K,
    value: (typeof OPTIONS)[K][number]
  ) {
    setDraft((d) => ({ ...d, parts: { ...d.parts, [key]: value } }));
  }

  async function handlePhoto(dataUrl: string) {
    setAiBusy(true);
    setStatus("AIが写真の雰囲気を読み取り中...");
    try {
      const r = await fetch("/api/avatar-from-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as {
        skinHue: number; hairHue: number; eyeHue: number; lipHue: number;
        outfitHueA: number; outfitHueB: number;
        parts: UserAvatar["parts"];
        vibe?: string;
      };
      const next: UserAvatar = {
        ...draft,
        source: "ai",
        skinHue: j.skinHue,
        hairHue: j.hairHue,
        eyeHue: j.eyeHue,
        lipHue: j.lipHue,
        outfitHueA: j.outfitHueA,
        outfitHueB: j.outfitHueB,
        parts: j.parts,
        vibe: j.vibe,
      };
      setDraft(next);
      setStatus(
        `✓ AI生成完了${j.vibe ? ` — "${j.vibe}"` : ""}。パーツ選択で微調整もできます。`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI生成に失敗しました";
      setStatus(`⚠ ${msg}`);
    } finally {
      setAiBusy(false);
    }
  }

  function save() {
    setAvatar({ ...draft, createdAt: new Date().toISOString() });
    setStatus("✓ 保存しました");
  }

  const currentOptions = OPTIONS[tab];

  return (
    <main className="pb-32">
      <TopBar title="アバター工房" back="/home" />

      <div className="px-4 mt-3">
        {/* ワイドビュー: LA街 × 全身アバター */}
        <LAStreetScene background={draft.parts.background} avatar={draft} />
        {draft.source === "ai" && draft.vibe && (
          <div className="text-[11px] opacity-70 mt-1 italic">
            AIのメモ: {draft.vibe}
          </div>
        )}
      </div>

      {/* AI 生成セクション */}
      <section className="px-4 mt-4 card bg-gradient-to-br from-kpurple/25 to-kpink/20 border-kpink/40">
        <div className="font-bold text-sm">📸 写真からAI生成</div>
        <div className="text-[11px] opacity-75 mt-1 mb-2">
          顔写真やスナップから雰囲気だけを抽出して、K-Pop × LA サイバーパンクの
          ポップイラスト風アバターに変換します。元画像は保存されません。
        </div>
        <ImagePicker
          onPick={(d) => void handlePhoto(d)}
          disabled={aiBusy}
          label={aiBusy ? "生成中..." : "写真を選んで生成"}
        />
        {status && (
          <div className="text-[11px] mt-2 opacity-90">{status}</div>
        )}
      </section>

      {/* カテゴリタブ */}
      <section className="px-4 mt-4">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                tab === c
                  ? "bg-kpink text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {LABELS[c]}
            </button>
          ))}
        </div>

        {/* パーツ選択グリッド */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {currentOptions.map((opt) => {
            const selected = draft.parts[tab] === opt;
            return (
              <button
                key={opt}
                onClick={() => updatePart(tab, opt as never)}
                className={`card !p-2 text-center ${
                  selected
                    ? "!border-kpink ring-2 ring-kpink/60"
                    : "opacity-80"
                }`}
              >
                <div className="text-[11px] font-bold leading-tight">
                  {tab === "background"
                    ? BACKGROUND_LABELS[opt as AvatarBackground]
                    : PART_LABELS[opt] ?? opt}
                </div>
              </button>
            );
          })}
        </div>

        {/* 色相調整 (AI/手動どちらでも微調整できる) */}
        <div className="card mt-4">
          <div className="font-bold text-xs mb-2">カラー微調整</div>
          <HueRow label="肌" value={draft.skinHue} onChange={(v) => setDraft({ ...draft, skinHue: v })} />
          <HueRow label="髪" value={draft.hairHue} onChange={(v) => setDraft({ ...draft, hairHue: v })} />
          <HueRow label="瞳" value={draft.eyeHue} onChange={(v) => setDraft({ ...draft, eyeHue: v })} />
          <HueRow label="リップ" value={draft.lipHue} onChange={(v) => setDraft({ ...draft, lipHue: v })} />
          <HueRow label="衣装A" value={draft.outfitHueA} onChange={(v) => setDraft({ ...draft, outfitHueA: v })} />
          <HueRow label="衣装B" value={draft.outfitHueB} onChange={(v) => setDraft({ ...draft, outfitHueB: v })} />
        </div>
      </section>

      {/* 保存バー */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-kdark/90 backdrop-blur border-t border-white/10">
        <button className="btn-primary w-full" onClick={save}>
          このアバターで保存
        </button>
      </div>
    </main>
  );
}

function HueRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="text-[11px] w-12 opacity-75">{label}</div>
      <input
        type="range"
        min={0}
        max={360}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-kpink"
      />
      <div
        className="w-6 h-6 rounded-full border border-white/20"
        style={{ background: `hsl(${value}, 70%, 55%)` }}
      />
    </div>
  );
}
