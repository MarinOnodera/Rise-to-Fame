"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { TopBar } from "@/components/TopBar";
import { LOAN_OFFERS } from "@/lib/economy";
import type { BankAccount } from "@/lib/types";

export default function Finance() {
  const router = useRouter();
  const { user, takeLoan, repayLoan, setBank } = useGame();
  const [bankName, setBankName] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [accountType, setAccountType] = useState<"普通" | "当座">("普通");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [repay, setRepay] = useState(500);

  useEffect(() => {
    if (!user) router.replace("/");
    else if (!user.agencyId) router.replace("/producer");
  }, [user, router]);

  if (!user?.agencyId) return null;

  const totalRemaining = user.loans.reduce((s, l) => s + l.remaining, 0);
  const formValid =
    bankName.trim().length > 0 &&
    /^\d{3}$/.test(branchNumber) &&
    /^\d{6,8}$/.test(accountNumber) &&
    accountHolder.trim().length > 0;

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
          <div className="text-[11px] opacity-70 mt-1">
            申請済: ¥{user.payoutRequestedJpy.toLocaleString()} ／ 支払済: ¥{user.payoutPaidJpy.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="font-bold mb-1">還元振込先（銀行口座）</div>
          {user.bankAccount ? (
            <div className="text-sm leading-6">
              {user.bankAccount.bankName}（支店{user.bankAccount.branchNumber}）<br />
              {user.bankAccount.accountType} {user.bankAccount.accountNumber}<br />
              名義: {user.bankAccount.accountHolder}
            </div>
          ) : (
            <div className="text-xs opacity-70">未登録</div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input className="input col-span-2" placeholder="銀行名 (例: みずほ銀行)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <input className="input" placeholder="支店番号 (3桁)" maxLength={3} value={branchNumber} onChange={(e) => setBranchNumber(e.target.value.replace(/\D/g, ""))} />
            <select className="input" value={accountType} onChange={(e) => setAccountType(e.target.value as "普通" | "当座")}>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
            <input className="input col-span-2" placeholder="口座番号 (6〜8桁)" maxLength={8} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
            <input className="input col-span-2" placeholder="口座名義 (カタカナ)" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </div>
          <button
            className="btn-ghost mt-2 w-full"
            disabled={!formValid}
            onClick={() => {
              const acc: BankAccount = {
                bankName: bankName.trim(),
                branchNumber,
                accountType,
                accountNumber,
                accountHolder: accountHolder.trim(),
              };
              setBank(acc);
              setBankName(""); setBranchNumber(""); setAccountNumber(""); setAccountHolder("");
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
            残高合計 ♦ {totalRemaining.toLocaleString()}（{user.loans.length}件）
          </div>
          {user.loans.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {user.loans.map((l) => (
                <div key={l.id} className="text-[11px] opacity-80 flex justify-between">
                  <span>{l.offerId}</span>
                  <span>
                    ♦{l.remaining.toLocaleString()} / 期限 {l.dueAt.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {LOAN_OFFERS.map((l) => (
              <button
                key={l.id}
                className="card !p-3 text-left flex justify-between items-center"
                onClick={() => {
                  takeLoan(l.id);
                  alert(`${l.name} から ♦${l.amount} を借りました (返済総額 ♦${l.totalDue} / ${l.dueDays}日)`);
                }}
              >
                <div>
                  <div className="font-bold text-sm">{l.name}</div>
                  <div className="text-[11px] opacity-70">
                    借入 ♦{l.amount} / 返済 ♦{l.totalDue} / {l.dueDays}日以内
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
          <div className="text-[10px] opacity-60 mt-2">
            ※ 期日までに未返済の場合、事務所所有の最人気グループが管理側に吸収されます。
          </div>
        </div>
      </div>
    </main>
  );
}
