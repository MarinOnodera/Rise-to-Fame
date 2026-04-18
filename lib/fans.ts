/**
 * ゲーム内 AI ファン (NPCFan) の生成・シミュレーション。
 *
 * 目的:
 * - 実ユーザーがまだ少ない段階でも、街の広告 → 認知 → グループの fanCount 増加 →
 *   広告売上 (プロデューサー収益) のサイクルを成立させる。
 * - 純粋関数ベース (Zustand の外で動くようにし、テスト・差し替えが容易)。
 *
 * シミュレーションは「日次ティック」想定。home マウント時に 1 度走らせ、
 * 過剰実行は store 側で adEconomyLastTickAt のガードにより防ぐ。
 */

import type {
  CityAd,
  Country,
  FanVibe,
  Group,
  Idol,
  NPCFan,
} from "./types";
import { deriveSlotKind } from "./ads";

const COUNTRIES: Country[] = [
  "KR", "JP", "CN", "TH", "VN", "US", "CA", "AU", "FR", "BR", "PH", "ID",
];
// 国別の「K-POP への熱量」補正。集客ドライバ。
const COUNTRY_WEIGHT: Record<Country, number> = {
  KR: 1.3, JP: 1.2, US: 1.0, TH: 1.1, PH: 1.1,
  ID: 1.0, VN: 1.0, CN: 0.9, CA: 0.9, AU: 0.9, FR: 0.8, BR: 1.0,
};
const VIBES: FanVibe[] = ["cute", "cool", "edgy", "dreamy"];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * NPC ファンプールを生成する。初期世界に一度だけ呼ぶ想定。
 * `count` を大きくするとシミュレーションの統計安定性は上がるが persist 容量も増える。
 */
