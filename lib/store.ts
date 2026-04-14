"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BankAccount,
  DirectMessage,
  Group,
  Idol,
  UserMode,
  UserProfile,
  CityAd,
  UserAvatar,
  RoomItem,
  RoomState,
  OfficeLevel,
} from "./types";
import { buildDefaultWorld } from "./idols/defaults";
import { generateIdol } from "./idols/generator";
import { id as newId } from "./rng";
import { dailyMessage } from "./personality";
import {
  AD_DURATION_DAYS,
  AD_SLOT_PRICES,
  CONCERT_TIERS,
  coinsToJpy,
  GIFTS,
  LOAN_OFFERS,
  PRODUCER_SHARE,
} from "./economy";
import type { AuditionCandidate, IdolPost, Loan, PostKind } from "./types";
import { contractSuccessRate } from "./contracts";
import { readBackup, writeBackup, type UserBackup } from "./persistence";

interface State {
  initialized: boolean;
  user: UserProfile | null;
  groups: Group[];
  idols: Idol[];
  ads: CityAd[];
  posts: IdolPost[];
  // actions
  initWorld: () => void;
  registerUser: (nickname: string, displayName: string) => void;
  restoreFromBackup: (b: UserBackup) => void;
  setDisplayName: (name: string) => void;
  setAvatar: (avatar: UserAvatar | null) => void;
  setMode: (mode: UserMode) => void;
  completeTutorial: () => void;
  applyDailyLogin: () => void;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  // fan
  toggleBiasGroup: (groupId: string) => { ok: boolean; reason?: string };
  toggleBiasIdol: (idolId: string) => { ok: boolean; reason?: string };
  buyGoods: (goodsId: string, coins: number) => boolean;
  buyTicket: (tierId: string, coins: number, groupId: string) => boolean;
  sendGift: (giftId: string, idolId: string) => { ok: boolean; reason?: string };
  deliverDailyMessages: () => Promise<void>;
  markRead: (msgId: string) => void;
  // producer
  createAgency: (name: string) => void;
  signIdol: (
    candidate: AuditionCandidate,
    kind: "audition" | "scout"
  ) => { paid: boolean; success: boolean; rate: number };
  trainIdol: (idolId: string, kind: "vocal" | "dance" | "rap" | "visual" | "stamina") => boolean;
  runMarketing: (idolIds: string[], optionId: string, cost: number, popGain: number, fatigue: number) => boolean;
  takeLoan: (offerId: string) => void;
  repayLoan: (amount: number) => boolean;
  setBank: (bank: BankAccount) => void;
  simulateFanSpend: (jpyAmount: number, targetGroupId: string) => void;
  debutGroup: (idolIds: string[], groupName: string, concept: string) => void;
  holdConcert: (
    groupId: string,
    tier: "local" | "mid" | "large" | "solo"
  ) => { ok: boolean; reason?: string; revenueCoins?: number };
  buyAdSlot: (
    adId: string,
    promoteGroupId: string,
    brand: string,
    product: string,
    tagline: string
  ) => { ok: boolean; reason?: string };
  // SNS / 配信
  tickIdolPosts: () => Promise<void>; // 1日1〜2投稿の候補生成
  approvePost: (postId: string, approved: boolean) => void;
  goLive: (idolId: string, minutes: number) => { ok: boolean; reason?: string };
  likePost: (postId: string) => void;
  // 拠点 (家 / 事務所)
  addRoomItem: (target: "house" | "office", item: Omit<RoomItem, "id">) => void;
  removeRoomItem: (target: "house" | "office", id: string) => void;
  moveRoomItem: (target: "house" | "office", id: string, x: number, y: number) => void;
  setRoomHue: (target: "house" | "office", wallHue: number, floorHue: number) => void;
  upgradeOffice: () => { ok: boolean; reason?: string; newLevel?: OfficeLevel };
}

// ====== 拠点のデフォルト生成 ======
function defaultHouse(): RoomState {
  return {
    wallHue: 300,
    floorHue: 30,
    items: [
      { id: "house_bed_0", kind: "bed", x: 0, y: 0, colorA: "#ff7ac6", colorB: "#7b2cff" },
      { id: "house_desk_0", kind: "desk", x: 5, y: 0, colorA: "#312150", colorB: "#ffd166" },
      { id: "house_lamp_0", kind: "lamp", x: 7, y: 0, colorA: "#ff3d8b", colorB: "#ffd166" },
      { id: "house_plant_0", kind: "plant", x: 7, y: 4, colorA: "#1f6b3a", colorB: "#ffd166" },
    ],
  };
}

