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
import type { AuditionCandidate, Loan } from "./types";
import { contractSuccessRate } from "./contracts";

interface State {
  initialized: boolean;
  user: UserProfile | null;
  groups: Group[];
  idols: Idol[];
  ads: CityAd[];
  // actions
  initWorld: () => void;
  registerUser: (nickname: string) => void;
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
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      initialized: false,
      user: null,
      groups: [],
      idols: [],
      ads: [],

      initWorld: () => {
        if (get().initialized) return;
        const { groups, idols, ads } = buildDefaultWorld();
        set({ groups, idols, ads, initialized: true });
      },

      registerUser: (nickname) => {
        const now = new Date().toISOString();
        set({
          user: {
            nickname,
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
          },
        });
      },

      setMode: (mode) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, mode } });
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
                  fanNickname: u.nickname,
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
                u.nickname,
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
    }),
    {
      name: "rise-to-fame-v2",
      version: 3,
      // 既存のアイドル/グループ/ユーザーデータを失わないよう、スキーマ拡張時はdefault値を注入する
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>;
        const user = (s.user ?? null) as Record<string, unknown> | null;
        if (user) {
          const now = new Date().toISOString();
          if (!("loans" in user)) user.loans = [];
          if (!("payoutRequestedJpy" in user)) user.payoutRequestedJpy = 0;
          if (!("payoutPaidJpy" in user)) user.payoutPaidJpy = 0;
          if (!("concerts" in user)) user.concerts = [];
          if (!("tutorialDone" in user)) user.tutorialDone = false;
          if (!("effort" in user)) user.effort = 0;
          if (!("lastEffortDecayAt" in user)) user.lastEffortDecayAt = now;
          if (!("giftsSent" in user)) user.giftsSent = [];
          if (!("bankAccount" in user) || !user.bankAccount) user.bankAccount = null;
          // 旧loanBalanceがあれば1件の借入に変換
          if ("loanBalance" in user && typeof user.loanBalance === "number" && user.loanBalance > 0) {
            const lb = user.loanBalance as number;
            (user.loans as unknown[]).push({
              id: `loan_legacy_${Date.now()}`,
              offerId: "legacy",
              principal: lb,
              remaining: lb,
              takenAt: now,
              dueAt: new Date(Date.now() + 14 * 86400000).toISOString(),
            });
            delete user.loanBalance;
          }
          if (!("createdAt" in user)) user.createdAt = now;
        }
        // groupsにfanCountが無ければ既存人気度から推定
        const groups = (s.groups ?? []) as Array<Record<string, unknown>>;
        for (const g of groups) {
          if (typeof g.fanCount !== "number") {
            const pop = typeof g.popularity === "number" ? (g.popularity as number) : 30;
            g.fanCount = Math.floor(pop * 30);
          }
        }
        if (!("ads" in s)) s.ads = [];
        void fromVersion;
        return s as unknown;
      },
    }
  )
);
