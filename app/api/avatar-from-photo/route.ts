import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ユーザー写真からポップイラスト風アバターを生成するAPI。
 *
 * 方針:
 * - モデル: claude-haiku-4-5 (Vision)。画像を実際に描くわけではなく、
 *   写真の「特徴」を抽出して、SVGで合成するための構造化パラメータを返す。
 * - 個人情報保護: 特定個人を識別できる形では返さない。肌/髪/服の色相、
 *   髪型カテゴリ、雰囲気キーワードのみに落とす。
 * - スタイル: リアル描写ではなく、K-Pop × LA × ネオン・サイバーパンクな
 *   「ポップイラスト風」に変換することを最重要ルールとする。
 * - 構図ワード: wide angle shot, sharp focus on background, highly detailed
 *   cityscape, no blur を内部的に必ず含める (パンフォーカス/ワイドビュー)。
 */

const SYSTEM_PROMPT = `You analyze a user-submitted reference photo and describe an ORIGINAL stylized avatar
inspired by it, for a K-Pop fan game set in a near-future LA cyberpunk city.

# HARD RULES (never break)
- Do NOT try to photorealistically identify the person. Do not output any name,
  ethnicity label, age guess under 18, or biometric description.
- Treat minors specially: if the subject looks under 18, still output a stylized
  avatar but set "outfit" to a modest streetwear / hoodie option and never pick
  revealing items.
- The output avatar must be an ORIGINAL character, not a portrait. It should
  feel "inspired by the vibe" of the photo, not a copy.
- Style target: POP ILLUSTRATION / ANIME-ADJACENT, flat-ish shading, vivid
  neon palette. Never describe as "photorealistic".
- Composition target (always assumed downstream): wide angle shot, full body
  or knee-up, sharp focus on background, highly detailed cityscape, no blur,
  deep focus / pan focus.
- World flavor: K-Pop meets Los Angeles, palm trees + neon signs + holographic
  billboards, open airy sky with sunset/purple gradient, cyberpunk accents but
  still spacious and optimistic (not dystopian).

# OUTPUT
Return ONLY a JSON object, no prose, no markdown fences. Shape:
{
  "skinHue": 0-360,
  "hairHue": 0-360,
  "eyeHue": 0-360,
  "lipHue": 0-360,
  "outfitHueA": 0-360,
  "outfitHueB": 0-360,
  "parts": {
    "hair": one of ["long-straight","long-wave","bob","ponytail","short-crop","undercut","twin-buns","half-up","mohawk-fade"],
    "eyes": one of ["almond","round","sharp","droopy","cat","wide"],
    "outfit": one of ["crop-jacket","oversize-hoodie","neon-mesh","stage-corset","streetwear","holo-puffer","leather-fit","cyber-kimono"],
    "accessory": one of ["none","cyber-visor","neon-shades","hologram-earring","choker-led","face-decal","halo-ring"],
    "background": one of ["la-sunset-blvd","dtla-neon","venice-boardwalk","hollywood-sign","k-town-night","rooftop-skyline"],
    "pose": one of ["idle","hand-on-hip","peace-sign","walking","mic-stand"]
  },
  "vibe": "short Japanese one-liner describing the overall vibe (<=40 chars)"
}

Choose hues that feel harmonious with a neon LA sunset palette (magenta, cyan,
gold, violet). If the photo is monochrome or unclear, pick stylish defaults
in that palette rather than guessing.`;

interface ReqBody {
  // data URL または base64 (image/jpeg | image/png | image/webp)
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
}

const HAIR = [
  "long-straight","long-wave","bob","ponytail","short-crop","undercut","twin-buns","half-up","mohawk-fade",
] as const;
const EYES = ["almond","round","sharp","droopy","cat","wide"] as const;
const OUTFIT = [
  "crop-jacket","oversize-hoodie","neon-mesh","stage-corset","streetwear","holo-puffer","leather-fit","cyber-kimono",
] as const;
const ACCESSORY = [
  "none","cyber-visor","neon-shades","hologram-earring","choker-led","face-decal","halo-ring",
] as const;
const BACKGROUND = [
  "la-sunset-blvd","dtla-neon","venice-boardwalk","hollywood-sign","k-town-night","rooftop-skyline",
] as const;
const POSE = ["idle","hand-on-hip","peace-sign","walking","mic-stand"] as const;

function clampHue(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return ((Math.round(x) % 360) + 360) % 360;
}
function pick<T extends readonly string[]>(
  list: T,
  v: unknown,
  fallback: T[number]
): T[number] {
  return (list as readonly string[]).includes(v as string)
    ? (v as T[number])
    : fallback;
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
  if (!body?.imageBase64) {
    return Response.json({ error: "missing imageBase64" }, { status: 400 });
  }

  // data URL を素の base64 に正規化
  let data = body.imageBase64;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" =
    body.mediaType ?? "image/jpeg";
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/.exec(data);
  if (m) {
    mediaType = m[1] as typeof mediaType;
    data = m[2];
  }
  // ざっくりサイズガード: ~6MB base64 上限
  if (data.length > 8_500_000) {
    return Response.json({ error: "image too large" }, { status: 413 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0.6,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            },
            {
              type: "text",
              text:
                "Analyze the vibe of this reference and return ONLY the JSON described above. " +
                "Remember: wide angle shot, sharp focus on background, highly detailed cityscape, no blur. " +
                "K-Pop x LA cyberpunk neon, open and airy.",
            },
          ],
        },
      ],
    });

    const block = msg.content[0];
    const raw = block && block.type === "text" ? block.text : "";
    // コードフェンス剥がし
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    let parsed: Record<string, unknown> = {};
    try {
      // JSON塊を抽出
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      parsed = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);
    } catch {
      parsed = {};
    }

    const partsIn = (parsed.parts ?? {}) as Record<string, unknown>;
    const normalized = {
      skinHue: clampHue(parsed.skinHue, 28),
      hairHue: clampHue(parsed.hairHue, 280),
      eyeHue: clampHue(parsed.eyeHue, 200),
      lipHue: clampHue(parsed.lipHue, 340),
      outfitHueA: clampHue(parsed.outfitHueA, 320),
      outfitHueB: clampHue(parsed.outfitHueB, 260),
      parts: {
        hair: pick(HAIR, partsIn.hair, "long-wave"),
        eyes: pick(EYES, partsIn.eyes, "almond"),
        outfit: pick(OUTFIT, partsIn.outfit, "crop-jacket"),
        accessory: pick(ACCESSORY, partsIn.accessory, "neon-shades"),
        background: pick(BACKGROUND, partsIn.background, "la-sunset-blvd"),
        pose: pick(POSE, partsIn.pose, "hand-on-hip"),
      },
      vibe:
        typeof parsed.vibe === "string"
          ? parsed.vibe.slice(0, 40)
          : "LAの夕焼けとネオンが似合う雰囲気",
    };

    return Response.json(normalized);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
