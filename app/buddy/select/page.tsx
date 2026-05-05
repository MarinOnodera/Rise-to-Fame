"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BUDDY_CHARACTERS } from "@/lib/buddy/characters";
import { useBuddy } from "@/lib/buddy/store";
import { FluffyAvatar } from "@/components/buddy/FluffyAvatar";

export default function BuddySelectPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    selectedCharacterId,
    selectCharacter,
    childName,
    setChildName,
  } = useBuddy();

  const [pickedId, setPickedId] = useState<string | null>(
    selectedCharacterId
  );
  const [name, setName] = useState(childName);

  useEffect(() => {
    if (selectedCharacterId) setPickedId(selectedCharacterId);
  }, [selectedCharacterId]);

  function confirm() {
    if (!pickedId) return;
    setChildName(name);
    selectCharacter(pickedId);
    router.push("/buddy/chat");
  }

  if (!hydrated) {
    return <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-100" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50 text-slate-800">
      <div className="mx-auto max-w-md px-5 pt-8 pb-32">
        <Link href="/buddy" className="text-sm text-rose-400">
          ← もどる
        </Link>
        <h1 className="mt-3 text-2xl font-black text-rose-500">
          だれと おしゃべりする？
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          すきな おともだちを ひとり えらんでね
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {BUDDY_CHARACTERS.map((c) => {
            const active = pickedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setPickedId(c.id)}
                className={`relative rounded-3xl p-3 border transition active:scale-95 bg-gradient-to-br ${c.bgClass} ${
                  active
                    ? "border-rose-400 shadow-lg ring-2 ring-rose-300"
                    : "border-white/60 shadow-sm"
                }`}
              >
                <div className="flex justify-center">
                  <FluffyAvatar character={c} size={108} bouncing={active} />
                </div>
                <p className="mt-2 text-center font-bold text-slate-700">
                  {c.name}
                </p>
                <p className="text-[11px] text-center text-slate-500 leading-snug min-h-[2.4em]">
                  {c.vibe.length > 28 ? c.vibe.slice(0, 28) + "…" : c.vibe}
                </p>
                {active && (
                  <div className="absolute top-2 right-2 text-rose-500 text-lg">
                    ♥
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-white/80 p-4 border border-white/60 shadow-sm">
          <label className="text-sm font-bold text-slate-700">
            きみの よびな (なくてもOK)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="たとえば: ゆい / Yuki"
            className="mt-2 w-full rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-slate-700 outline-none focus:border-rose-300"
            maxLength={20}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            ほんとうの なまえじゃなくて だいじょうぶ。
          </p>
        </div>

        <button
          disabled={!pickedId}
          onClick={confirm}
          className={`mt-8 w-full rounded-full font-bold py-4 shadow-lg transition active:scale-95 ${
            pickedId
              ? "bg-gradient-to-r from-rose-400 to-pink-400 text-white"
              : "bg-slate-200 text-slate-400"
          }`}
        >
          このこに きめる
        </button>
      </div>

      <style jsx global>{`
        @keyframes buddyBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
      `}</style>
    </main>
  );
}
