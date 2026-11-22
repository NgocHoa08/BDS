import { useState } from 'react';
import { RATES } from '../../game/constants';
import {
  depositSavings,
  formatMoney,
  getInvestmentDebt,
  getLoanLimit,
  repayLoan,
  takeLoan,
  withdrawSavings,
} from '../../game/engine';
import type { GameState } from '../../game/types';
import { MillionInput, StatRow, type ActionRunner } from '../ui';

export function BankPanel({ s, act }: { s: GameState; act: ActionRunner }) {
  const [term, setTerm] = useState(180);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Vốn góp phải hoàn trả: {formatMoney(getInvestmentDebt(s))}</p>

      <section className="rounded-2xl bg-secondary p-3">
        <h3 className="font-bold">💎 Tiết kiệm · 5%/năm</h3>
        <StatRow k="Số dư" v={formatMoney(s.savings)} c="text-primary" />
        <StatRow k="Lãi mỗi ngày" v={formatMoney((s.savings * RATES.savings) / 365)} c="text-success" />
        <div className="mt-2 space-y-2">
          <MillionInput max={s.cash} label="Gửi" onPick={(amt) => act(() => depositSavings(s, amt), 'Đã gửi tiết kiệm')} />
          <MillionInput max={s.savings} label="Rút" onPick={(amt) => act(() => withdrawSavings(s, amt), 'Đã rút tiền')} />
        </div>
      </section>

      <section className="rounded-2xl bg-secondary p-3">
        <h3 className="font-bold">🏦 Vay vốn kinh doanh · {RATES.loan * 100}%/năm</h3>
        <StatRow k="Hạn mức còn lại" v={formatMoney(getLoanLimit(s))} />
        <div className="my-2 flex gap-1.5">
          {[90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setTerm(d)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                term === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              {d} ngày
            </button>
          ))}
        </div>
        <MillionInput
          max={getLoanLimit(s)}
          label="Vay"
          onPick={(amt) => act(() => takeLoan(s, amt, term), 'Giải ngân thành công 💵')}
        />
      </section>

      <section>
        <h3 className="mb-1.5 font-bold">Khoản vay ({s.loans.length})</h3>
        {s.loans.length === 0 && <p className="text-sm text-muted-foreground">Không có khoản vay.</p>}
        {s.loans.map((loan) => (
          <div key={loan.id} className="mb-2 rounded-xl bg-secondary p-2.5">
            <StatRow
              k={`#${loan.id} · gốc ${formatMoney(loan.principal)}`}
              v={`còn ${formatMoney(loan.remaining)}`}
              c="text-destructive"
            />
            <StatRow
              k="Lãi/ngày · Đáo hạn"
              v={`${formatMoney((loan.remaining * RATES.loan) / 365)} · ${loan.daysLeft} ngày`}
            />
            <div className="mt-2">
              <MillionInput
                max={Math.min(s.cash, loan.remaining)}
                label="Trả"
                onPick={(amt) => act(() => repayLoan(s, loan.id, amt), 'Đã trả nợ')}
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
