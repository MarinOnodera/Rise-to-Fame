// コイン・課金・還元ロジック
// 注: 実決済や実銀行振込はこのプロトタイプに含まれない。課金は「模擬」。

export const COIN_PRICES = [
  { id: "p500", coins: 500, jpy: 120 },
  { id: "p1200", coins: 1200, jpy: 250 },
  { id: "p3500", coins: 3500, jpy: 720 },
  { id: "p8000", coins: 8000, jpy: 1500 },
  { id: "p20000", coins: 20000, jpy: 3500 },
];

export const MARKETING_OPTIONS = [
  {
    id: "street",
    name: "路上ライブ",
    cost: 100,
    popGain: 2,
    fatigue: 10,
    desc: "売れない頃の原点。小さいけど確実に熱を作る。",
  },
  {
    id: "sns",
    name: "SNSショート投稿",
    cost: 300,
    popGain: 5,
    fatigue: 3,
    desc: "TikTok的な切り抜きを投稿。刺されば爆発。",
  },
  {
    id: "subway",
    name: "駅広告（小）",
    cost: 1200,
    popGain: 12,
    fatigue: 2,
    desc: "ファンの応援広告風。街に名前が刻まれる。",
  },
  {
    id: "billboard",
    name: "ビルボード（大）",
    cost: 4800,
    popGain: 30,
    fatigue: 2,
    desc: "圧倒的露出。事務所の格が変わる。",
  },
  {
    id: "variety",
    name: "バラエティ出演",
    cost: 2000,
    popGain: 18,
    fatigue: 12,
    desc: "人柄が伝わる。性格が合う子ほど刺さる。",
  },
  {
    id: "mv",
    name: "MV制作",
    cost: 6500,
    popGain: 40,
    fatigue: 15,
    desc: "勝負のコンテンツ。スタッツと噛み合うと跳ねる。",
  },
];

export const SHOP_GOODS = [
  { id: "lightstick", name: "公式ペンライト", coins: 2400 },
  { id: "album", name: "アルバム（初回盤）", coins: 900 },
  { id: "photocard", name: "ランダムフォトカード", coins: 300 },
  { id: "poster", name: "A2ポスター", coins: 500 },
  { id: "tshirt", name: "ツアーTシャツ", coins: 1800 },
];

export const TICKET_TIERS = [
  { id: "t_vip", name: "VIP席", coins: 9800 },
  { id: "t_ss", name: "SS席", coins: 5800 },
  { id: "t_std", name: "スタンド", coins: 2800 },
];

export const LOAN_OFFERS = [
  { id: "bank_s", name: "アプリ内銀行 S", amount: 2000, weeklyFee: 40 },
  { id: "bank_m", name: "アプリ内銀行 M", amount: 8000, weeklyFee: 160 },
  { id: "vc", name: "投資家 (VC)", amount: 30000, weeklyFee: 900 },
];

// ファン課金→プロデューサー還元は20%
export const PRODUCER_SHARE = 0.2;
// コイン→日本円換算（表示用。レート: 1 JPY ≒ 4.16 coins 相当）
export function coinsToJpy(coins: number) {
  return Math.floor(coins / 4.16);
}
