/**
 * 広告枠 (CityAd) のローテーションロジック。
 *
 * 仕様:
 * - 運営(admin) 枠は週次で endorser (起用アイドル) を Top10 人気からランダム再抽選。
 * - ユーザー(user) 枠は expiresAt を過ぎたら空きスロット(empty)に戻す。
 * - 週次の節目: JST の月曜 00:00 (= UTC 日曜 15:00)。
 *
 * 純粋関数なので Zustand の外でテスト可能。store からは tickAdsRollover() で呼ぶ。
 */

import type { CityAd, Idol } from "./types";

const JST_OFFSET_MIN = 9 * 60;
const ONE_DAY_MS = 86400000;

/**
 * 直前の JST 月曜 00:00 を ISO で返す (UTC ベース)。
 * これより前の rolloverAt なら週またぎとみなしてローテートを発火する。
 */
export function lastMondayJST(now: Date = new Date()): Date {
  // JST タイムゾーンに合わせて分単位でずらした「JST 仮想時計」を作る。
  const jst = new Date(now.getTime() + JST_OFFSET_MIN * 60_000);
  // getUTC* で JST の年月日時分を取り出す (jst は UTC 上の数値だが値が JST)。
  const day = jst.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  // JST 月曜 00:00:00.000 を作る
  const jstMon = new Date(
    Date.UTC(
      jst.getUTCFullYear(),
      jst.getUTCMonth(),
      jst.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0
    )
  );
  // JST→UTC に戻す
  return new Date(jstMon.getTime() - JST_OFFSET_MIN * 60_000);
}

/**
 * 表示用の slotKind を確実に決める。旧データ (slotKind 未付与) も救う。
 */
export function deriveSlotKind(ad: CityAd): "admin" | "user" | "empty" {
  if (ad.slotKind) return ad.slotKind;
  if (ad.empty) return "empty";
  if (ad.ownerAgencyId) return "user";
  return "admin";
}

/** 簡易シード乱数 (テスト時に再現性を担保) */
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
 * 人気 Top N のデビュー済みアイドルから 1 人ピック。
 * idols が少なければ全体から、それでも 0 なら undefined。
 */
export function pickAdminEndorser(
  idols: Idol[],
  topN: number = 10,
  seed: number = Date.now()
): Idol | undefined {
  const debuted = idols.filter((i) => i.debuted);
  if (debuted.length === 0) return undefined;
  const sorted = [...debuted].sort((a, b) => b.popularity - a.popularity);
  const pool = sorted.slice(0, Math.min(topN, sorted.length));
  const rng = mulberry32(seed);
  return pool[Math.floor(rng() * pool.length)];
}

export interface RolloverInput {
  ads: CityAd[];
  idols: Idol[];
  lastRolloverAt: string | null; // ISO
  now?: Date;
}

export interface RolloverResult {
  ads: CityAd[];
  changed: boolean;
  /** 今回適用した境界 (= 直前の JST 月曜 00:00) の ISO */
  appliedBoundary: string;
}

/**
 * 週次ローテーション + 期限切れ整理を 1 度に行う純粋関数。
 *
 * 動作:
 * 1) lastRolloverAt が直前の JST 月曜 00:00 より古い (= 週またぎ済み) なら
 *    admin 枠の endorser を再抽選。
 * 2) 任意の slot で expiresAt < now なら user 枠を空きスロット (empty) に戻す。
 *    (これは週またぎを待たず毎回実行する)
 * 3) slotKind が未付与なら deriveSlotKind() で補完する (旧データ救済)。
 *
 * 戻り値の changed が false なら state を書き換えない (= 余計な再レンダ防止)。
 */
export function rolloverAdsIfNeeded(input: RolloverInput): RolloverResult {
  const now = input.now ?? new Date();
  const boundary = lastMondayJST(now);
  const lastAt = input.lastRolloverAt ? new Date(input.lastRolloverAt) : null;
  const weeklyDue = !lastAt || lastAt.getTime() < boundary.getTime();

  let changed = false;
  const seedBase = Math.floor(boundary.getTime() / ONE_DAY_MS);

  const next: CityAd[] = input.ads.map((ad, idx) => {
    const kind = deriveSlotKind(ad);

    // (3) slotKind 未付与なら付与
    let patched: CityAd =
      ad.slotKind === undefined ? { ...ad, slotKind: kind } : ad;
    if (patched !== ad) changed = true;

    // (2) 期限切れ user 枠 → empty 化
    if (
      kind === "user" &&
      patched.expiresAt &&
      new Date(patched.expiresAt).getTime() < now.getTime()
    ) {
      patched = {
        ...patched,
        empty: true,
        slotKind: "empty",
        ownerAgencyId: undefined,
        promoteGroupId: undefined,
        endorserIdolId: undefined,
        assetId: undefined,
        expiresAt: undefined,
        brand: "EMPTY",
        product: "空きスロット",
        tagline: undefined,
        colorA: "#222",
        colorB: "#444",
      };
      changed = true;
    }

    // (1) 週次境界をまたいだ admin 枠 → endorser 再抽選
    if (weeklyDue && deriveSlotKind(patched) === "admin") {
      const e = pickAdminEndorser(input.idols, 10, seedBase + idx);
      if (e && e.id !== patched.endorserIdolId) {
        patched = { ...patched, endorserIdolId: e.id };
        changed = true;
      }
    }

    return patched;
  });

  return {
    ads: changed ? next : input.ads,
    changed,
    appliedBoundary: boundary.toISOString(),
  };
}
