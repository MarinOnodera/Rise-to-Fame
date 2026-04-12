"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
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
import { coinsToJpy, PRODUCER_SHARE } from "./economy";

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
  applyDailyLogin: () => void;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;
  // fan
  toggleBiasGroup: (groupId: string) => { ok: boolean; reason?: string };
  toggleBiasIdol: (idolId: string) => { ok: boolean; reason?: string };
  buyGoods: (goodsId: string, coins: number) => boolean;
  buyTicket: (tierId: string, coins: number, groupId: string) => boolean;
  deliverDailyMessages: () => Promise<void>;
  markRead: (msgId: string) => void;
  // producer
  createAgency: (name: string) => void;
  signIdol: (candidate: Idol, cost: number) => boolean;
  trainIdol: (idolId: string, kind: "vocal" | "dance" | "rap" | "visual" | "stamina") => boolean;
  runMarketing: (idolIds: string[], optionId: string, cost: number, popGain: number, fatigue: number) => boolean;
  takeLoan: (amount: number) => void;
  repayLoan: (amount: number) => boolean;
  setBank: (bank: string, holder: string, last4: string) => void;
  simulateFanSpend: (jpyAmount: number, targetGroupId: string) => void;
  debutGroup: (idolIds: string[], groupName: string, concept: string) => void;
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
            loanBalance: 0,
            payoutEarnedJpy: 0,
            biasGroupIds: [],
            biasIdolIds: [],
            inbox: [],
            ownedGoods: {},
            tickets: [],
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

      signIdol: (candidate, cost) => {
        const u = get().user;
        if (!u || !u.agencyId) return false;
        if (u.coins < cost) return false;
        const idol: Idol = {
          ...candidate,
          id: newId("idol_"),
          ownerId: u.agencyId,
          debuted: false,
          popularity: 5,
        };
        set({
          user: { ...u, coins: u.coins - cost },
          idols: [...get().idols, idol],
        });
        return true;
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

      takeLoan: (amount) => {
        const u = get().user;
        if (!u) return;
        set({
          user: {
            ...u,
            coins: u.coins + amount,
            loanBalance: u.loanBalance + amount,
          },
        });
      },

      repayLoan: (amount) => {
        const u = get().user;
        if (!u) return false;
        const pay = Math.min(amount, u.loanBalance, u.coins);
        if (pay <= 0) return false;
        set({
          user: {
            ...u,
            coins: u.coins - pay,
            loanBalance: u.loanBalance - pay,
          },
        });
        return true;
      },

      setBank: (bank, holder, last4) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, bankAccount: { bank, holder, last4 } } });
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
    }),
    {
      name: "rise-to-fame-v2",
      version: 2,
    }
  )
);
