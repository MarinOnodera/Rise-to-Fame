"use client";

/**
 * ユーザー情報の永続化バックアップ層。
 *
 * なぜ必要か:
 * - Zustand の persist は localStorage を使うが、iOS Safari の ITP は
 *   7日間操作がないと localStorage をクリアしてしまう。
 *   → 数日ぶりに開くと「ユーザーネーム入力画面」からやり直しになる事象の原因。
 * - 対策として (a) Cookie に最低限の復旧データを書き込み、(b) Permanent Storage を
 *   リクエストし、(c) 起動時に localStorage が空ならバックアップから復元する。
 *
 * Cookie 容量は ~4KB なので、ここには「ログインID に相当するコア情報」だけを
 * 保存する。フィード/インボックス/コンサート履歴など肥大化する配列は含めない。
 */

import type { UserProfile } from "./types";

const COOKIE_NAME = "rtf_backup_v1";
const LS_MIRROR_KEY = "rtf_backup_mirror_v1";
const MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

export interface UserBackup {
  v: 1;
  nickname: string;
  displayName: string;
  mode: "fan" | "producer" | null;
  coins: number;
  streak: number;
  createdAt: string;
  lastLoginAt: string;
  biasGroupIds: string[];
  biasIdolIds: string[];
  agencyId?: string;
  agencyName?: string;
  tutorialDone: boolean;
  savedAt: string;
}

export function toBackup(u: UserProfile): UserBackup {
  return {
    v: 1,
    nickname: u.nickname,
    displayName: u.displayName,
    mode: u.mode,
    coins: u.coins,
    streak: u.streak,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    biasGroupIds: u.biasGroupIds,
    biasIdolIds: u.biasIdolIds,
    agencyId: u.agencyId,
    agencyName: u.agencyName,
    tutorialDone: u.tutorialDone,
    savedAt: new Date().toISOString(),
  };
}

export function writeBackup(u: UserProfile): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(toBackup(u));
  try {
    const encoded = encodeURIComponent(json);
    document.cookie = `${COOKIE_NAME}=${encoded}; Max-Age=${MAX_AGE_SEC}; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(LS_MIRROR_KEY, json);
  } catch {
    // ignore
  }
}

export function readBackup(): UserBackup | null {
  if (typeof window === "undefined") return null;
  // Cookie を優先 (ITP の影響を受けにくい)
  try {
    const cookie = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE_NAME + "="));
    if (cookie) {
      const val = cookie.slice(COOKIE_NAME.length + 1);
      const parsed = JSON.parse(decodeURIComponent(val)) as UserBackup;
      if (parsed && parsed.v === 1 && parsed.nickname) return parsed;
    }
  } catch {
    // ignore
  }
  // localStorage ミラーにフォールバック
  try {
    const raw = localStorage.getItem(LS_MIRROR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserBackup;
      if (parsed && parsed.v === 1 && parsed.nickname) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearBackup(): void {
  if (typeof window === "undefined") return;
  try {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LS_MIRROR_KEY);
  } catch {
    // ignore
  }
}

/**
 * ブラウザに「このサイトのストレージを自動削除しないで」と頼む。
 * - PWA としてホーム追加済み、または十分なユーザーインタラクションがあれば通る。
 * - 拒否されても害はない (ベストエフォート)。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    const nav = navigator as Navigator & {
      storage?: {
        persist?: () => Promise<boolean>;
        persisted?: () => Promise<boolean>;
      };
    };
    if (nav.storage?.persisted) {
      const already = await nav.storage.persisted();
      if (already) return true;
    }
    if (nav.storage?.persist) {
      return await nav.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}
