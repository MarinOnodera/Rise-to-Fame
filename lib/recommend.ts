import type { Idol, PersonalityTrait } from "./types";

export interface Recommendation {
  idol: Idol;
  score: number;
  reason: string;
}

/**
 * 疑似AIのレコメンド。
 * ユーザーの既存の推しの性格傾向・国・デビュー/未デビューの好みを学習し、
 * マッチ度の高いアイドルを返す。
 * 将来は Claude API に差し替え可能（同じインターフェース）。
 */
export function recommendIdols(
  all: Idol[],
  biasedIds: string[],
  n = 3
): Recommendation[] {
  const biased = all.filter((i) => biasedIds.includes(i.id));
  const traitPref = new Map<PersonalityTrait, number>();
  const countryPref = new Map<string, number>();
  for (const b of biased) {
    for (const t of b.personality) traitPref.set(t, (traitPref.get(t) ?? 0) + 1);
    countryPref.set(b.country, (countryPref.get(b.country) ?? 0) + 1);
  }

  const pool = all.filter((i) => !biasedIds.includes(i.id));

  const scored = pool.map((i) => {
    let s = 0;
    const reasons: string[] = [];
    // 性格マッチ
    const traitHits = i.personality.filter((t) => traitPref.has(t));
    if (traitHits.length > 0) {
      s += traitHits.length * 30;
      reasons.push(`あなたが推してる子と同じ「${traitHits[0]}」な性格`);
    }
    // 国マッチ
    if (countryPref.has(i.country)) {
      s += 10;
    }
    // 努力家ボーナス（ユーザーに関わらず応援しがい）
    if (i.personality.includes("hardworking")) {
      s += 12;
      if (reasons.length === 0)
        reasons.push("練習室で一番最後まで残るタイプ");
    }
    // 未デビューのルーキー応援ボーナス
    if (!i.debuted) {
      s += 20;
      reasons.push("デビュー前。初期から応援できる");
    }
    // 人気の高い安心枠
    s += i.popularity * 0.25;
    // 少しだけランダム
    s += Math.random() * 6;

    // 0件時のフォールバック理由
    if (reasons.length === 0) {
      if (i.personality.includes("dreamer"))
        reasons.push("夢見がちなところに惹かれるかも");
      else if (i.personality.includes("cool"))
        reasons.push("クールで掴みどころがない魅力");
      else if (i.personality.includes("bubbly"))
        reasons.push("笑うと場がほどける明るさ");
      else reasons.push(`${i.country}出身の新しい風`);
    }

    return {
      idol: i,
      score: Math.round(s),
      reason: reasons[0],
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}
