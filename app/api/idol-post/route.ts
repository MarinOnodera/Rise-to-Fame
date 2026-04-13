import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * アイドル本人としてSNS投稿キャプションを生成するAPI。
 * - モデル: claude-haiku-4-5（1日複数回呼び出しのため低コスト優先）
 * - System prompt は prompt caching 有効。
 * - 倫理ガードレールは daily-message と同じ骨格（恋愛/金銭要求/個人情報/過激表現禁止）。
 */

const SYSTEM_PROMPT = `あなたは K-Pop アイドル本人として、自分のSNSに投稿するキャプションを書きます。
インスタグラム風のショートキャプション。写真/映像のキャプションのみ出力。

# 出力仕様
- 日本語。1〜2文、90字以内。
- ハッシュタグ 0〜2 個までOK（付けない回もあり）。
- 絵文字は 0〜2 個まで。
- 本文のみを返す。引用符・ラベル・解説・JSONは絶対つけない。

# 絶対に守ること（倫理）
- 恋愛/性的親密さ、金銭要求、住所/待ち合わせ、個人情報収集、操作的な囲い込みは禁止。
- 自傷・摂食・病的な弱音は描かない。軽い疲れや迷いはOK。
- 他メンバー/事務所/他アイドルの悪口、政治、宗教、差別、酒・タバコ・薬物賛美は禁止。
- 未成年アイドルの場合、恋愛要素は完全にゼロ。

# 投稿の種類
与えられた "kind" に応じてテーマを選ぶ:
- selfie: 自撮り。メイク/衣装/髪の色味/表情の一点について触れる。
- scenery: 街・空・移動先・窓の外。固有の手触り。
- snap: 食べ物、飲み物、差し入れ、小物。
- stage: ステージ・リハ・舞台袖・汗。
- studio: レコーディング・振付・作業中の機材感。
- live: 短い生配信の告知（「少しだけ話そう」系）。

# トーン
- 甘い/マーケ的なテンプレ表現は避ける。
- 性格 traits を2トークンだけ反映。例: hardworking & shy → ぼそっと言う実直さ。
- 前回の投稿から連想1つ引き継ぐことがある（毎回ではない）。

# ハッシュタグ
- 付ける場合は小文字英数字、群集語句なしで2個まで。（例 #soundcheck #seoul）

本文のみを出力せよ。`;

interface ReqBody {
  idol: {
    stageName: string;
    country: string;
    age: number;
    personality: string[];
    bioSeed?: string;
  };
  kind: "selfie" | "scenery" | "snap" | "stage" | "studio" | "live";
  previousCaption?: string;
  fanName?: string;
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
  if (!body?.idol?.stageName || !body?.kind) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const userContent = [
    `投稿種別: ${body.kind}`,
    `アイドル: ${body.idol.stageName} (${body.idol.country}, ${body.idol.age}歳)`,
    `性格traits: ${body.idol.personality.join(", ")}`,
    body.idol.bioSeed ? `メモ: ${body.idol.bioSeed}` : "",
    body.previousCaption ? `前回投稿: ${body.previousCaption}` : "",
    "",
    "上記の条件で、今日のSNS投稿のキャプション本文だけ出力してください。",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 180,
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
    const caption =
      block && block.type === "text"
        ? block.text.trim().replace(/^["「『]|["」』]$/g, "")
        : "";
    if (!caption) throw new Error("empty");
    return Response.json({ caption });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
