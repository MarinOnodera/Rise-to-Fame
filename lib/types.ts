export type Gender = "girls" | "boys";

export type Country =
  | "KR"
  | "JP"
  | "CN"
  | "TH"
  | "VN"
  | "US"
  | "CA"
  | "AU"
  | "FR"
  | "BR"
  | "PH"
  | "ID";

export type PersonalityTrait =
  | "hardworking"
  | "lazy"
  | "shy"
  | "bubbly"
  | "cool"
  | "caring"
  | "mischievous"
  | "perfectionist"
  | "dreamer"
  | "leader"
  | "sassy"
  | "gentle";

export interface FaceSeed {
  // 世界で同じ顔はほぼ無い。数値の組み合わせで一意に決める
  skin: number; // 0..360
  eyeShape: number;
  eyeColor: number;
  hair: number;
  hairColor: number;
  jaw: number;
  lips: number;
  accent: number;
  freckle: boolean;
}

export interface Stats {
  vocal: number; // 0..100
  dance: number;
  rap: number;
  visual: number;
  charm: number;
  stamina: number;
}

export interface Idol {
  id: string;
  name: string;
  stageName: string;
  country: Country;
  age: number;
  gender: Gender;
  groupId?: string;
  personality: PersonalityTrait[];
  // AI性格のためのプロンプト種。倫理フィルタは lib/personality.ts 側
  bioSeed: string;
  face: FaceSeed;
  stats: Stats;
  popularity: number; // 0..100
  fatigue: number; // 0..100
  morale: number; // 0..100
  ownerId?: string; // プロデューサーID（育成側）
  debuted: boolean;
}

export interface Group {
  id: string;
  name: string;
  gender: Gender;
  agencyId?: string; // 空席 = 運営デフォルト
  memberIds: string[];
  popularity: number; // 0..100
  fanCount: number; // 推しファン総数（コンサート開催条件）
  dominant?: boolean; // 街の広告を独占するレベル
  concept: string;
  colorA: string;
  colorB: string;
  founded: string;
  absorbedAt?: string; // 借入未返済で管理側に吸収された日時
}

export type ConcertTier = "local" | "mid" | "large" | "solo";
export interface ConcertTierDef {
  tier: ConcertTier;
  label: string;
  minFans: number;
  cost: number;
  popGain: number;
  fatigue: number;
  baseRevenueCoins: number;
}

export interface ConcertRecord {
  id: string;
  groupId: string;
  tier: ConcertTier;
  heldAt: string;
  attendance: number;
  revenueCoins: number;
}

export type AdKind =
  | "cosmetic"
  | "food"
  | "drink"
  | "tech"
  | "fashion"
  | "cafe"
  | "variety"
  | "pet";

export interface CityAd {
  id: string;
  kind: AdKind;
  brand: string;
  product: string;
  tagline?: string;
  // 広告モデル（アイドル）。あればクリックで推し追加フローに繋がる。
  endorserIdolId?: string;
  // 建物上の配置。横位置0..1、高さレベル(billboard/shop)
  x: number;
  placement: "billboard" | "shop" | "bus";
  colorA: string;
  colorB: string;
  // プロデューサーが購入した広告スロット
  ownerAgencyId?: string;
  promoteGroupId?: string; // プロデュース側が宣伝したいグループ
  expiresAt?: string; // 掲載期限 ISO
  empty?: boolean; // 空きスロット（購入可能）
}

export interface BankAccount {
  bankName: string;
  branchNumber: string; // 支店番号（3桁）
  accountType: "普通" | "当座";
  accountNumber: string; // 口座番号（通常7桁）
  accountHolder: string; // 口座名義（カタカナ想定）
}

export interface Loan {
  id: string;
  offerId: string;
  principal: number;
  remaining: number;
  takenAt: string; // ISO
  dueAt: string; // ISO。期日までに未返済→管理側に1グループ吸収
}

export type UserMode = "fan" | "producer" | null;

export interface UserProfile {
  nickname: string;
  mode: UserMode;
  coins: number;
  lastLoginAt: string; // ISO
  streak: number;
  // Producer side
  agencyName?: string;
  agencyId?: string;
  loans: Loan[];
  bankAccount?: BankAccount | null;
  payoutEarnedJpy: number;
  payoutRequestedJpy: number;
  payoutPaidJpy: number;
  concerts: ConcertRecord[];
  tutorialDone: boolean;
  // 努力値: 契約成功率等に影響（トレーニング/マーケ/コンサートでインクリメント）
  effort: number;
  lastEffortDecayAt: string; // ISO, 自然減衰判定用
  // Fan side
  biasGroupIds: string[]; // 最大3
  biasIdolIds: string[]; // 最大5
  inbox: DirectMessage[];
  ownedGoods: Record<string, number>;
  tickets: string[];
  giftsSent: GiftRecord[];
  createdAt: string;
}

export interface GiftItem {
  id: string;
  level: number; // 1..10
  name: string;
  emoji: string;
  coins: number;
  popGain: number; // 推しの人気上昇
  color: string;
}

export interface GiftRecord {
  id: string;
  giftId: string;
  idolId: string;
  groupId?: string;
  at: string;
  coins: number;
}

export interface DirectMessage {
  id: string;
  fromIdolId: string;
  at: string;
  text: string;
  read: boolean;
}

export interface AuditionCandidate extends Idol {
  auditionScore: number;
  cost: number;
}
