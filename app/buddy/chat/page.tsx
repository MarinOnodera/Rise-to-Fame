"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuddy } from "@/lib/buddy/store";
import { getCharacter } from "@/lib/buddy/characters";
import { FluffyAvatar } from "@/components/buddy/FluffyAvatar";
import type { BuddyMessage, BuddySession } from "@/lib/buddy/types";

// セッション 1 つに収めるおしゃべりの上限。長すぎると要約が散らかるので適度に区切る。
const SESSION_MSG_SOFT_LIMIT = 60;

export default function BuddyChatPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    selectedCharacterId,
    childName,
    sessions,
    activeSessionId,
    startSession,
    endActiveSession,
    appendMessage,
    setSessionSummary,
  } = useBuddy();

  const character = getCharacter(selectedCharacterId);
  const activeSession: BuddySession | null = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ハイドレート完了 + キャラ未選択ならセレクトへ
  useEffect(() => {
    if (!hydrated) return;
    if (!character) router.replace("/buddy/select");
  }, [hydrated, character, router]);

  // セッションがまだ無いなら作る + あいさつを 1 通送らせる
  useEffect(() => {
    if (!hydrated || !character) return;
    if (activeSession) return;
    const id = startSession();
    if (!id) return;
    // あいさつ
    void greet(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, character]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeSession?.messages.length]);

  if (!hydrated || !character) {
    return <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-100" />;
  }

  async function greet(sessionId: string) {
    if (!character) return;
    const name = childName || "";
    // 初回は API を 1 回叩いて自然なあいさつを作らせる。失敗したらフォールバック。
    setSending(true);
    try {
      const r = await fetch("/api/buddy/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          character: {
            name: character.name,
            vibe: character.vibe,
            firstPerson: character.firstPerson,
            speechSample: character.speechSample,
          },
          childName: name,
          history: [],
          userText:
            "(システム: これは新しいセッションのスタート。やさしく短くあいさつして、今日の気分や様子を 1 つだけ自然に聞いてあげて。)",
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { text?: string };
        if (j.text) {
          appendMessage(sessionId, { role: "buddy", text: j.text });
          return;
        }
      }
    } catch {
      // fall through
    }
    appendMessage(sessionId, {
      role: "buddy",
      text: name
        ? `${name}、きょうはどんな1日だった？`
        : "やっほー。きょうはどんな1日だった？",
    });
    setSending(false);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending || !activeSession || !character) return;
    setDraft("");
    appendMessage(activeSession.id, { role: "user", text });
    setSending(true);
    try {
      const history = [...activeSession.messages, {
        id: "tmp",
        role: "user" as const,
        text,
        at: new Date().toISOString(),
      }].slice(-14).map((m) => ({ role: m.role, text: m.text }));

      const r = await fetch("/api/buddy/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          character: {
            name: character.name,
            vibe: character.vibe,
            firstPerson: character.firstPerson,
            speechSample: character.speechSample,
          },
          childName,
          history,
          userText: text,
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { text?: string };
        if (j.text) {
          appendMessage(activeSession.id, { role: "buddy", text: j.text });
        } else {
          appendMessage(activeSession.id, {
            role: "buddy",
            text: "うん、うん。それで…？",
          });
        }
      } else {
        appendMessage(activeSession.id, {
          role: "buddy",
          text: "ごめんね、いま すこし おみみが とおいみたい。あとで もういちど おしえてくれる？",
        });
      }
    } catch {
      appendMessage(activeSession.id, {
        role: "buddy",
        text: "ごめんね、ちょっと くもの上に いきそうだった。もういちど いってくれる？",
      });
    } finally {
      setSending(false);
    }
  }

  async function endAndSummarize() {
    if (!activeSession) {
      router.push("/buddy");
      return;
    }
    setShowEnd(false);
    setSending(true);
    try {
      const r = await fetch("/api/buddy/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childName,
          characterName: character?.name ?? "",
          messages: activeSession.messages.map((m) => ({
            role: m.role,
            text: m.text,
            at: m.at,
          })),
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { summary?: BuddySummaryDto };
        if (j.summary) {
          setSessionSummary(activeSession.id, {
            parentNote: j.summary.parentNote,
            mood: j.summary.mood,
            topics: j.summary.topics,
            happy: j.summary.happy,
            worries: j.summary.worries,
            flags: j.summary.flags,
            at: j.summary.at,
          });
        }
      }
    } catch {
      // 要約失敗してもセッション終了はする
    } finally {
      endActiveSession();
      setSending(false);
      router.push("/buddy");
    }
  }

  const messages = activeSession?.messages ?? [];
  const overSoftLimit = messages.length >= SESSION_MSG_SOFT_LIMIT;

  return (
    <main
      className={`min-h-screen flex flex-col bg-gradient-to-b ${character.bgClass} text-slate-800`}
    >
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 border-b border-white/60">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-3">
          <Link href="/buddy" className="text-rose-500 text-sm">
            ←
          </Link>
          <FluffyAvatar character={character} size={40} />
          <div className="flex-1">
            <p className="font-bold text-slate-700">{character.name}</p>
            <p className="text-[11px] text-slate-500">
              {sending ? "…かんがえちゅう" : "おはなし中"}
            </p>
          </div>
          <button
            onClick={() => setShowEnd(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-white/80 border border-rose-200 text-rose-500 font-semibold"
          >
            おしまい
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 mx-auto max-w-md w-full"
      >
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <Bubble key={m.id} m={m} accent={character.accent} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 self-start">
              <FluffyAvatar character={character} size={32} />
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm border border-white/70 text-slate-400 text-sm">
                <span className="inline-block animate-pulse">・・・</span>
              </div>
            </div>
          )}
          {overSoftLimit && (
            <p className="text-[11px] text-center text-slate-500 mt-2">
              ながく おしゃべりしてくれたね。きりのいいところで「おしまい」を おしてもいいよ。
            </p>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 bg-white/80 backdrop-blur border-t border-white/70">
        <div className="mx-auto max-w-md px-3 py-3 flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ここに かいて しゃべろう"
            rows={1}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="flex-1 resize-none rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-slate-700 outline-none focus:border-rose-300 max-h-32"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="rounded-full bg-gradient-to-r from-rose-400 to-pink-400 text-white font-bold px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed shadow active:scale-95 transition"
            aria-label="おくる"
          >
            ♡
          </button>
        </div>
      </footer>

      {showEnd && (
        <div
          className="fixed inset-0 z-30 bg-black/30 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowEnd(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-black text-slate-700">
              きょうの おしゃべりを おわる？
            </p>
            <p className="mt-2 text-sm text-slate-500">
              おしゃべりは メモになって、おうちの人が みれるよ。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowEnd(false)}
                className="flex-1 rounded-full bg-slate-100 text-slate-500 font-semibold py-3"
              >
                つづける
              </button>
              <button
                onClick={() => void endAndSummarize()}
                className="flex-1 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 text-white font-bold py-3 shadow"
              >
                おわる
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes buddyBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }
      `}</style>
    </main>
  );
}

function Bubble({ m, accent }: { m: BuddyMessage; accent: string }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-sm text-white"
            : "rounded-bl-sm bg-white text-slate-700 border border-white/70"
        }`}
        style={
          isUser
            ? { background: `linear-gradient(135deg, ${accent}, #ff7aa3)` }
            : undefined
        }
      >
        {m.text.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

// API レスポンスの型 (ローカル)
interface BuddySummaryDto {
  parentNote: string;
  mood: "very_low" | "low" | "okay" | "good" | "very_good";
  topics: string[];
  happy: string[];
  worries: string[];
  flags: {
    bullying: boolean;
    school: boolean;
    family: boolean;
    body: boolean;
    prolongedSadness: boolean;
    urgent: boolean;
    urgentReason?: string;
  };
  at: string;
}
