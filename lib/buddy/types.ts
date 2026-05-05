// ぬいぐるみAIアプリのドメイン型。Rise-to-Fame ゲーム本体とは独立したストアで保持する。

export interface BuddyCharacter {
  id: string;
  name: string;
  /** /public 配下の画像パス。ユーザー提供画像をそのまま使う。 */
  imageSrc: string;
  /** 性格の手触り。Claude のシステムプロンプトに差し込む。 */
  vibe: string;
  /** UI アクセントカラー (chat バブル等) */
  accent: string;
  /** 背景グラデーション (Tailwind クラス) */
  bgClass: string;
  /** CSS フォールバックの色 (画像が無いときの ball 色) */
  fallbackA: string;
  fallbackB: string;
  /** 一人称 */
  firstPerson: string;
  /** 文末口調のサンプル */
  speechSample: string;
}

export type BuddyRole = "user" | "buddy";

export interface BuddyMessage {
  id: string;
  role: BuddyRole;
  text: string;
  /** ISO 文字列 */
  at: string;
}

/** 1 セッション = ある日 / ある時間帯のひとつのおしゃべり。 */
export interface BuddySession {
  id: string;
  characterId: string;
  /** 子供の表示名 (任意。空なら呼びかけは「きみ」「あなた」) */
  childName: string;
  startedAt: string;
  endedAt?: string;
  messages: BuddyMessage[];
  /** 自動要約 (Claude が後から付ける)。未要約なら null。 */
  summary: BuddySummary | null;
}

/** 5 段階。気分の指標。 */
export type MoodLevel = "very_low" | "low" | "okay" | "good" | "very_good";

/** 注意フラグ — 保護者が見るべき場合に true になる。 */
export interface ConcernFlags {
  /** いじめ・人間関係の悩み */
  bullying: boolean;
  /** 学校での困りごと */
  school: boolean;
  /** 家庭での困りごと */
  family: boolean;
  /** 体の不調 (継続的な頭痛・腹痛・睡眠) */
  body: boolean;
  /** 強い悲しみ・無力感が続いている */
  prolongedSadness: boolean;
  /** 緊急性の高い兆候 (自傷・他害・虐待等)。true のとき保護者に強く促す。 */
  urgent: boolean;
  /** 緊急の理由 (urgent=true のときのみ。1〜2行で具体的に) */
  urgentReason?: string;
}

export interface BuddySummary {
  /** 保護者向けに 3〜5 行で読める日記風メモ。子供の言葉を尊重した、決めつけのない表現で。 */
  parentNote: string;
  mood: MoodLevel;
  /** 主な話題 (3 つまで・短い名詞句) */
  topics: string[];
  /** うれしかったこと (短文) */
  happy: string[];
  /** 心配ごと (短文) */
  worries: string[];
  flags: ConcernFlags;
  /** 要約を作った時刻 */
  at: string;
}

export interface BuddyState {
  /** 初回セットアップ済みか */
  ready: boolean;
  selectedCharacterId: string | null;
  childName: string;
  /** 保護者ダッシュボード PIN (4 桁数字) のハッシュ。未設定なら null。 */
  parentPinHash: string | null;
  sessions: BuddySession[];
  /** 直近開いていたセッション (途中再開用) */
  activeSessionId: string | null;
}
