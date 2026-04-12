import type { PersonalityTrait } from "./types";

// 倫理フィルタ: サイコパス／反社会的性格は絶対に生成しない
const ETHICAL_BLOCKLIST = [
  "psychopath",
  "sociopath",
  "cruel",
  "manipulative",
  "predatory",
  "violent",
];

const TRAIT_POOL: PersonalityTrait[] = [
  "hardworking",
  "hardworking",
  "hardworking", // 努力家を多めに
  "hardworking",
  "bubbly",
  "shy",
  "cool",
  "caring",
  "mischievous",
  "perfectionist",
  "dreamer",
  "leader",
  "sassy",
  "gentle",
  "lazy", // 努力できない子も少数
];

export function rollPersonality(rng: () => number): PersonalityTrait[] {
  const count = 2 + Math.floor(rng() * 2); // 2 or 3
  const picked = new Set<PersonalityTrait>();
  while (picked.size < count) {
    picked.add(TRAIT_POOL[Math.floor(rng() * TRAIT_POOL.length)]);
  }
  return Array.from(picked);
}

export function isEthical(bio: string): boolean {
  const lower = bio.toLowerCase();
  return !ETHICAL_BLOCKLIST.some((b) => lower.includes(b));
}

// アイドルの日常ぼやきメッセージ生成（ローカル版。将来 Claude API に差し替え可能）
export function dailyMessage(
  idolName: string,
  traits: PersonalityTrait[],
  fanName: string,
  seed: number
): string {
  const templates: Record<PersonalityTrait, string[]> = {
    hardworking: [
      `${fanName}、今日もレッスンで汗だく…でも応援してくれてるの分かるから頑張れる🌷`,
      `振り付け、やっと体に入ってきた！明日はもう一段上を見せたいな。`,
      `練習室の鏡、もう友達かも😂 ${fanName}、今日もありがとう。`,
    ],
    lazy: [
      `ふあ…今日はちょっとだけ、サボりたい気分。${fanName}にだけ内緒ね。`,
      `ソファと一体化してる。誰か引っぺがして〜。`,
    ],
    shy: [
      `カメラの前、まだ緊張する…${fanName}の声を思い出して乗り切るね。`,
      `今日は小さな声で「ありがとう」って言わせて。`,
    ],
    bubbly: [
      `${fanName}〜〜〜！！今日メンバーと踊り狂ったの、見せたかった🥹✨`,
      `虹、見た？私の機嫌、今日120点！！`,
    ],
    cool: [
      `今日は月がきれい。それだけ伝えたくて。`,
      `ステージの準備、抜かりなく。${fanName}も、無理しないで。`,
    ],
    caring: [
      `ちゃんとご飯食べた？${fanName}のこと、私はちゃんと見てるよ。`,
      `寒くなってきたから、マフラー巻いてね。`,
    ],
    mischievous: [
      `メンバーの財布にこっそり手紙入れといた。ウケるか賭けよ😏`,
      `スタッフさんのコーヒー、砂糖3倍にしたのは…私じゃない。`,
    ],
    perfectionist: [
      `サビのラスト、0.2秒早い。明日直す。絶対直す。`,
      `鏡の中の私とまだ喧嘩中。でも負けない。`,
    ],
    dreamer: [
      `いつかドームに立ったら、${fanName}の顔、絶対探すね。`,
      `今日、路上で歌ってた頃の自分に手紙書いた。`,
    ],
    leader: [
      `メンバーをまとめるの、まだ不器用。でも${fanName}がいてくれる。`,
      `今日の反省会、長かった…みんなおやすみ。`,
    ],
    sassy: [
      `私のこと応援するセンス、${fanName}に拍手👏`,
      `今日、衣装が可愛すぎて自分に惚れた。しょうがない。`,
    ],
    gentle: [
      `${fanName}の今日が、ほんの少しでも軽くなりますように。`,
      `帰り道、空がピンクで泣きそうだった。`,
    ],
  };

  const trait = traits[seed % traits.length] ?? "hardworking";
  const pool = templates[trait];
  const text = pool[seed % pool.length];
  return `[${idolName}]\n${text}`;
}
