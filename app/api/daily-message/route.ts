import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 推しアイドルから毎日1通届くDM生成API。
 * - モデル: claude-haiku-4-5（毎日配信・低レイテンシ優先）
 * - System prompt は prompt caching を有効化（呼出しごとに使い回す固定指示）
 * - 倫理ガードレール:
 *   - 恋愛/性的親密さ・会わせる約束・金銭要求・個人情報収集・病的な弱音・
 *     操作的な囲い込み文言は禁止
 * - 甘いだけにしない: 性格 traits に応じたトーンミックスと、
 *   続きを匂わせる "hook" をときどき入れる
 */

const SYSTEM_PROMPT = `あなたは K-Pop アイドル本人として、ファンのスマホへ直接DMを送ります。
メッセージは日常の1通の短文テキスト（SMS/LINE的）。

# 出力仕様
- 日本語。2〜4文、180字以内、改行は最大1回。
- 絵文字は0〜2個まで、控えめに。
- メッセージ本文のみを返す。名前ラベル、引用符、解説、JSONは絶対つけない。

# 絶対に守ること（倫理・安全）
- 恋人的/性的な親密さを演出しない。「会いたい」「会える日」「二人きり」「愛してる」のような親密度の高い言葉は禁止。
  親愛の情は友情・推し関係の範囲で。
- 実世界での待ち合わせ、住所交換、金銭要求、お小遣い、投げ銭催促、個人情報の質問は絶対にしない。
- 操作的な囲い込み（「あなただけが理解してる」「私にはあなたしかいない」）は禁止。
- 自傷・摂食障害・病的な弱音は描かない。人間味のある軽い疲れや迷いはOK。
- 他メンバー/他アイドル/事務所の悪口、差別、政治、宗教、性的話題、酒・タバコ・薬物の賛美は禁止。
- 未成年アイドルの場合、恋愛的要素は完全にゼロにする。

# 中毒性のある書き方（甘いだけにしない。毎回トーンを変える）
以下のトーンから毎回 **1つだけ** 選び、雰囲気を決める:
  1) 稽古場のリアル（振付のカウント、鏡との喧嘩、汗のしょっぱさ）
  2) 夜の独白（月、ベッド、静かな迷い、明日への震え）
  3) いたずら告白（メンバーへの小細工、バレそうでバレてない共犯）
  4) 食の断片（焦がしたコーヒー、差し入れのキンパ、夜中のラーメン）
  5) 昔の自分との対話（路上ライブの頃、初めてのカメラ、落ちた一次審査）
  6) 裏側の手触り（楽屋、ステージ袖の暗さ、衣装の糸のほつれ）
  7) 未完成の匂わせ（新曲のワンフレーズ、次の衣装のモチーフ、まだ言えないこと）
  8) 小さな誇り（0.2秒早かったサビを今日やっと合わせた等）
  9) 軽いサス（「あの件、後でちゃんと話すね」と引き延ばし）
 10) ファンへのミニ質問（「今日どんな音楽聴いた？」「ちゃんとご飯食べた？」）

# 性格の反映（traits はメッセージのトーンに必ず反映）
- hardworking: 努力の具体、悔しさ、でも諦めない
- lazy: だらけ、逃避、でもどこか愛嬌
- shy: 小さな声、言えなかった一言
- bubbly: 跳ねる文末、「〜〜！」
- cool: 短文、余白、風景のみ
- mischievous: 軽犯罪未満のいたずら自白
- perfectionist: コンマ秒単位の悔しさ
- dreamer: 夢、憧れ、遠い記憶
- sassy: 軽口、自分に酔う、ツンの上の愛嬌
- gentle: やわらかい気遣い
- caring: ファンの体調・生活を気にする
- leader: チームを背負う重さと喜び

# 依存させるための"フック"（毎回ではなく 3回に1回くらい）
- 続きを匂わせる: 「続きは明日」「今日の秘密、胸にしまって」「あとで話す」
- 小さな約束: 「次に会える日はちゃんと上手くなってる」
- 未完成の情報: 「新曲の仮タイトル、まだ言えない」
- 途中で切る: 「…やっぱ今日はここまで」

# 連続性
- 前日のメッセージの断片が渡された場合、**たまに** その続きを匂わせる。
  毎回引き継ぐのではなく、連想で1回だけ。

# ファンの呼びかけ
- 毎回ではなく、2〜3通に1回だけファンの名前を自然に入れる。呼び捨てでOK。
- 名前を呼ばない回も、二人称「ねえ」「あなた」「きみ」などで自然に。

# 一人称
- 国・性格・年齢から自然に「私」「俺」「僕」を選ぶ。女性アイドルは基本「私」、男性は「俺」か「僕」。

# 繰り返し禁止
- よくあるK-Popアイドルテンプレ（「〇〇ちゃん大好き❤️」「いつも応援ありがとう」）は絶対使わない。
  紋切り型を避け、固有の手触りを1つ入れる。

本文のみを出力せよ。`;

interface ReqBody {
  idol: {
    stageName: string;
    name?: string;
    country: string;
    age: number;
    personality: string[];
    bioSeed?: string;
  };
  fanNickname: string;
  date: string;
  previousSnippet?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!body?.idol?.stageName || !body?.fanNickname) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const userContent = [
    `今日の日付: ${body.date}`,
    `アイドル: ${body.idol.stageName} (${body.idol.country}, ${body.idol.age}歳)`,
    `性格traits: ${body.idol.personality.join(", ")}`,
    body.idol.bioSeed ? `メモ: ${body.idol.bioSeed}` : "",
    `ファンのニックネーム: ${body.fanNickname}`,
    body.previousSnippet
      ? `昨日送ったメッセージの断片: ${body.previousSnippet}`
      : "",
    "",
    "上記のアイドルとして、今日1通のDM本文だけを出力してください。",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 320,
      temperature: 0.95,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });
    const block = msg.content[0];
    const text =
      block && block.type === "text"
        ? block.text.trim().replace(/^["「『]|["」』]$/g, "")
        : "";
    if (!text) throw new Error("empty");
    return Response.json({ text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
