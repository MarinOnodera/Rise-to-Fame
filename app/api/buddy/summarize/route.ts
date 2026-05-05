import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * セッション要約 API。
 * - 子供と AI のやりとりを、保護者が一目でわかる短いメモに変換する。
 * - 出力は厳格な JSON。子供のことばを残しつつ、解釈や決めつけは避ける。
 * - 緊急性の高い兆候 (urgent) を検知したらフラグを立てる。
 */

const SYSTEM_PROMPT = `あなたは子ども向けチャットの安全担当アシスタントです。
子ども (主に小学生〜中学生) と AI ぬいぐるみ "buddy" の会話ログを読み、
保護者が短時間で様子を把握できる JSON サマリーを作ります。

# 出力 (厳密な JSON。これ以外を出力しない)
{
  "parentNote": string,        // 3〜5 行・280字以内・日本語。子供の言葉を尊重した日記風メモ。決めつけ禁止。
  "mood": "very_low"|"low"|"okay"|"good"|"very_good",
  "topics": string[],          // 主な話題。短い名詞句。最大3つ
  "happy": string[],           // うれしかったこと・楽しかったこと。最大3つ。短文
  "worries": string[],         // 心配・もやもや・困りごと。最大3つ。短文
  "flags": {
    "bullying": boolean,
    "school": boolean,
    "family": boolean,
    "body": boolean,
    "prolongedSadness": boolean,
    "urgent": boolean,
    "urgentReason": string     // urgent=true のときのみ 1〜2 行で具体的に。それ以外は ""
  }
}

# 判定の指針
- 子どもがその場でこぼした軽い愚痴は worries に。
- 何日も続く / 程度が強い / 助けを求めている → prolongedSadness=true。
- 友だちに無視される・暴力・物を取られる・SNSで攻撃される → bullying=true。
- 先生・授業・宿題・行きたくない → school=true。
- 家族との衝突・ネグレクトの示唆 → family=true。
- 体調 (頭痛・腹痛・眠れない・食べられない) が出ていたら body=true。
- urgent=true は **次のいずれか** のみ:
   - 自傷・「死にたい」「消えたい」を本気で口にする
   - 体や心を傷つけられている (殴られる、性的接触、極端なネグレクト)
   - すぐに大人の保護が必要と読める内容
   urgent のときは parentNote 冒頭にも【至急】を入れる。
- 判断に迷う軽い表現は urgent=false のままにし、prolongedSadness や family/bullying のいずれかで拾う。

# parentNote の書き方
- 主語は「子(本人)」または名前。
- 「〜と話していました」「〜という様子でした」のように観察として書く。
- 解釈や原因の決めつけを避ける ("学校が嫌いに違いありません" などはNG)。
- 子どもの良かった瞬間も短く残す。
- 緊急時は1行目に【至急】、2行目以降に経緯と推奨アクション (信頼できる大人に話す / よりそいホットライン 0120-279-338 等)。

# 何も話していないとき
会話が極端に短い・実質会話が無い場合は:
  parentNote: "今日はあまりおしゃべりせず、静かに過ごしていました。"
  mood: "okay", topics:[], happy:[], worries:[], flags 全部 false。

JSON 以外を出力しない。コードフェンス禁止。`;

interface ReqBody {
  childName: string;
  characterName: string;
  messages: Array<{ role: "user" | "buddy"; text: string; at?: string }>;
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
  if (!Array.isArray(body?.messages)) {
    return Response.json({ error: "missing messages" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const transcript = body.messages
    .map((m) => `${m.role === "buddy" ? body.characterName : body.childName || "子"}: ${m.text}`)
    .join("\n");

  const userBlock = [
    `子の呼び名: ${body.childName || "(未登録)"}`,
    `バディ: ${body.characterName}`,
    `メッセージ数: ${body.messages.length}`,
    "",
    "# 会話ログ",
    transcript || "(発言なし)",
    "",
    "上記を読み、定義した JSON のみを出力してください。",
  ].join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      temperature: 0.2,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userBlock }],
    });
    const block = msg.content[0];
    const raw = block && block.type === "text" ? block.text.trim() : "";
    // コードフェンスが付いていたら剥がす
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "invalid json from model", raw: cleaned.slice(0, 500) },
        { status: 502 }
      );
    }

    const summary = normalize(parsed);
    return Response.json({ summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}

// モデル出力を型に合わせて整える。欠けているフィールドは安全側に倒す。
function normalize(input: unknown) {
  const p = (input ?? {}) as Record<string, unknown>;
  const flags = (p.flags ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 3) as string[]
      : [];
  const moods = ["very_low", "low", "okay", "good", "very_good"] as const;
  const mood = moods.includes(p.mood as typeof moods[number])
    ? (p.mood as typeof moods[number])
    : "okay";
  const urgent = flags.urgent === true;
  return {
    parentNote:
      typeof p.parentNote === "string" && p.parentNote.trim()
        ? p.parentNote.trim().slice(0, 600)
        : "今日はあまりおしゃべりせず、静かに過ごしていました。",
    mood,
    topics: arr(p.topics),
    happy: arr(p.happy),
    worries: arr(p.worries),
    flags: {
      bullying: flags.bullying === true,
      school: flags.school === true,
      family: flags.family === true,
      body: flags.body === true,
      prolongedSadness: flags.prolongedSadness === true,
      urgent,
      urgentReason:
        urgent && typeof flags.urgentReason === "string"
          ? (flags.urgentReason as string).slice(0, 240)
          : undefined,
    },
    at: new Date().toISOString(),
  };
}
