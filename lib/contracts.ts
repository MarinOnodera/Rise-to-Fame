import type { Idol } from "./types";

/**
 * 契約成功率の算定。
 * - 候補者のスコアが高いほど、口説き落とすのが難しい（レア寄り）
 * - 事務所の「努力値(effort)」が高いほど、成功率 +最大30%
 * - オーディションとスカウトで基礎率を変える
 */
export function contractSuccessRate(
  candidateScore: number,
  kind: "audition" | "scout",
  effort: number
): number {
  const base = kind === "audition" ? 0.6 : 0.45;
  const scorePenalty = Math.max(0, (candidateScore - 55) * 0.006);
  const effortBoost = Math.min(0.3, effort / 500);
  const rate = base - scorePenalty + effortBoost;
  return Math.max(0.15, Math.min(0.92, rate));
}

export function rollContract(
  candidate: Idol & { auditionScore: number },
  kind: "audition" | "scout",
  effort: number
): { success: boolean; rate: number } {
  const rate = contractSuccessRate(candidate.auditionScore, kind, effort);
  return { success: Math.random() < rate, rate };
}
