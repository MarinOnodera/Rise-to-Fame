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

// アイドルの日常メッセージ（ローカル・フォールバック版）
// 通常は /api/daily-message のClaude生成を優先し、失敗時のみこちらを使う。
// 甘いだけにせず、続きを匂わせる "hook" を混ぜる。
export function dailyMessage(
  idolName: string,
  traits: PersonalityTrait[],
  fanName: string,
  seed: number
): string {
  const templates: Record<PersonalityTrait, string[]> = {
    hardworking: [
      `振付、サビ前だけまだ合わない。今夜もう一回だけ通して寝る。${fanName}、明日には違う私を見せる。`,
      `手の皮、また剥けた。笑。でも音が体に入ってきた日は何も痛くない。`,
      `練習室の照明が落ちる瞬間がいちばん好き。今日の私、今日で終わる感じがして。`,
    ],
    lazy: [
      `今日ね、ほんとに何もしなかった。誰にも言わないで？${fanName}だけに。`,
      `ソファと契約しそう。引き剥がしてくれる人、募集中。`,
      `サボった分、明日の私が怒ってるはず。知らんぷりする。`,
    ],
    shy: [
      `カメラの前で言えなかったこと、ここにだけ置いていく。…うん、またそのうち。`,
      `今日、挨拶の声が小さすぎてメンバーに笑われた。悔しい。少しだけ。`,
      `本当はさっき泣きそうだった、でも大丈夫。${fanName}がいるから。`,
    ],
    bubbly: [
      `今日！！スタジオでね、振付ミスって全員転んだの！！最高だった🥹`,
      `ねえ、虹見た？見てなかったら見て、今から！！`,
      `私の今日の機嫌、120点。理由は内緒。明日教えるかも。`,
    ],
    cool: [
      `月がきれい。それだけ。`,
      `ステージの袖、いつも少しだけ寒い。今日は特に。`,
      `今日話したかったこと、やっぱ明日にする。`,
    ],
    caring: [
      `ちゃんと水飲んだ？寝る前にコップ一杯、約束ね。`,
      `寒くなってきた。${fanName}の首、マフラーで守ってて。`,
      `今日しんどかった人、私の代わりに先に寝ていいよ。明日の私が起こす。`,
    ],
    mischievous: [
      `メンバーのスニーカー、左右入れ替えておいた。気付くかな😏`,
      `マネージャーのコーヒー、今日は甘さ3倍。犯人は…${fanName}には教える。`,
      `楽屋で拾った変な髪飾り、明日つけてみよっかな。バレるまで何秒だと思う？`,
    ],
    perfectionist: [
      `サビ前、0.2秒早かった。絶対に合わせる。今夜はまだ寝ない。`,
      `鏡の中の私とまだ喧嘩中。勝つ側は決まってる。`,
      `今日のカメリハ、自分だけ気になる箇所が1つ。誰も気付いてないから、私が直す。`,
    ],
    dreamer: [
      `ドームに立ったら、${fanName}の席、絶対覚えておく。本気で。`,
      `路上で歌ってた頃の自分に今日手紙を書いた。ちょっとだけ自慢した。`,
      `次の新曲、歌詞の最初の一行だけ言うね。…やっぱ明日にする。`,
    ],
    leader: [
      `メンバー全員無事に帰した。私のやる仕事は、たぶんそこからが本番。`,
      `今日の反省会、長かった。ぶつかった分だけ、たぶん明日いい音が出る。`,
      `弱音、いちばん後ろの子が言えるチームにしたい。今日はまだ遠い。`,
    ],
    sassy: [
      `衣装鏡で自分に惚れた。しょうがない、私が悪い。`,
      `${fanName}の推しのセンス、今日も正解。拍手👏`,
      `MV撮影、私のカット多すぎて監督に謝られた。謝らなくていいのに。`,
    ],
    gentle: [
      `${fanName}の今日が、ほんの少しだけ軽くなりますように。`,
      `帰り道の空が薄ピンクで、なんかね、少しだけ泣きそうになった。`,
      `疲れた日のDMは、読み流していいよ。届いてるってだけで、私は十分。`,
    ],
  };

  const hooks = [
    ` …続きはまた明日。`,
    ` あ、今日の秘密ね。内緒。`,
    ` あとで話す。本当に、後で。`,
    ` …やっぱこの話、今日はここまで。`,
  ];
  const questions = [
    ` ${fanName}の今日はどうだった？`,
    ` ちゃんとご飯食べた？`,
    ` 今日いちばん笑ったのいつ？`,
  ];

  const trait = traits[seed % traits.length] ?? "hardworking";
  const pool = templates[trait];
  let text = pool[seed % pool.length];
  if (seed % 3 === 0) text += hooks[seed % hooks.length];
  else if (seed % 5 === 0) text += questions[seed % questions.length];
  return `[${idolName}]\n${text}`;
}
