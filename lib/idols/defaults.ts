import type { CityAd, Group, Idol } from "../types";
import { generateIdol } from "./generator";

// 管理側＝運営が初期投入する5グループ
// ガールズ3、ボーイズ2、そのうち2グループを「圧倒的（dominant）」に設定
export function buildDefaultWorld(): {
  groups: Group[];
  idols: Idol[];
  ads: CityAd[];
} {
  const groups: Group[] = [];
  const idols: Idol[] = [];

  const specs: Array<{
    id: string;
    name: string;
    gender: "girls" | "boys";
    dominant: boolean;
    concept: string;
    colorA: string;
    colorB: string;
    size: number;
  }> = [
    {
      id: "grp_violette",
      name: "VIOLETTE",
      gender: "girls",
      dominant: true,
      concept: "Dark Fairy Pop",
      colorA: "#7b2cff",
      colorB: "#ff3d8b",
      size: 5,
    },
    {
      id: "grp_sugarush",
      name: "SugaRush",
      gender: "girls",
      dominant: false,
      concept: "Bubble Y2K",
      colorA: "#ff8ecb",
      colorB: "#ffd166",
      size: 4,
    },
    {
      id: "grp_noir",
      name: "NOIR★KISS",
      gender: "girls",
      dominant: false,
      concept: "Cinematic R&B",
      colorA: "#1c0033",
      colorB: "#ff3d8b",
      size: 4,
    },
    {
      id: "grp_rogue",
      name: "ROGUE9",
      gender: "boys",
      dominant: true,
      concept: "Cyber Hiphop",
      colorA: "#00e5ff",
      colorB: "#7b2cff",
      size: 7,
    },
    {
      id: "grp_helios",
      name: "HELIOS",
      gender: "boys",
      dominant: false,
      concept: "Warm Stadium Pop",
      colorA: "#ffa94d",
      colorB: "#ff3d8b",
      size: 5,
    },
  ];

  for (const s of specs) {
    const members: string[] = [];
    for (let i = 0; i < s.size; i++) {
      const idol = generateIdol({
        gender: s.gender,
        seed: `${s.id}-${i}`,
        boost: s.dominant ? 20 : 8,
        debuted: true,
      });
      idol.groupId = s.id;
      idol.popularity = s.dominant ? 70 + Math.floor(Math.random() * 25) : 45 + Math.floor(Math.random() * 30);
      members.push(idol.id);
      idols.push(idol);
    }
    groups.push({
      id: s.id,
      name: s.name,
      gender: s.gender,
      memberIds: members,
      popularity: s.dominant ? 92 : 60 + Math.floor(Math.random() * 20),
      dominant: s.dominant,
      concept: s.concept,
      colorA: s.colorA,
      colorB: s.colorB,
      founded: "2024",
    });
  }

  // 街の広告: ガンナムの街並みを想定した商品広告。
  // 一部アイドルが広告モデル (endorserIdolId) を担当。
  const popularIdols = [...idols].sort((a, b) => b.popularity - a.popularity);
  const pick = (n: number) => popularIdols[n % popularIdols.length];

  const ads: CityAd[] = [
    // ==== BILLBOARD（ビル上部の大看板） ====
    {
      id: "ad_cos_violet",
      kind: "cosmetic",
      brand: "LUNE",
      product: "ベルベットティント No.07",
      tagline: "唇だけで、語れ。",
      endorserIdolId: pick(0).id,
      x: 0.08,
      placement: "billboard",
      colorA: "#2a0a1f",
      colorB: "#ff3d8b",
    },
    {
      id: "ad_tech_galaxy",
      kind: "tech",
      brand: "NEOFOLD",
      product: "Z7 スマートフォン",
      tagline: "折りたたむ、未来。",
      endorserIdolId: pick(1).id,
      x: 0.42,
      placement: "billboard",
      colorA: "#0b0620",
      colorB: "#00e5ff",
    },
    {
      id: "ad_fashion_atelier",
      kind: "fashion",
      brand: "ATELIER SEOUL",
      product: "Spring Couture '26",
      tagline: "街を歩くランウェイ。",
      endorserIdolId: pick(2).id,
      x: 0.76,
      placement: "billboard",
      colorA: "#1d1d1d",
      colorB: "#d4af37",
    },
    // ==== SHOP（路面店の店頭広告） ====
    {
      id: "ad_cafe_cloud",
      kind: "cafe",
      brand: "CLOUD NINE",
      product: "ストロベリーラテ",
      tagline: "雲にのまれて。",
      endorserIdolId: pick(3).id,
      x: 0.18,
      placement: "shop",
      colorA: "#ffb3d1",
      colorB: "#fff0b3",
    },
    {
      id: "ad_food_kimchi",
      kind: "food",
      brand: "HOT POT 24",
      product: "キムチチゲ定食",
      tagline: "深夜まで、熱く。",
      endorserIdolId: pick(4).id,
      x: 0.52,
      placement: "shop",
      colorA: "#ff4e2b",
      colorB: "#ffd166",
    },
    {
      id: "ad_drink_soda",
      kind: "drink",
      brand: "PICO SODA",
      product: "ピーチ×レモン",
      tagline: "ひとくち、夏。",
      endorserIdolId: pick(5).id,
      x: 0.84,
      placement: "shop",
      colorA: "#ff8ecb",
      colorB: "#8ecae6",
    },
    // ==== BUS（街のバス広告） ====
    {
      id: "ad_cafe_nyan",
      kind: "pet",
      brand: "Mochi Cat Café",
      product: "新店OPEN",
      tagline: "猫 × 抹茶パフェ",
      x: 0.3,
      placement: "bus",
      colorA: "#ffd166",
      colorB: "#ff8ecb",
    },
    {
      id: "ad_variety_ken",
      kind: "variety",
      brand: "MBC",
      product: "Late Night with Ken",
      tagline: "毎週金曜 深夜1時",
      x: 0.7,
      placement: "bus",
      colorA: "#7b2cff",
      colorB: "#ff3d8b",
    },
  ];

  return { groups, idols, ads };
}
