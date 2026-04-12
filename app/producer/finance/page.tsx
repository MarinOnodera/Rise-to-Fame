"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { LOAN_OFFERS } from "@/lib/economy";

export default function Finance() {
  const router = useRouter();
  const { user, takeLoan, repayLoan, setBank } = useGame();
  const [bank, setBankField] = useState("");
  const [holder, setHolder] = useState("");
  const [last4, setLast4] = useState("");
  const [repay, setRepay] = useState(500);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  return (
    <main className="pb-24">
      <TopBar title="ファイナンス" back="/producer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="card">
          <div className="text-xs opacity-70">還元額（累積・表示のみ）</div>
          <div className="text-3xl font-black text-kgold">
            ¥{user.payoutEarnedJpy.toLocaleString()}
          </div>
          <div className="text-[11px] opacity-70 mt-1">
            ファンが課金して所属グループに使った金額の 20% が事務所に還元されます。
          </div>
        </div>

        <div className="card">
          <div className="font-bold mb-1">還元振込先（銀行口座）</div>
          {user.bankAccount ? (
            <div className="text-sm">
              {user.bankAccount.bank} / {user.bankAccount.holder} / ****{user.bankAccount.last4}
            </div>
          ) : (
            <div className="text-xs opacity-70">未登録</div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input className="input" placeholder="銀行名" value={bank} onChange={(e) => setBankField(e.target.value)} />
            <input className="input" placeholder="名義" value={holder} onChange={(e) => setHolder(e.target.value)} />
            <input className="input col-span-2" placeholder="口座下4桁" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} />
          </div>
          <button
            className="btn-ghost mt-2 w-full"
            disabled={!bank || !holder || last4.length !== 4}
            onClick={() => {
              setBank(bank, holder, last4);
              setBankField(""); setHolder(""); setLast4("");
              alert("口座を登録しました（本番はKYC/認証が必要です）");
            }}
          >
            口座を登録
          </button>
          <div className="text-[10px] opacity-60 mt-2">
            ※ このプロトタイプは実際に振込処理を行いません。本番運用では
            本人確認 (KYC)、資金決済法、送金API (Stripe Connect / GMO 等) が必要です。
          </div>
        </div>

        <div className="card">
          <div className="font-bold mb-1">借入</div>
          <div className="text-xs opacity-70 mb-2">
            現在の借入残高 ♦ {user.loanBalance.toLocaleString()}
          </div>
          <div className="flex flex-col gap-2">
            {LOAN_OFFERS.map((l) => (
              <button
                key={l.id}
                className="card !p-3 text-left flex justify-between items-center"
                onClick={() => {
                  takeLoan(l.amount);
                  alert(`${l.name} から ♦${l.amount} を借りました`);
                }}
              >
                <div>
                  <div className="font-bold text-sm">{l.name}</div>
                  <div className="text-[11px] opacity-70">
                    借入 ♦{l.amount} / 週次 ♦{l.weeklyFee}
                  </div>
                </div>
                <span className="chip">借りる</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2 items-center">
            <input
              type="number"
              className="input"
              value={repay}
              onChange={(e) => setRepay(Number(e.target.value))}
            />
            <button
              className="btn-gold"
              onClick={() => {
                if (repayLoan(repay)) alert(`♦${repay} 返済`);
                else alert("返済できません");
              }}
            >
              返済
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