function defaultOffice(): RoomState {
  return {
    wallHue: 270,
    floorHue: 240,
    items: [
      { id: "office_desk_0", kind: "desk", x: 2, y: 2, colorA: "#1a1030", colorB: "#ffd166" },
      { id: "office_shelf_0", kind: "shelf", x: 5, y: 4, colorA: "#3a2554", colorB: "#ff3d8b" },
    ],
  };
}

// ====== 事務所アップグレードの基準 ======
// L2: 5,000コイン + 所属アイドルの最高人気度 >= 50
// L3: 25,000コイン + 所属グループの最高 fanCount >= 3,000 & 最高人気度 >= 80
export const OFFICE_UPGRADE_REQS: Record<
  OfficeLevel,
  { cost: number; description: string }
> = {
  1: { cost: 0, description: "自室の一角" },
  2: { cost: 5000, description: "小規模事務所 (アイドルの最高人気 50 以上)" },
  3: { cost: 25000, description: "大型事務所 (ファン 3,000 / 人気 80 以上)" },
};

const todayKey = () => new Date().toISOString().slice(0, 10);

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      initialized: false,
      user: null,
      groups: [],
      idols: [],
      ads: [],
      posts: [],

      initWorld: () => {
        if (get().initialized) return;
        const { groups, idols, ads } = buildDefaultWorld();
        set({ groups, idols, ads, initialized: true });
      },

      registerUser: (nickname, displayName) => {
        const now = new Date().toISOString();
        set({
          user: {
            nickname,
            displayName,
            mode: null,
            coins: 500, // アプリ登録ボーナス
            lastLoginAt: now,
            streak: 1,
            loans: [],
            payoutEarnedJpy: 0,
            payoutRequestedJpy: 0,
            payoutPaidJpy: 0,
            concerts: [],
            tutorialDone: false,
            effort: 0,
            lastEffortDecayAt: now,
            biasGroupIds: [],
            biasIdolIds: [],
            inbox: [],
            ownedGoods: {},
            tickets: [],
            giftsSent: [],
            bankAccount: null,
            createdAt: now,
            avatar: null,
            house: defaultHouse(),
            office: defaultOffice(),
            officeLevel: 1,
          },
        });
      },

      // localStorage が消えても Cookie から復旧できるよう、最低限の情報から
      // UserProfile を再構築する。インボックスやコンサート履歴など再生成可能な
      // コレクションは空で復活する (= 重要なID/コイン/推しは失われない)。
      restoreFromBackup: (b) => {
        const now = new Date().toISOString();
        set({
          user: {
            nickname: b.nickname,
            displayName: b.displayName || b.nickname,
            mode: b.mode ?? null,
            coins: typeof b.coins === "number" ? b.coins : 500,
            lastLoginAt: b.lastLoginAt ?? now,
            streak: typeof b.streak === "number" ? b.streak : 1,
            agencyId: b.agencyId,
            agencyName: b.agencyName,
            loans: [],
            payoutEarnedJpy: 0,
            payoutRequestedJpy: 0,
            payoutPaidJpy: 0,
            concerts: [],
            tutorialDone: b.tutorialDone ?? true,
            effort: 0,
            lastEffortDecayAt: now,
            biasGroupIds: Array.isArray(b.biasGroupIds) ? b.biasGroupIds : [],
            biasIdolIds: Array.isArray(b.biasIdolIds) ? b.biasIdolIds : [],
            inbox: [],
            ownedGoods: {},
            tickets: [],
            giftsSent: [],
            bankAccount: null,
            createdAt: b.createdAt ?? now,
            avatar: null,
            house: defaultHouse(),
            office: defaultOffice(),
            officeLevel: 1,
          },
        });
      },

      setMode: (mode) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, mode } });
      },

      setDisplayName: (name) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, displayName: name } });
      },

      setAvatar: (avatar) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, avatar } });
      },

      completeTutorial: () => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, tutorialDone: true } });
      },

      applyDailyLogin: () => {
        const u = get().user;
        if (!u) return;
        const today = todayKey();
        const last = u.lastLoginAt.slice(0, 10);
        if (last === today) return;
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        const streak = last === yesterday ? u.streak + 1 : 1;
        const bonus = 50 + Math.min(streak, 14) * 10; // 連続ログインで増加
        set({
          user: {
            ...u,
            coins: u.coins + bonus,
            streak,
            lastLoginAt: new Date().toISOString(),
          },
        });
      },

      addCoins: (n) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, coins: u.coins + n } });
      },

      spendCoins: (n) => {
        const u = get().user;
        if (!u || u.coins < n) return false;
        set({ user: { ...u, coins: u.coins - n } });
        return true;
      },

      toggleBiasGroup: (gid) => {
        const u = get().user;
        if (!u) return { ok: false, reason: "未ログイン" };
        const has = u.biasGroupIds.includes(gid);
        if (!has && u.biasGroupIds.length >= 3)
          return { ok: false, reason: "推しグループは最大3つまで" };
        const biasGroupIds = has
          ? u.biasGroupIds.filter((x) => x !== gid)
          : [...u.biasGroupIds, gid];
        set({ user: { ...u, biasGroupIds } });
        return { ok: true };
      },

      toggleBiasIdol: (iid) => {
        const u = get().user;
        if (!u) return { ok: false, reason: "未ログイン" };
        const has = u.biasIdolIds.includes(iid);
        if (!has && u.biasIdolIds.length >= 5)
          return { ok: false, reason: "推しアイドルは最大5人まで" };
        const biasIdolIds = has
          ? u.biasIdolIds.filter((x) => x !== iid)
          : [...u.biasIdolIds, iid];
        set({ user: { ...u, biasIdolIds } });
        return { ok: true };
      },

      buyGoods: (goodsId, coins) => {
        const u = get().user;
        if (!u || u.coins < coins) return false;
        set({
          user: {
            ...u,
            coins: u.coins - coins,
            ownedGoods: {
              ...u.ownedGoods,
              [goodsId]: (u.ownedGoods[goodsId] ?? 0) + 1,
            },
          },
        });
        // 購入額の20%を該当アイドル所属グループのオーナーに還元（この場でシミュレート）
        get().simulateFanSpend(coinsToJpy(coins), ""); // グループ未指定時は集計のみ
        return true;
      },

      sendGift: (giftId, idolId) => {
        const u = get().user;
        if (!u) return { ok: false, reason: "未ログイン" };
        const gift = GIFTS.find((g) => g.id === giftId);
        if (!gift) return { ok: false, reason: "ギフトが無効" };
        if (u.coins < gift.coins) return { ok: false, reason: "コインが足りません" };
        const idol = get().idols.find((i) => i.id === idolId);
        if (!idol) return { ok: false, reason: "アイドルが見つかりません" };
        const idols = get().idols.map((i) =>
          i.id === idolId
            ? { ...i, popularity: Math.min(100, i.popularity + gift.popGain) }
            : i
        );
        const record = {
          id: newId("gft_"),
          giftId: gift.id,
          idolId,
          groupId: idol.groupId,
          at: new Date().toISOString(),
          coins: gift.coins,
        };
        set({
          user: {
            ...u,
            coins: u.coins - gift.coins,
            giftsSent: [record, ...u.giftsSent],
          },
          idols,
        });
        // プレゼントは所属事務所に20%還元
        if (idol.groupId) {
          get().simulateFanSpend(coinsToJpy(gift.coins), idol.groupId);
        }
        return { ok: true };
      },

      buyTicket: (tierId, coins, groupId) => {
        const u = get().user;
        if (!u || u.coins < coins) return false;
        const tid = newId("tkt_");
        set({
          user: {
            ...u,
            coins: u.coins - coins,
            tickets: [...u.tickets, `${tid}:${tierId}:${groupId}`],
          },
        });
        get().simulateFanSpend(coinsToJpy(coins), groupId);
        return true;
      },

      deliverDailyMessages: async () => {
        const u = get().user;
        if (!u) return;
        const today = todayKey();
        const existingKeys = new Set(
          u.inbox.map((m) => `${m.fromIdolId}:${m.at.slice(0, 10)}`)
        );

        const tasks = u.biasIdolIds
          .filter((iid) => !existingKeys.has(`${iid}:${today}`))
          .map((iid) => {
            const idol = get().idols.find((x) => x.id === iid);
            if (!idol) return null;

            // 連続性のため、この子から来た直近のメッセージを1つ渡す
            const prev = u.inbox.find((m) => m.fromIdolId === iid);
            const prevSnippet = prev
              ? prev.text.replace(/^\[.+?\]\n/, "").slice(0, 140)
              : undefined;

            return { idol, prevSnippet };
          })
          .filter(Boolean) as Array<{
          idol: Idol;
          prevSnippet?: string;
        }>;

        if (tasks.length === 0) return;

        const newMsgs: DirectMessage[] = await Promise.all(
          tasks.map(async ({ idol, prevSnippet }) => {
            let text = "";
            try {
              const r = await fetch("/api/daily-message", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  idol: {
                    stageName: idol.stageName,
                    name: idol.name,
                    country: idol.country,
                    age: idol.age,
                    personality: idol.personality,
                    bioSeed: idol.bioSeed,
                  },
                  fanNickname: u.displayName || u.nickname,
                  date: today,
                  previousSnippet: prevSnippet,
                }),
              });
              if (r.ok) {
                const j = (await r.json()) as { text?: string };
                if (j.text) text = `[${idol.stageName}]\n${j.text}`;
              }
            } catch {
              // ignore, fallback below
            }
            if (!text) {
              const seed =
                Math.floor(Date.now() / 86400000) + idol.name.charCodeAt(0);
              text = dailyMessage(
                idol.stageName,
                idol.personality,
                u.displayName || u.nickname,
                seed
              );
            }
            return {
              id: newId("msg_"),
              fromIdolId: idol.id,
              at: new Date().toISOString(),
              text,
              read: false,
            } as DirectMessage;
          })
        );

        const latest = get().user;
        if (!latest) return;
        set({ user: { ...latest, inbox: [...newMsgs, ...latest.inbox] } });
      },

      markRead: (msgId) => {
        const u = get().user;
        if (!u) return;
        set({
          user: {
            ...u,
            inbox: u.inbox.map((m) =>
              m.id === msgId ? { ...m, read: true } : m
            ),
          },
        });
      },

      createAgency: (name) => {
        const u = get().user;
        if (!u) return;
        set({
          user: {
            ...u,
            agencyName: name,
            agencyId: newId("agc_"),
            mode: "producer",
          },
        });
      },

      signIdol: (candidate, kind) => {
        const u = get().user;
        if (!u || !u.agencyId) return { paid: false, success: false, rate: 0 };
        const cost = candidate.cost;
        if (u.coins < cost) return { paid: false, success: false, rate: 0 };
        const rate = contractSuccessRate(candidate.auditionScore, kind, u.effort);
        const success = Math.random() < rate;
        // 失敗時も契約料の半分は接待/諸経費として消失
        const paidCost = success ? cost : Math.floor(cost * 0.4);
        const effortGain = success ? 5 : 3;
        if (success) {
          const idol: Idol = {
            ...candidate,
            id: newId("idol_"),
            ownerId: u.agencyId,
            debuted: false,
            popularity: 5,
          };
          set({
            user: { ...u, coins: u.coins - paidCost, effort: u.effort + effortGain },
            idols: [...get().idols, idol],
          });
        } else {
          set({
            user: { ...u, coins: u.coins - paidCost, effort: u.effort + effortGain },
          });
        }
        return { paid: true, success, rate };
      },

      trainIdol: (idolId, kind) => {
        const u = get().user;
        if (!u) return false;
        const cost = 80;
        if (u.coins < cost) return false;
        const idols = get().idols.map((i) => {
          if (i.id !== idolId) return i;
          const gain = 2 + Math.floor(Math.random() * 4);
          const lazyPenalty = i.personality.includes("lazy") ? -1 : 0;
          const hardBonus = i.personality.includes("hardworking") ? 1 : 0;
          const total = Math.max(
            0,
            (i.stats[kind === "stamina" ? "stamina" : kind] as number) +
              gain +
              lazyPenalty +
              hardBonus
          );
          return {
            ...i,
            stats: { ...i.stats, [kind]: Math.min(100, total) },
            fatigue: Math.min(100, i.fatigue + 8),
            morale: Math.max(0, i.morale - (i.personality.includes("lazy") ? 2 : 0)),
          };
        });
        set({ user: { ...u, coins: u.coins - cost }, idols });
        return true;
      },

      runMarketing: (idolIds, _optionId, cost, popGain, fatigue) => {
        const u = get().user;
        if (!u || u.coins < cost) return false;
        const idols = get().idols.map((i) => {
          if (!idolIds.includes(i.id)) return i;
          const morale = i.morale;
          const multiplier = 0.7 + (morale / 200);
          return {
            ...i,
            popularity: Math.min(100, i.popularity + Math.floor(popGain * multiplier)),
            fatigue: Math.min(100, i.fatigue + fatigue),
          };
        });
        set({ user: { ...u, coins: u.coins - cost }, idols });
        return true;
      },

      takeLoan: (offerId) => {
        const u = get().user;
        if (!u) return;
        const offer = LOAN_OFFERS.find((o) => o.id === offerId);
        if (!offer) return;
        const now = new Date();
        const due = new Date(now.getTime() + offer.dueDays * 86400000);
        const loan: Loan = {
          id: newId("loan_"),
          offerId: offer.id,
          principal: offer.amount,
          remaining: offer.totalDue,
          takenAt: now.toISOString(),
          dueAt: due.toISOString(),
        };
        set({
          user: {
            ...u,
            coins: u.coins + offer.amount,
            loans: [...u.loans, loan],
          },
        });
      },

      repayLoan: (amount) => {
        const u = get().user;
        if (!u) return false;
        const totalRemaining = u.loans.reduce((s, l) => s + l.remaining, 0);
        const pay = Math.min(amount, totalRemaining, u.coins);
        if (pay <= 0) return false;
        let left = pay;
        const loans = u.loans
          .map((l) => {
            if (left <= 0) return l;
            const take = Math.min(l.remaining, left);
            left -= take;
            return { ...l, remaining: l.remaining - take };
          })
          .filter((l) => l.remaining > 0);
        set({
          user: {
            ...u,
            coins: u.coins - pay,
            loans,
          },
        });
        return true;
      },

      setBank: (bank) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, bankAccount: bank } });
      },

      simulateFanSpend: (jpyAmount, _targetGroupId) => {
        const u = get().user;
        if (!u || u.mode !== "producer") return;
        const share = Math.floor(jpyAmount * PRODUCER_SHARE);
        set({
          user: {
            ...u,
            payoutEarnedJpy: u.payoutEarnedJpy + share,
          },
        });
      },

      debutGroup: (idolIds, groupName, concept) => {
        const u = get().user;
        if (!u || !u.agencyId) return;
        const genderFirst = get().idols.find((i) => i.id === idolIds[0])?.gender;
        if (!genderFirst) return;
        const gid = newId("grp_");
        const group: Group = {
          id: gid,
          name: groupName,
          gender: genderFirst,
          agencyId: u.agencyId,
          memberIds: [...idolIds],
          popularity: 10,
          fanCount: 0,
          dominant: false,
          concept,
          colorA: "#ff3d8b",
          colorB: "#7b2cff",
          founded: new Date().getFullYear().toString(),
        };
        const idols = get().idols.map((i) =>
          idolIds.includes(i.id) ? { ...i, groupId: gid, debuted: true } : i
        );
        set({ groups: [...get().groups, group], idols });
      },

      tickIdolPosts: async () => {
        const state = get();
        const u = state.user;
        if (!u) return;
        const todayKeyStr = todayKey();
        // 既に今日の投稿が存在するアイドル
        const postedTodayBy = new Set(
          state.posts
            .filter((p) => p.at.slice(0, 10) === todayKeyStr)
            .map((p) => p.idolId)
        );
        const candidates = state.idols.filter(
          (i) => i.debuted && !postedTodayBy.has(i.id)
        );
        // 1人あたり 1〜2 件
        const KINDS: PostKind[] = ["selfie", "scenery", "snap", "stage", "studio"];
        const EMOJIS: Record<PostKind, string[]> = {
          selfie: ["📸", "💖", "✨", "🤳", "🌸"],
          scenery: ["🌆", "🌃", "🌊", "🌷", "☕"],
          snap: ["🍡", "🍰", "🍿", "🍙", "🍒"],
          stage: ["🎤", "🎶", "🔥", "💫", "⚡"],
          studio: ["🎧", "🎹", "📝", "🪩", "🎛"],
          live: ["🔴", "💬", "🎥", "📡", "💗"],
        };
        const newPosts: IdolPost[] = [];
        for (const idol of candidates) {
          const count = 1 + (Math.random() < 0.4 ? 1 : 0);
          const prev = state.posts.find((p) => p.idolId === idol.id)?.caption;
          for (let i = 0; i < count; i++) {
            const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
            let caption = "";
            try {
              const r = await fetch("/api/idol-post", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  idol: {
                    stageName: idol.stageName,
                    country: idol.country,
                    personality: idol.personality,
                    age: idol.age,
                    bioSeed: idol.bioSeed,
                  },
                  kind,
                  previousCaption: prev,
                  fanName: u.displayName || u.nickname,
                }),
              });
              if (r.ok) {
                const j = (await r.json()) as { caption?: string };
                caption = j.caption ?? "";
              }
            } catch {
              // fallback
            }
            if (!caption) {
              // ローカルフォールバック（言語は推しの性格から軽く色付け）
              const ls = idol.personality.includes("cool")
                ? ["今日はちょっと休憩。", "夜風が気持ちいい。", "自分の音を探してる。"]
                : idol.personality.includes("bubbly")
                ? ["きらきらな一日！みんな今日どうだった？", "ご飯おいしい〜🥺", "ふぃー楽しかった！"]
                : ["今日もがんばってるよ。", "みんなの存在が力になる。", "いつもありがとう。"];
              caption = ls[Math.floor(Math.random() * ls.length)];
            }
            const palette: [string, string] = kind === "stage"
              ? ["#1c0033", "#ff3d8b"]
              : kind === "scenery"
              ? ["#8ecae6", "#ffd166"]
              : kind === "studio"
              ? ["#0b0620", "#7b2cff"]
              : kind === "snap"
              ? ["#ff8ecb", "#ffd166"]
              : ["#ff3d8b", "#7b2cff"];
            const emoji =
              EMOJIS[kind][Math.floor(Math.random() * EMOJIS[kind].length)];
            // 承認フロー: 自分の事務所のアイドルは承認待ち、それ以外は既に公開済みとして扱う
            const isMine = idol.ownerId && idol.ownerId === u.agencyId;
            newPosts.push({
              id: newId("pst_"),
              idolId: idol.id,
              groupId: idol.groupId,
              kind,
              caption,
              at: new Date().toISOString(),
              imageSeed: Math.floor(Math.random() * 100000),
              palette,
              emoji,
              approved: isMine ? null : true,
              approvedAt: isMine ? undefined : new Date().toISOString(),
              likes: Math.floor(Math.random() * 3000) + 120,
            });
          }
        }
        if (newPosts.length === 0) return;
        // 最大500件で丸める
        set({ posts: [...newPosts, ...state.posts].slice(0, 500) });
      },

      approvePost: (postId, approved) => {
        const posts = get().posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                approved,
                approvedAt: approved ? new Date().toISOString() : p.approvedAt,
              }
            : p
        );
        set({ posts });
      },

      goLive: (idolId, minutes) => {
        const u = get().user;
        if (!u) return { ok: false, reason: "未ログイン" };
        const idol = get().idols.find((i) => i.id === idolId);
        if (!idol) return { ok: false, reason: "アイドルが見つかりません" };
        const liveUntil = new Date(Date.now() + minutes * 60000).toISOString();
        const post: IdolPost = {
          id: newId("pst_"),
          idolId,
          groupId: idol.groupId,
          kind: "live",
          caption: `${idol.stageName} が生配信中！`,
          at: new Date().toISOString(),
          imageSeed: Math.floor(Math.random() * 100000),
          palette: ["#ff0055", "#000000"],
          emoji: "🔴",
          approved: true,
          approvedAt: new Date().toISOString(),
          liveUntil,
          likes: 0,
        };
        set({ posts: [post, ...get().posts].slice(0, 500) });
        return { ok: true };
      },

      likePost: (postId) => {
        const posts = get().posts.map((p) =>
          p.id === postId
            ? p.likedByUser
              ? { ...p, likedByUser: false, likes: Math.max(0, p.likes - 1) }
              : { ...p, likedByUser: true, likes: p.likes + 1 }
            : p
        );
        set({ posts });
      },

      buyAdSlot: (adId, promoteGroupId, brand, product, tagline) => {
        const u = get().user;
        if (!u || !u.agencyId) return { ok: false, reason: "事務所がありません" };
        const ad = get().ads.find((a) => a.id === adId);
        if (!ad) return { ok: false, reason: "広告が見つかりません" };
        if (!ad.empty) return { ok: false, reason: "既に埋まっています" };
        const price = AD_SLOT_PRICES[ad.placement];
        if (u.coins < price) return { ok: false, reason: "コインが足りません" };
        const group = get().groups.find((g) => g.id === promoteGroupId);
        if (!group || group.agencyId !== u.agencyId)
          return { ok: false, reason: "自分のグループを指定してください" };
        const endorser = get().idols.find(
          (i) => i.groupId === promoteGroupId && i.debuted
        );
        const expiresAt = new Date(
          Date.now() + AD_DURATION_DAYS * 86400000
        ).toISOString();
        const ads = get().ads.map((a) =>
          a.id === adId
            ? {
                ...a,
                brand,
                product,
                tagline,
                colorA: group.colorA,
                colorB: group.colorB,
                empty: false,
                ownerAgencyId: u.agencyId,
                promoteGroupId,
                endorserIdolId: endorser?.id,
                expiresAt,
              }
            : a
        );
        set({
          ads,
          user: { ...u, coins: u.coins - price },
        });
        return { ok: true };
      },

      holdConcert: (groupId, tier) => {
        const u = get().user;
        if (!u || !u.agencyId) return { ok: false, reason: "事務所がありません" };
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return { ok: false, reason: "グループが見つかりません" };
        if (group.agencyId !== u.agencyId)
          return { ok: false, reason: "自分のグループではありません" };
        const def = CONCERT_TIERS.find((t) => t.tier === tier);
        if (!def) return { ok: false, reason: "ティアが不正" };
        if (group.fanCount < def.minFans)
          return {
            ok: false,
            reason: `ファン ${def.minFans.toLocaleString()} 人必要`,
          };
        if (u.coins < def.cost)
          return { ok: false, reason: "コインが足りません" };
        // 収益は baseRevenue + fan比例
        const fanBoost = Math.min(2.0, group.fanCount / (def.minFans * 3));
        const revenueCoins = Math.floor(def.baseRevenueCoins * (0.9 + fanBoost * 0.6));
        const attendance = Math.min(group.fanCount, def.minFans * 2);

        const groups = get().groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                popularity: Math.min(100, g.popularity + def.popGain),
                fanCount: g.fanCount + Math.floor(def.popGain * 40),
              }
            : g
        );
        const idols = get().idols.map((i) =>
          i.groupId === groupId
            ? {
                ...i,
                fatigue: Math.min(100, i.fatigue + def.fatigue),
                popularity: Math.min(100, i.popularity + Math.ceil(def.popGain / 2)),
              }
            : i
        );
        const record = {
          id: newId("cnc_"),
          groupId,
          tier,
          heldAt: new Date().toISOString(),
          attendance,
          revenueCoins,
        };
        set({
          groups,
          idols,
          user: {
            ...u,
            coins: u.coins - def.cost + revenueCoins,
            effort: u.effort + 8,
            concerts: [record, ...u.concerts],
          },
        });
        return { ok: true, revenueCoins };
      },

      // ====== 家 / 事務所 ======
      addRoomItem: (target, item) => {
        const u = get().user;
        if (!u) return;
        const room = (target === "house" ? u.house : u.office) ??
          (target === "house" ? defaultHouse() : defaultOffice());
        // 最大配置数 (グリッドを埋めすぎない)
        if (room.items.length >= 24) return;
        const next: RoomItem = { ...item, id: newId("itm_") };
        const updated = { ...room, items: [...room.items, next] };
        set({
          user:
            target === "house"
              ? { ...u, house: updated }
              : { ...u, office: updated },
        });
      },
      removeRoomItem: (target, id) => {
        const u = get().user;
        if (!u) return;
        const room = target === "house" ? u.house : u.office;
        if (!room) return;
        const updated = { ...room, items: room.items.filter((i) => i.id !== id) };
        set({
          user:
            target === "house"
              ? { ...u, house: updated }
              : { ...u, office: updated },
        });
      },
      moveRoomItem: (target, id, x, y) => {
        const u = get().user;
        if (!u) return;
        const room = target === "house" ? u.house : u.office;
        if (!room) return;
        const cx = Math.max(0, Math.min(7, Math.round(x)));
        const cy = Math.max(0, Math.min(5, Math.round(y)));
        const updated = {
          ...room,
          items: room.items.map((i) =>
            i.id === id ? { ...i, x: cx, y: cy } : i
          ),
        };
        set({
          user:
            target === "house"
              ? { ...u, house: updated }
              : { ...u, office: updated },
        });
      },
      setRoomHue: (target, wallHue, floorHue) => {
        const u = get().user;
        if (!u) return;
        const room = (target === "house" ? u.house : u.office) ??
          (target === "house" ? defaultHouse() : defaultOffice());
        const updated = { ...room, wallHue, floorHue };
        set({
          user:
            target === "house"
              ? { ...u, house: updated }
              : { ...u, office: updated },
        });
      },
      upgradeOffice: () => {
        const u = get().user;
        if (!u) return { ok: false, reason: "未ログイン" };
        const level = (u.officeLevel ?? 1) as OfficeLevel;
        if (level >= 3) return { ok: false, reason: "すでに最大レベルです" };
        const nextLevel = ((level + 1) as OfficeLevel);
        const req = OFFICE_UPGRADE_REQS[nextLevel];
        // 進行条件: 所属アイドル/グループの人気度とファン数
        const myIdols = get().idols.filter((i) => i.ownerId === u.agencyId);
        const myGroups = get().groups.filter((g) => g.agencyId === u.agencyId);
        const topPop = myIdols.reduce((m, i) => Math.max(m, i.popularity), 0);
        const topFans = myGroups.reduce((m, g) => Math.max(m, g.fanCount), 0);
        if (nextLevel === 2 && topPop < 50) {
          return {
            ok: false,
            reason: "所属アイドルの最高人気度が 50 以上で解放されます",
          };
        }
        if (nextLevel === 3 && (topFans < 3000 || topPop < 80)) {
          return {
            ok: false,
            reason: "最高グループファン数 3,000 & 最高人気度 80 以上で解放",
          };
        }
        if (u.coins < req.cost) {
          return { ok: false, reason: `コインが足りません (必要: ${req.cost.toLocaleString()})` };
        }
        set({
          user: {
            ...u,
            coins: u.coins - req.cost,
            officeLevel: nextLevel,
          },
        });
        return { ok: true, newLevel: nextLevel };
      },
    }),
    {
      name: "rise-to-fame-v2",
      version: 5,
      // 既存のアイドル/グループ/ユーザーデータを失わないよう、スキーマ拡張時はdefault値を注入する。
      // 重要: ここでエラーを投げると state がリセットされ、再ログイン画面に戻ってしまう。
      // どんな形式でも落ちずに足りない field を埋めるスタンスで実装する。
      migrate: (persistedState: unknown, fromVersion: number) => {
        try {
          const s = (persistedState ?? {}) as Record<string, unknown>;
          const user = (s.user ?? null) as Record<string, unknown> | null;
          if (user) {
            const now = new Date().toISOString();
            if (!Array.isArray(user.loans)) user.loans = [];
            if (typeof user.payoutRequestedJpy !== "number") user.payoutRequestedJpy = 0;
            if (typeof user.payoutPaidJpy !== "number") user.payoutPaidJpy = 0;
            if (!Array.isArray(user.concerts)) user.concerts = [];
            if (typeof user.tutorialDone !== "boolean") user.tutorialDone = false;
            if (typeof user.effort !== "number") user.effort = 0;
            if (typeof user.lastEffortDecayAt !== "string") user.lastEffortDecayAt = now;
            if (!Array.isArray(user.giftsSent)) user.giftsSent = [];
            if (!user.bankAccount) user.bankAccount = null;
            if (!("avatar" in user)) user.avatar = null;
            if (!user.house) user.house = defaultHouse();
            if (!user.office) user.office = defaultOffice();
            if (typeof user.officeLevel !== "number") user.officeLevel = 1;
            if (typeof user.createdAt !== "string") user.createdAt = now;
            if (typeof user.displayName !== "string" || !user.displayName) {
              user.displayName = (user.nickname as string) ?? "";
            }
            if (!Array.isArray(user.biasGroupIds)) user.biasGroupIds = [];
            if (!Array.isArray(user.biasIdolIds)) user.biasIdolIds = [];
            if (!Array.isArray(user.inbox)) user.inbox = [];
            if (!user.ownedGoods || typeof user.ownedGoods !== "object") user.ownedGoods = {};
            if (!Array.isArray(user.tickets)) user.tickets = [];
            if (typeof user.payoutEarnedJpy !== "number") user.payoutEarnedJpy = 0;
            if (typeof user.streak !== "number") user.streak = 1;
            if (typeof user.coins !== "number") user.coins = 500;
            if (typeof user.lastLoginAt !== "string") user.lastLoginAt = now;
            // 旧loanBalanceがあれば1件の借入に変換
            if (
              "loanBalance" in user &&
              typeof user.loanBalance === "number" &&
              (user.loanBalance as number) > 0
            ) {
              const lb = user.loanBalance as number;
              (user.loans as unknown[]).push({
                id: `loan_legacy_${Date.now()}`,
                offerId: "legacy",
                principal: lb,
                remaining: lb,
                takenAt: now,
                dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
              });
              delete (user as Record<string, unknown>).loanBalance;
            }
          }
          // groupsにfanCountが無ければ既存人気度から推定
          const groups = (s.groups ?? []) as Array<Record<string, unknown>>;
          for (const g of groups) {
            if (typeof g.fanCount !== "number") {
              const pop = typeof g.popularity === "number" ? (g.popularity as number) : 30;
              g.fanCount = Math.floor(pop * 30);
            }
          }
          if (!Array.isArray(s.ads)) s.ads = [];
          if (!Array.isArray(s.idols)) s.idols = [];
          if (!Array.isArray(s.groups)) s.groups = [];
          if (!Array.isArray(s.posts)) s.posts = [];
          if (typeof s.initialized !== "boolean") s.initialized = false;
          void fromVersion;
          return s as unknown;
        } catch (e) {
          console.warn("[migrate] failed, returning as-is", e);
          return persistedState as unknown;
        }
      },
      // persist からハイドレートが完了したタイミングで呼ばれる。
      // ここで localStorage が空 (= ブラウザに飛ばされた) だった場合に、
      // Cookie に残っているバックアップからユーザーを自動復旧する。
      onRehydrateStorage: () => (state) => {
        if (typeof window === "undefined") return;
        try {
          if (!state?.user) {
            const b = readBackup();
            if (b) {
              useGame.getState().restoreFromBackup(b);
              console.info("[persistence] restored user from cookie backup");
            }
          }
        } catch (e) {
          console.warn("[persistence] restore failed", e);
        }
      },
    }
  )
);

// ユーザーが変化するたびに Cookie (+ localStorage ミラー) にバックアップを保存する。
// これにより iOS Safari ITP や quota 退避で localStorage が消えても、
// 次回起動時に readBackup() から自動復旧できる。
if (typeof window !== "undefined") {
  let lastUser = useGame.getState().user;
  useGame.subscribe((state) => {
    const u = state.user;
    if (u && u !== lastUser) {
      writeBackup(u);
    }
    lastUser = u;
  });
}