export function generateNpcFans(count: number, seed: number): NPCFan[] {
  const rng = mulberry32(seed);
  const out: NPCFan[] = [];
  for (let i = 0; i < count; i++) {
    const country = COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
    const age = 13 + Math.floor(rng() * 33);
    const vibe = VIBES[Math.floor(rng() * VIBES.length)];
    // 月予算: べき分布ぽく (課金勢と ROM 勢の二極)
    const r = rng();
    const budget =
      r < 0.65
        ? Math.floor(rng() * 300)           // ROM / 軽課金
        : r < 0.92
          ? 300 + Math.floor(rng() * 2000)  // ミドル
          : 2000 + Math.floor(rng() * 20000); // 重課金
    out.push({
      id: `npc_${seed.toString(36)}_${i}`,
      country,
      age,
      vibe,
      monthlyBudget: budget,
      biasGroupIds: [],
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/**
 * 広告 1 枠の「基礎インプレッション倍率」。placement による露出の差。
 */
const PLACEMENT_IMPRESSION: Record<CityAd["placement"], number> = {
  billboard: 1.0,
  shop: 0.55,
  bus: 0.35,
};

export interface AdTickInput {
  ads: CityAd[];
  groups: Group[];
  idols: Idol[];
  fans: NPCFan[];
  hoursSinceLast: number; // 最大 24h にクランプする
  now: Date;
  seed?: number;
}

export interface AdTickResult {
  /** fanCount が増えたグループの差分 (id → delta) */
  groupFanDelta: Record<string, number>;
  /** 人気度が増えたアイドルの差分 (id → delta) */
  idolPopDelta: Record<string, number>;
  /** 事務所別の想定収益 (jpy)。user 枠の広告に対して支払う形で使う。 */
  agencyPayoutJpy: Record<string, number>;
  /** NPC のバイアス更新 (推しグループを新たに追加した結果) */
  fans: NPCFan[];
  /** 何件のインプレッションが発生したか (UI 表示用) */
  impressions: number;
}

/**
 * 1 ティック (想定 24h) のシミュレーション。
 *
 * ロジック:
 * 1) 各 admin/user 広告について PLACEMENT 倍率 × 人気補正でインプレッションを算出。
 * 2) ファン母集団からランダムに視認者を抽出。vibe 一致なら効果倍増。
 * 3) 視認者が未推し状態なら確率で biasGroupIds に追加 → 対象グループの fanCount +1。
 * 4) 対象 group の popularity を微増 (上限 100)。
 * 5) user 枠ならその agency に jpy 換算で少額入金 (buyAdSlot のコスト回収圧)。
 *
 * すべて純粋: 入力の ads/groups/idols は変更しない。
 */
export function simulateAdEconomyTick(input: AdTickInput): AdTickResult {
  const {
    ads, groups, idols, fans,
    hoursSinceLast, now,
    seed = Math.floor(now.getTime() / 3_600_000),
  } = input;

  const rng = mulberry32(seed);
  const h = Math.max(0, Math.min(24, hoursSinceLast));

  const groupFanDelta: Record<string, number> = {};
  const idolPopDelta: Record<string, number> = {};
  const agencyPayoutJpy: Record<string, number> = {};
  let nextFans = fans;
  let impressions = 0;

  for (const ad of ads) {
    const kind = deriveSlotKind(ad);
    if (kind === "empty") continue;

    const targetGroupId =
      kind === "user"
        ? ad.promoteGroupId
        : ad.endorserIdolId
          ? idols.find((i) => i.id === ad.endorserIdolId)?.groupId
          : undefined;
    if (!targetGroupId) continue;
    const group = groups.find((g) => g.id === targetGroupId);
    if (!group) continue;

    // インプレッション数: placement × (グループ人気 / 100 の下駄) × 時間比例 × プール規模
    const poolFactor = Math.min(1.2, fans.length / 300);
    const base =
      PLACEMENT_IMPRESSION[ad.placement] *
      (0.4 + group.popularity / 100) *
      (h / 24) *
      poolFactor *
      0.25; // 全体の強度調整 (暴走防止)
    const impCount = Math.floor(base * fans.length);
    if (impCount <= 0) continue;
    impressions += impCount;

    // vibe マッチ: user 枠は asset の mood が無いので color から推測できずニュートラル。
    // 近似として admin 枠は endorser の face から、user 枠は asset の ad.mood → ad に無い。
    // 今は「すべて中立」(x1.0)、ただし流行地域 (country weight) で効かせる。

    for (let i = 0; i < impCount; i++) {
      const idx = Math.floor(rng() * fans.length);
      const fan = nextFans[idx];
      if (!fan) continue;

      const cw = COUNTRY_WEIGHT[fan.country] ?? 1.0;
      // 変換確率: 未推しなら高め、既に推しが居れば徐々に下がる
      const saturation = Math.min(1, fan.biasGroupIds.length / 3);
      const convProb = 0.02 * cw * (1 - saturation * 0.7);

      if (rng() < convProb && !fan.biasGroupIds.includes(targetGroupId)) {
        // 新規推し追加 (最大 3)
        const newBias: string[] =
          fan.biasGroupIds.length < 3
            ? [...fan.biasGroupIds, targetGroupId]
            : fan.biasGroupIds;
        if (newBias !== fan.biasGroupIds) {
          // イミュータブルに差し替え
          if (nextFans === fans) nextFans = [...fans];
          nextFans[idx] = { ...fan, biasGroupIds: newBias };
          groupFanDelta[targetGroupId] =
            (groupFanDelta[targetGroupId] ?? 0) + 1;
        }
      }

      // 金銭投下 (既推しのみ): 日割り月予算の一部を広告主 agency に
      if (fan.biasGroupIds.includes(targetGroupId) && kind === "user") {
        const dailyBudget = fan.monthlyBudget / 30;
        // このアドからの spend 寄与は 0.3% 程度に抑える
        const spend = dailyBudget * 0.003 * (h / 24);
        if (ad.ownerAgencyId && spend > 0) {
          agencyPayoutJpy[ad.ownerAgencyId] =
            (agencyPayoutJpy[ad.ownerAgencyId] ?? 0) + spend;
        }
      }
    }

    // 人気の上昇: インプレッション規模を人気度 +1 程度まで丸める
    const popBoost = Math.min(2, Math.ceil(impCount / 600));
    if (popBoost > 0 && ad.endorserIdolId) {
      idolPopDelta[ad.endorserIdolId] =
        (idolPopDelta[ad.endorserIdolId] ?? 0) + popBoost;
    }
  }

  return {
    groupFanDelta,
    idolPopDelta,
    agencyPayoutJpy,
    fans: nextFans,
    impressions,
  };
}
