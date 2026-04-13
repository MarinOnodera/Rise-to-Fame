// コイン・課金・還元ロジック
// 注: 実決済や実銀行振込はこのプロトタイプに含まれない。課金は「模擬」。

/**
 * Apple IAP 商品。App Store Connect で同じ product_id を consumable で登録する想定。
 * 本番はここの jpy は表示用、実価格は App Store の Price Tier が正。
 */
export interface CoinProduct {
  id: string; // App Store product_id
  coins: number;
  jpy: number;
  tier: string; // Apple Price Tier の目安
}
export const COIN_PRICES: CoinProduct[] = [
  { id: "com.risetofame.coins.p500", coins: 500, jpy: 160, tier: "Tier 1" },
  { id: "com.risetofame.coins.p1200", coins: 1200, jpy: 320, tier: "Tier 2" },
  { id: "com.risetofame.coins.p3500", coins: 3500, jpy: 800, tier: "Tier 5" },
  { id: "com.risetofame.coins.p8000", coins: 8000, jpy: 1600, tier: "Tier 10" },
  { id: "com.risetofame.coins.p20000", coins: 20000, jpy: 3680, tier: "Tier 20" },
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

export interface ShopGood {
  id: string;
  name: string;
  coins: number;
  emoji: string;
  category: "essential" | "collectible" | "fashion" | "living" | "digital";
  desc?: string;
}
export const SHOP_GOODS: ShopGood[] = [
  // Essentials
  { id: "lightstick", name: "公式ペンライト", coins: 2400, emoji: "🔦", category: "essential", desc: "ライブ必携。色替え10パターン" },
  { id: "lightstick_pro", name: "ペンライト Bluetooth版", coins: 3800, emoji: "📶", category: "essential", desc: "会場と連動して一斉点灯" },
  // Collectibles
  { id: "album_std", name: "アルバム（通常盤）", coins: 600, emoji: "💿", category: "collectible" },
  { id: "album_le", name: "アルバム（初回限定盤）", coins: 1200, emoji: "💎", category: "collectible", desc: "特典フォトブック付" },
  { id: "photocard", name: "ランダムフォトカード", coins: 300, emoji: "🃏", category: "collectible", desc: "誰が出るかはお楽しみ" },
  { id: "photocard_box", name: "フォトカードBOX (10枚)", coins: 2400, emoji: "🎴", category: "collectible", desc: "全メンバー当たる保証" },
  { id: "poster", name: "A2ポスター", coins: 500, emoji: "🪧", category: "collectible" },
  { id: "pb", name: "写真集", coins: 3800, emoji: "📔", category: "collectible", desc: "撮り下ろし100ページ" },
  { id: "lomo", name: "ロモカード20枚セット", coins: 900, emoji: "🖼", category: "collectible" },
  { id: "sticker", name: "ホログラムステッカー", coins: 200, emoji: "✨", category: "collectible" },
  // Fashion
  { id: "tshirt", name: "ツアーTシャツ", coins: 1800, emoji: "👕", category: "fashion" },
  { id: "hoodie", name: "ツアーパーカー", coins: 4200, emoji: "🧥", category: "fashion" },
  { id: "cap", name: "オフィシャルキャップ", coins: 1600, emoji: "🧢", category: "fashion" },
  { id: "keyring", name: "アクリルキーホルダー", coins: 600, emoji: "🔑", category: "fashion" },
  // Living
  { id: "mug", name: "マグカップ", coins: 900, emoji: "☕", category: "living" },
  { id: "towel", name: "ライブタオル", coins: 1400, emoji: "🏳", category: "living" },
  { id: "plush", name: "メンバーぬいぐるみ", coins: 2600, emoji: "🧸", category: "living" },
  { id: "slipmat", name: "公式スリップマット", coins: 1800, emoji: "🎛", category: "living" },
  // Digital
  { id: "dl_single", name: "デジタルシングルDL", coins: 350, emoji: "🎵", category: "digital" },
  { id: "bubble", name: "推しバブル1ヶ月権", coins: 700, emoji: "💬", category: "digital", desc: "DMの返信頻度アップ" },
  { id: "video_call", name: "プレミアム動画通話券", coins: 12000, emoji: "📞", category: "digital", desc: "1分間プレミアム動画応援" },
  { id: "fanmeeting", name: "オンラインFM入場権", coins: 5200, emoji: "🎥", category: "digital" },
];

export const TICKET_TIERS = [
  { id: "t_vip", name: "VIP席", coins: 9800 },
  { id: "t_ss", name: "SS席", coins: 5800 },
  { id: "t_std", name: "スタンド", coins: 2800 },
];

/**
 * 借入オファー。返済は全部アプリ内コイン。
 * 期日までに未返済 → 事務所所有の最人気グループを管理側（運営）に吸収。
 */
export const LOAN_OFFERS = [
  { id: "bank_s", name: "アプリ内銀行 S", amount: 2000, totalDue: 2400, dueDays: 7 },
  { id: "bank_m", name: "アプリ内銀行 M", amount: 8000, totalDue: 9600, dueDays: 14 },
  { id: "vc", name: "投資家 (VC)", amount: 30000, totalDue: 36000, dueDays: 21 },
];

/**
 * コンサート4段階。推しファン最低ラインを満たしたグループのみ開催可能。
 */
import type { ConcertTierDef } from "./types";
export const CONCERT_TIERS: ConcertTierDef[] = [
  {
    tier: "local",
    label: "地域イベント",
    minFans: 50,
    cost: 300,
    popGain: 3,
    fatigue: 8,
    baseRevenueCoins: 500,
  },
  {
    tier: "mid",
    label: "中規模ライブ",
    minFans: 500,
    cost: 2000,
    popGain: 10,
    fatigue: 14,
    baseRevenueCoins: 3500,
  },
  {
    tier: "large",
    label: "大規模コンサート",
    minFans: 1000,
    cost: 6000,
    popGain: 22,
    fatigue: 22,
    baseRevenueCoins: 10000,
  },
  {
    tier: "solo",
    label: "単独公演",
    minFans: 5000,
    cost: 18000,
    popGain: 40,
    fatigue: 30,
    baseRevenueCoins: 36000,
  },
];

/**
 * 街の広告スロットの購入料金。
 */
export const AD_SLOT_PRICES = {
  billboard: 5000, // ビル上大看板
  shop: 1800, // 路面店
  bus: 800, // バス
} as const;
export const AD_DURATION_DAYS = 7;

/**
 * 投げ銭/プレゼント10段階。いつでも推しアイドルに贈れる。
 * 贈ると推しの人気が上昇し、所属事務所に20%還元される。
 */
import type { GiftItem } from "./types";
export const GIFTS: GiftItem[] = [
  { id: "g1_heart",   level: 1,  name: "ハート",           emoji: "♥",   coins: 10,    popGain: 1,  color: "#ff3d8b" },
  { id: "g2_rose",    level: 2,  name: "バラ",             emoji: "🌹",  coins: 50,    popGain: 2,  color: "#ff2e63" },
  { id: "g3_cake",    level: 3,  name: "バースデーケーキ", emoji: "🎂",  coins: 120,   popGain: 3,  color: "#ffb4a2" },
  { id: "g4_gift",    level: 4,  name: "ギフトボックス",   emoji: "🎁",  coins: 300,   popGain: 5,  color: "#7b2cff" },
  { id: "g5_bear",    level: 5,  name: "巨大ぬいぐるみ",   emoji: "🧸",  coins: 700,   popGain: 8,  color: "#c98b6b" },
  { id: "g6_bouquet", level: 6,  name: "豪華花束",         emoji: "💐",  coins: 1500,  popGain: 12, color: "#ff8ecb" },
  { id: "g7_bag",     level: 7,  name: "ブランドバッグ",   emoji: "👜",  coins: 4000,  popGain: 20, color: "#d4af37" },
  { id: "g8_ring",    level: 8,  name: "ダイヤリング",     emoji: "💍",  coins: 9000,  popGain: 30, color: "#00e5ff" },
  { id: "g9_car",     level: 9,  name: "スポーツカー",     emoji: "🚗",  coins: 25000, popGain: 50, color: "#ff3d8b" },
  { id: "g10_castle", level: 10, name: "マイホーム",       emoji: "🏰",  coins: 80000, popGain: 90, color: "#ffd166" },
];

// ファン課金→プロデューサー還元は20%
export const PRODUCER_SHARE = 0.2;
// コイン→日本円換算（表示用。レート: 1 JPY ≒ 4.16 coins 相当）
export function coinsToJpy(coins: number) {
  return Math.floor(coins / 4.16);
}
