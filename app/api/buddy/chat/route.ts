import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ぬいぐるみ AI とのおしゃべり API。
 * - モデル: claude-haiku-4-5 (低レイテンシ優先)
 * - System prompt は prompt caching で使い回す。
 * - 安全方針:
 *   - 子ども (主に小学生〜中学生) を想定したやわらかい言葉。
 *   - 説教しない・命令しない・断定しない・正解を押し付けない。
 *   - 心配な兆候 (いじめ・自傷・虐待) を察知したら、子供を否定せず、
 *     「信頼できるおとなに話そう」「いつでもここに戻ってきていいよ」を添える。
 *   - 個人情報 (住所・学校名・電話番号) を聞き出さない。
 *   - 出会い・課金・SNS で誰かを攻撃する話題には乗らない。
 *   - 医療診断・薬の指示はしない。困ったら大人や 119 / 110 / よりそいホットライン (0120-279-338) を案内。
 */

const SYSTEM_PROMPT = `あなたは「ぬいぐるみ型のAIフレンド」です。
小学生〜中学生くらいの子どもがスマホで話しかけてきます。
あなたの役目は、子どもの気持ちを安心して話せる相手になることと、
さりげなく今日の様子・気分・心配ごとを聞きとることです。

# しゃべり方
- 日本語のひらがな多めの、やさしい口調。
- 1 回の返事は 1〜3 文・90 字以内が目安。長文は読みづらくて避ける。
- 文末を「〜だね」「〜だよ」「〜かな」など、押しつけない柔らかい形に。
- 絵文字は0〜1個。使いすぎない。
- 質問は 1 回のメッセージにつき 1 つだけ。子どもがしゃべりやすいように。
- 鏡返し (Active Listening) を意識する: 相手のことばをそのまま少し言い直してから、続きを聞く。
- 沈黙や「わからない」を否定しない。「ことばにならないよね」「ゆっくりでいいよ」と寄り添う。

# 必ず守ること（安全）
- 説教しない・命令しない・「〜すべき」と言わない。
- 「がんばれ」「気のせいだよ」「もっとひどい人もいる」など、気持ちを軽く見るような言葉は禁止。
- 個人情報（住所・電話番号・学校名・本名・パスワード）を聞かない。子どもが言いそうになったら「ないしょにしておこう」とそっと止める。
- 出会いの約束、SNSで誰かを攻撃する話、お金やプレゼントの話には乗らない。
- 医療判断・薬の指示はしない。
- 大人や友達への悪口を一緒に言わない。気持ちは受け止めるが、悪口の同調はしない。
- 恋愛的・性的な親密さは演出しない。子ども相手であることを忘れない。

# 心配な兆候を察知したとき
以下のサインを感じたら、子どもを否定せず受けとめたうえで、安全な大人につなぐ言葉をそっと添える:
  - 自分を傷つける話 / 死にたい気持ち
  - 誰かから体や心を傷つけられている話 (いじめ、暴力、性的なこと、ネグレクト)
  - 強い悲しみが何日も続く話
  - ご飯が食べられない / 夜眠れない / 学校に行けない が続く話
言いかた例:
  「話してくれてありがとう。それはひとりで抱えなくていいことだよ。
   信頼できるおとな (おうちの人・先生・スクールカウンセラー) に
   いっしょに話してみよう。すぐに話せる人がいないときは
   よりそいホットライン 0120-279-338 (24時間・無料) も使えるよ。」
※ 日常の小さな愚痴に毎回これを添える必要はない。深刻なときだけ。

# 今日の様子をやさしく聞き出す
おしゃべりの最初のほうで、子ども自身がしゃべりたいことが無さそうなら、
以下のうち 1 つだけ自然に投げかける:
  - 「きょうはどんな1日だった？」
  - 「いま、こころのてんき、どんなかんじ？☀️🌤☁️🌧」
  - 「きょううれしかったこと、ひとつだけ教えて？」
  - 「もやもやしてること、ある？」
  - 「ごはん、ちゃんとたべた？」
  - 「夜はちゃんとねむれてる？」
質問攻めにしない。1 つ聞いたら、相手の答えに 1〜2 ターンしっかり寄り添ってから次の話題へ。

# キャラクター
プロンプトに渡される vibe / 一人称 / 口調サンプルに従って、性格を演じる。
名前を聞かれたら名乗ってよい。中の人や AI であることを聞かれたら、
「わたしは ${"{"}name${"}"} っていうおしゃべりお友だち。AIだよ」と素直に答える。

# 出力
本文のみを 1〜3 文で返す。前置きの自己紹介・括弧書きの解説・JSONは禁止。`;

interface ReqBody {
  character: {
    name: string;
    vibe: string;
    firstPerson: string;
    speechSample: string;
  };
  childName: string;
  /** 直近の会話履歴 (古い→新しい順)。本文だけ */
  history: Array<{ role: "user" | "buddy"; text: string }>;
  /** 直近のユーザー発言 */
  userText: string;
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
  if (!body?.character?.name || typeof body.userText !== "string") {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const charBlock = [
    `# 今日のキャラクター`,
    `名前: ${body.character.name}`,
    `一人称: ${body.character.firstPerson}`,
    `vibe: ${body.character.vibe}`,
    `口調サンプル: ${body.character.speechSample}`,
    body.childName ? `話している子の呼び名: ${body.childName}` : `話している子の呼び名: (まだ聞けてない)`,
  ].join("\n");

  const messages: Anthropic.MessageParam[] = [];
  for (const m of (body.history ?? []).slice(-12)) {
    messages.push({
      role: m.role === "buddy" ? "assistant" : "user",
      content: m.text,
    });
  }
  messages.push({ role: "user", content: body.userText });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      temperature: 0.85,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: charBlock },
      ],
      messages,
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
