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

  // 街の広告: 半分くらいがアイドル、残りは猫・犬・女優・バラエティ
  const ads: CityAd[] = [];
  // dominant グループを強めに露出
  for (const g of groups) {
    const count = g.dominant ? 3 : 1;
    for (let i = 0; i < count; i++) {
      ads.push({
        id: `ad_${g.id}_${i}`,
        kind: "idol",
        groupId: g.id,
        title: `${g.name} — ${g.concept}`,
        colorA: g.colorA,
        colorB: g.colorB,
      });
    }
  }
  ads.push(
    { id: "ad_cat_1", kind: "cat", title: "Mochi Cat Café", colorA: "#ffd166", colorB: "#ff8ecb" },
    { id: "ad_dog_1", kind: "dog", title: "Bark & Roll Park", colorA: "#8ecae6", colorB: "#ffb4a2" },
    { id: "ad_actress_1", kind: "actress", title: "Ha Yujin — Perfume No.9", colorA: "#1d1d1d", colorB: "#d4af37" },
    { id: "ad_variety_1", kind: "variety", title: "Late Night with Ken", colorA: "#ff3d8b", colorB: "#7b2cff" },
    { id: "ad_cat_2", kind: "cat", title: "Neko Neko Ramen", colorA: "#ffbe0b", colorB: "#fb5607" },
  );

  return { groups, idols, ads };
}
