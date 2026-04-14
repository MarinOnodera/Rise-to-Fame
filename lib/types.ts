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
  displayName: string; // 推しが呼んでくれる名前。言語自由（ユーザー本名/あだ名）
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
  // ユーザー自身のアバター (LA街で遊ぶ自分)。未設定なら null。
  avatar?: UserAvatar | null;
  // 拠点: 自分の家 (常時所持) / 事務所 (段階的にアップグレード)
  house?: RoomState;
  office?: RoomState;
  officeLevel?: OfficeLevel; // 1=自室の一角, 2=小規模事務所, 3=大事務所
}

// ====== 拠点 (家 / 事務所) ======

export type OfficeLevel = 1 | 2 | 3;

export type RoomItemKind =
  | "poster"   // 推しポスター (groupId 紐付け可)
  | "plant"    // 観葉植物
  | "sofa"
  | "desk"
  | "lamp"    // ネオンランプ (発光)
  | "rug"
  | "shelf"
  | "tv"
  | "bed"
  | "trophy";  // デビュー記念トロフィー

export interface RoomItem {
  id: string;
  kind: RoomItemKind;
  x: number; // グリッド 0..7
  y: number; // グリッド 0..5
  // poster の場合に紐付くグループ (なければ単色ポスター)
  groupId?: string;
  colorA: string;
  colorB: string;
}

export interface RoomState {
  wallHue: number;   // 0..360
  floorHue: number;  // 0..360
  items: RoomItem[];
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

// ====== ユーザーアバター (LAサイバーパンク街で遊ぶ自分) ======
// 既存の FaceSeed/Idol 系は壊さず、ユーザー向けは別系統として追加する。

export type AvatarCategory =
  | "hair"
  | "eyes"
  | "outfit"
  | "accessory"
  | "background"
  | "pose";

// 各パーツカテゴリが取りうる値 (文字列IDの一覧)。
// SVG レンダラー側で enum を解釈して合成する。
export type AvatarHair =
  | "long-straight"
  | "long-wave"
  | "bob"
  | "ponytail"
  | "short-crop"
  | "undercut"
  | "twin-buns"
  | "half-up"
  | "mohawk-fade";

export type AvatarEyes =
  | "almond"
  | "round"
  | "sharp"
  | "droopy"
  | "cat"
  | "wide";

export type AvatarOutfit =
  | "crop-jacket"
  | "oversize-hoodie"
  | "neon-mesh"
  | "stage-corset"
  | "streetwear"
  | "holo-puffer"
  | "leather-fit"
  | "cyber-kimono";

// ★ 新規カテゴリ: アクセサリー (アイウェア / イヤリング / チョーカー 等)
export type AvatarAccessory =
  | "none"
  | "cyber-visor"
  | "neon-shades"
  | "hologram-earring"
  | "choker-led"
  | "face-decal"
  | "halo-ring";

// ★ 新規カテゴリ: 背景シーン (LA × K-Pop × サイバーパンク)
export type AvatarBackground =
  | "la-sunset-blvd"   // 夕焼けのSunset Blvd。椰子並木、開放感
  | "dtla-neon"        // ダウンタウンLA、ネオン看板乱立
  | "venice-boardwalk" // Venice Beach風、海とパステル空
  | "hollywood-sign"   // ハリウッドサイン、広い空
  | "k-town-night"     // コリアタウンのハングルネオン
  | "rooftop-skyline"; // ルーフトップからのスカイライン

export type AvatarPose =
  | "idle"
  | "hand-on-hip"
  | "peace-sign"
  | "walking"
  | "mic-stand";

// ユーザーが作ったアバター本体。
// writeupModeとして "ai" (写真からClaudeが生成) / "manual" (パーツ選択) の2通り。
export interface UserAvatar {
  id: string;
  source: "ai" | "manual";
  // 色相0..360 (ルック調整用)。任意。
  skinHue: number;
  hairHue: number;
  eyeHue: number;
  lipHue: number;
  outfitHueA: number; // グラデ用2色
  outfitHueB: number;
  parts: {
    hair: AvatarHair;
    eyes: AvatarEyes;
    outfit: AvatarOutfit;
    accessory: AvatarAccessory;
    background: AvatarBackground;
    pose: AvatarPose;
  };
  // AI 生成時、Claude が推測した印象メモ (UI のコメント表示用)。
  vibe?: string;
  createdAt: string;
}

export interface AuditionCandidate extends Idol {
  auditionScore: number;
  cost: number;
}

// アイドルがSNS風に投稿するコンテンツ。Instagram風の1日1〜2件。
// プロデューサーが承認してから公開される（approved === true で fan に見える）。
export type PostKind = "selfie" | "scenery" | "snap" | "stage" | "studio" | "live";

export interface IdolPost {
  id: string;
  idolId: string;
  groupId?: string;
  kind: PostKind;
  caption: string; // AIが性格と状況から生成
  at: string; // 作成時刻（承認は別時刻）
  // ダミーのビジュアル生成用シード（SVGでグラデ+絵文字+ノイズ）
  imageSeed: number;
  palette: [string, string];
  emoji: string;
  // 承認状態:
  //  - null: プロデューサー確認待ち (pending)
  //  - true: 承認済み → fan feed に掲載
  //  - false: 却下 (表示しない)
  // 推しが自分で投稿している体にしたいので、事務所所属でなければ自動承認(true)。
  approved: boolean | null;
  approvedAt?: string;
  // live: 生放送の場合は終了時間
  liveUntil?: string;
  likes: number;
  likedByUser?: boolean;
}
