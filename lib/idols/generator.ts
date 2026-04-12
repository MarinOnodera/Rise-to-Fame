import type {
  Country,
  FaceSeed,
  Gender,
  Idol,
  PersonalityTrait,
  Stats,
} from "../types";
import { hashStr, id, mulberry32 } from "../rng";
import { rollPersonality } from "../personality";

const FIRST_GIRL = [
  "Jia", "Minseo", "Yuna", "Hana", "Sora", "Nari", "Rina", "Mei", "Linh",
  "Praew", "Chloe", "Isabella", "Ava", "Sienna", "Camila", "Léa", "Rosie",
  "Haeun", "Jisoo", "Mina", "Yumi", "An", "Kanya", "Yoona",
];
const FIRST_BOY = [
  "Jihoon", "Taeyang", "Minho", "Haru", "Ren", "Kai", "Jaden", "Leo",
  "Mateo", "Arthur", "Jun", "Hao", "Khai", "Bua", "Ethan", "Noah", "Theo",
  "Sungho", "Dohyun", "Wonho",
];
const LAST = [
  "Lee", "Kim", "Park", "Choi", "Jung", "Tanaka", "Suzuki", "Nguyen",
  "Chen", "Liu", "Sato", "Phan", "Silva", "Bernard", "Walker", "Ito",
  "Ono", "Baek", "Han", "Yoon",
];
const COUNTRIES: Country[] = [
  "KR", "KR", "KR", "KR", "JP", "JP", "CN", "TH", "VN", "US", "CA", "AU",
  "FR", "BR", "PH", "ID",
];

// 顔のユニーク性を担保するグローバルセット（実運用なら DB に）
const USED_FACE_KEYS = new Set<string>();

function rollFace(rng: () => number): FaceSeed {
  for (let tries = 0; tries < 50; tries++) {
    const f: FaceSeed = {
      skin: Math.floor(rng() * 360),
      eyeShape: Math.floor(rng() * 12),
      eyeColor: Math.floor(rng() * 360),
      hair: Math.floor(rng() * 10),
      hairColor: Math.floor(rng() * 360),
      jaw: Math.floor(rng() * 8),
      lips: Math.floor(rng() * 8),
      accent: Math.floor(rng() * 360),
      freckle: rng() < 0.2,
    };
    const key = Object.values(f).join("|");
    if (!USED_FACE_KEYS.has(key)) {
      USED_FACE_KEYS.add(key);
      return f;
    }
  }
  // 超レアケース: 多少似るが許容
  return {
    skin: Math.floor(rng() * 360),
    eyeShape: Math.floor(rng() * 12),
    eyeColor: Math.floor(rng() * 360),
    hair: Math.floor(rng() * 10),
    hairColor: Math.floor(rng() * 360),
    jaw: Math.floor(rng() * 8),
    lips: Math.floor(rng() * 8),
    accent: Math.floor(rng() * 360),
    freckle: rng() < 0.2,
  };
}

function rollStats(rng: () => number, boost = 0): Stats {
  const r = (min: number, max: number) =>
    Math.min(100, Math.floor(min + rng() * (max - min) + boost));
  return {
    vocal: r(30, 70),
    dance: r(30, 70),
    rap: r(20, 65),
    visual: r(45, 85),
    charm: r(35, 80),
    stamina: r(40, 85),
  };
}

export function generateIdol(opts: {
  gender: Gender;
  seed?: string;
  boost?: number;
  debuted?: boolean;
}): Idol {
  const seedStr = opts.seed ?? Math.random().toString(36);
  const rng = mulberry32(hashStr(seedStr));
  const firstPool = opts.gender === "girls" ? FIRST_GIRL : FIRST_BOY;
  const first = firstPool[Math.floor(rng() * firstPool.length)];
  const last = LAST[Math.floor(rng() * LAST.length)];
  const country = COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
  const personality = rollPersonality(rng);
  const stats = rollStats(rng, opts.boost ?? 0);
  return {
    id: id("idol_"),
    name: `${first} ${last}`,
    stageName: first,
    country,
    age: 17 + Math.floor(rng() * 8),
    gender: opts.gender,
    personality,
    bioSeed: `${first} from ${country}. Traits: ${personality.join(", ")}`,
    face: rollFace(rng),
    stats,
    popularity: opts.debuted ? 40 + Math.floor(rng() * 40) : 0,
    fatigue: 0,
    morale: 70 + Math.floor(rng() * 20),
    debuted: !!opts.debuted,
  };
}

export function generateCandidates(
  gender: Gender,
  n: number
): (Idol & { auditionScore: number; cost: number })[] {
  return Array.from({ length: n }, () => {
    const i = generateIdol({ gender, boost: Math.floor(Math.random() * 10) });
    const score =
      Math.round(
        (i.stats.vocal +
          i.stats.dance +
          i.stats.visual +
          i.stats.charm +
          i.stats.rap +
          i.stats.stamina) /
          6
      );
    return { ...i, auditionScore: score, cost: 200 + score * 4 };
  });
}

export function hasTrait(idol: Idol, t: PersonalityTrait): boolean {
  return idol.personality.includes(t);
}
