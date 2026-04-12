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
  dominant?: boolean; // 街の広告を独占するレベル
  concept: string;
  colorA: string;
  colorB: string;
  founded: string;
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
  loanBalance: number;
  bankAccount?: { bank: string; holder: string; last4: string } | null;
  payoutEarnedJpy: number; // ファン課金の20%還元（円換算、表示用）
  // Fan side
  biasGroupIds: string[]; // 最大3
  biasIdolIds: string[]; // 最大5
  inbox: DirectMessage[];
  ownedGoods: Record<string, number>;
  tickets: string[];
  createdAt: string;
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
