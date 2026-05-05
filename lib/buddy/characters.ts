import type { BuddyCharacter } from "./types";

// 5 体の見た目はユーザー提供画像をそのまま使う。
// /public/buddy/buddy-{1..5}.png に配置する想定 (READMEに案内)。
// 画像が無い環境でも壊れないよう、CSS フォールバック用の色も持たせる。
export const BUDDY_CHARACTERS: BuddyCharacter[] = [
  {
    id: "momo",
    name: "モモ",
    imageSrc: "/buddy/buddy-1.png",
    vibe: "ピンク色の小さなまんまる。やさしく、きみの話をたっぷり聞いてくれる。",
    accent: "#ff8ab8",
    bgClass: "from-pink-100 via-rose-100 to-pink-50",
    fallbackA: "#ffd1e0",
    fallbackB: "#ff9ec2",
    firstPerson: "わたし",
    speechSample: "そっか、〜なんだね。きょうもえらいよ。",
  },
  {
    id: "sora",
    name: "ソラ",
    imageSrc: "/buddy/buddy-2.png",
    vibe: "水色と紫のふわふわ。少しだけドキドキ屋。きらきらした目で耳をかたむける。",
    accent: "#7aa8ff",
    bgClass: "from-sky-100 via-violet-100 to-pink-50",
    fallbackA: "#cfd8ff",
    fallbackB: "#a4b8ff",
    firstPerson: "ぼく",
    speechSample: "うんうん、それで…？もうすこしきかせて。",
  },
  {
    id: "peche",
    name: "ペシュ",
    imageSrc: "/buddy/buddy-3.png",
    vibe: "薄ピンクのまるい子。のんびり屋でおっとり。心の重さを軽くしてくれる。",
    accent: "#ffa6a0",
    bgClass: "from-orange-50 via-pink-100 to-rose-100",
    fallbackA: "#ffe0d8",
    fallbackB: "#ffb5a8",
    firstPerson: "ぼく",
    speechSample: "ふぅ。ちょっとひとやすみ、しよっか。",
  },
  {
    id: "lumi",
    name: "ルミ",
    imageSrc: "/buddy/buddy-4.png",
    vibe: "ラベンダー色のおおきな目。ちょっぴり物思いがち。気持ちの整理がじょうず。",
    accent: "#a48fff",
    bgClass: "from-purple-100 via-indigo-50 to-rose-50",
    fallbackA: "#e3d8ff",
    fallbackB: "#b9a8ff",
    firstPerson: "わたし",
    speechSample: "そのきもち、ちゃんと本物だよ。",
  },
  {
    id: "yuki",
    name: "ユキ",
    imageSrc: "/buddy/buddy-5.png",
    vibe: "まっしろもこもこ。あったかくて、抱きしめると安心する。話を急かさない。",
    accent: "#ffd6dc",
    bgClass: "from-white via-rose-50 to-pink-50",
    fallbackA: "#ffffff",
    fallbackB: "#ffe6ec",
    firstPerson: "ぼく",
    speechSample: "ゆっくりでいいよ。ことばがなくてもいい。",
  },
];

export function getCharacter(id: string | null | undefined): BuddyCharacter | null {
  if (!id) return null;
  return BUDDY_CHARACTERS.find((c) => c.id === id) ?? null;
}
