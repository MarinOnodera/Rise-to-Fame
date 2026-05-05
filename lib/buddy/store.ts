"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BuddyMessage,
  BuddySession,
  BuddyState,
  BuddySummary,
} from "./types";

const newId = (prefix: string) =>
  prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// 4 桁 PIN をハッシュ化 (FNV-1a 32bit)。完全な暗号強度ではないが、
// localStorage に平文で残さないための最小のガード。保護者ダッシュボードは
// 「子供のスマホで気軽にのぞけない」程度の障壁で十分。
function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface Actions {
  selectCharacter: (id: string) => void;
  setChildName: (name: string) => void;
  setParentPin: (pin: string) => void;
  verifyParentPin: (pin: string) => boolean;
  startSession: () => string;
  endActiveSession: () => void;
  appendMessage: (sessionId: string, msg: Omit<BuddyMessage, "id" | "at">) => BuddyMessage;
  setSessionSummary: (sessionId: string, summary: BuddySummary) => void;
  deleteSession: (sessionId: string) => void;
  resetAll: () => void;
}

const initial: BuddyState = {
  ready: false,
  selectedCharacterId: null,
  childName: "",
  parentPinHash: null,
  sessions: [],
  activeSessionId: null,
};

export const useBuddy = create<BuddyState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      selectCharacter: (id) => set({ selectedCharacterId: id, ready: true }),

      setChildName: (name) => set({ childName: name.slice(0, 20) }),

      setParentPin: (pin) => {
        if (!/^\d{4}$/.test(pin)) return;
        set({ parentPinHash: hashPin(pin) });
      },

      verifyParentPin: (pin) => {
        const h = get().parentPinHash;
        if (!h) return false;
        return hashPin(pin) === h;
      },

      startSession: () => {
        const cid = get().selectedCharacterId;
        if (!cid) return "";
        const id = newId("ses_");
        const session: BuddySession = {
          id,
          characterId: cid,
          childName: get().childName,
          startedAt: new Date().toISOString(),
          messages: [],
          summary: null,
        };
        set({
          sessions: [session, ...get().sessions].slice(0, 200),
          activeSessionId: id,
        });
        return id;
      },

      endActiveSession: () => {
        const id = get().activeSessionId;
        if (!id) return;
        const sessions = get().sessions.map((s) =>
          s.id === id && !s.endedAt
            ? { ...s, endedAt: new Date().toISOString() }
            : s
        );
        set({ sessions, activeSessionId: null });
      },

      appendMessage: (sessionId, msg) => {
        const full: BuddyMessage = {
          ...msg,
          id: newId("m_"),
          at: new Date().toISOString(),
        };
        const sessions = get().sessions.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, full] } : s
        );
        set({ sessions });
        return full;
      },

      setSessionSummary: (sessionId, summary) => {
        const sessions = get().sessions.map((s) =>
          s.id === sessionId ? { ...s, summary } : s
        );
        set({ sessions });
      },

      deleteSession: (sessionId) => {
        set({
          sessions: get().sessions.filter((s) => s.id !== sessionId),
          activeSessionId:
            get().activeSessionId === sessionId ? null : get().activeSessionId,
        });
      },

      resetAll: () => set({ ...initial }),
    }),
    {
      name: "buddy-app-v1",
      version: 1,
    }
  )
);
