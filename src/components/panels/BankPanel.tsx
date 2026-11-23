import { useState } from 'react';
import { Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import { RATES, STOCK_LIST } from '../../game/constants';
import {
  buyStockByBudget,
  depositSavings,
  ensureStockMarket,
  formatMoney,
  getInvestmentDebt,
  getLoanLimit,
  getStockPortfolioValue,
  repayLoan,
  sellStockByFraction,
  takeLoan,
  withdrawSavings,
} from '../../game/engine';
import type { GameState } from '../../game/types';
import { MillionInput, StatRow, type ActionRunner } from '../ui';

function StockSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const w = 78;
  const h = 24;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <polyline
        fill="none"
        stroke={up ? '#34d399' : '#f87171'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export function BankPanel({ s, act }: { s: GameState; act: ActionRunner }) {
  const [tab, setTab] = useState<'stocks' | 'bank'>('stocks');
  const [term, setTerm] = useState(180);

  const stocks = ensureStockMarket(s);
  const portfolioVal = getStockPortfolioValue(s);
  const totalCost = STOCK_LIST.reduce((sum, def) => {
    const h = stocks[def.id];
    return sum + (h ? h.shares * h.avgCost : 0);
  }, 0);
  const totalPnl = portfolioVal - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Mode Switcher: Chứng khoán BĐS | Tiết kiệm & Vay */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('stocks')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'stocks'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp size={14} /> Chứng khoán BĐS
        </button>
        <button
          type="button"
          onClick={() => setTab('bank')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'bank'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Landmark size={14} /> Tiết kiệm &amp; Vay
        </button>
      </div>

      {/* TAB 1: LIVE REAL-ESTATE STOCK MARKET */}
      {tab === 'stocks' && (
        <div className="space-y-3">
          {/* Portfolio Overview */}
          <div className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/15 via-secondary/75 to-secondary/50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Danh mục cổ phiếu</div>
                <div className="text-lg font-black text-primary">{formatMoney(portfolioVal)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lời / Lỗ tạm tính</div>
                <div
                  className={`text-sm font-black ${
                    totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {totalPnl >= 0 ? '+' : ''}
                  {formatMoney(totalPnl)}
                  {totalCost > 0 && ` (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%)`}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Tiền mặt: <b className="text-foreground">{formatMoney(s.cash)}</b></span>
              <span>Cổ tức tự động mỗi 15 ngày · Giá nhảy mỗi ngày</span>
            </div>
          </div>

          {/* 6 Live Stocks */}
          <div className="space-y-2">
            {STOCK_LIST.map((def) => {
              const h = stocks[def.id];
              const diffPct = h.prevPrice > 0 ? ((h.price - h.prevPrice) / h.prevPrice) * 100 : 0;
              const up = diffPct >= 0;
              const val = h.shares * h.price;
              const pnl = h.shares > 0 ? (h.price - h.avgCost) * h.shares : 0;
              const pnlPct = h.avgCost > 0 ? ((h.price - h.avgCost) / h.avgCost) * 100 : 0;

              return (
                <article key={def.id} className="space-y-2 rounded-2xl border border-border bg-secondary/75 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background/60 text-base">
                        {def.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <b className="text-sm text-primary">{def.id}</b>
                          <span className="truncate font-semibold">{def.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {def.sector} · <span className="text-foreground/80">{def.riskLabel}</span>
                          {def.dividendRate > 0 ? ` · Cổ tức ${(def.dividendRate * 100).toFixed(1)}%` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <StockSparkline data={h.history} up={up} />
                      <div className="text-right">
                        <div className="font-black tabular-nums">{formatMoney(h.price)}</div>
                        <div
                          className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                            up ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {up ? '+' : ''}
                          {diffPct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {h.shares > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-background/50 px-2.5 py-1 text-[11px]">
                      <span>
                        Đang giữ: <b>{h.shares.toLocaleString('vi-VN')} cp</b> ({formatMoney(val)})
                      </span>
                      <span className={`font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}
                        {formatMoney(pnl)} ({pnlPct >= 0 ? '+' : ''}
                        {pnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}

                  {/* Quick Buy & Sell buttons */}
                  <div className="grid grid-cols-5 gap-1">
                    <button
                      type="button"
                      disabled={s.cash < h.price}
                      onClick={() =>
                        act(
                          () => buyStockByBudget(s, def.id, Math.max(h.price, s.cash * 0.25)).error,
                          `📈 Đã mua cổ phiếu ${def.id}!`
                        )
                      }
                      className="rounded-lg bg-emerald-500/20 py-1.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-35"
                    >
                      Mua 25%
                    </button>
                    <button
                      type="button"
                      disabled={s.cash < h.price}
                      onClick={() =>
                        act(
                          () => buyStockByBudget(s, def.id, Math.max(h.price, s.cash * 0.5)).error,
                          `📈 Đã mua cổ phiếu ${def.id}!`
                        )
                      }
                      className="rounded-lg bg-emerald-500/25 py-1.5 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/35 disabled:opacity-35"
                    >
                      Mua 50%
                    </button>
                    <button
                      type="button"
                      disabled={s.cash < h.price}
                      onClick={() =>
                        act(
                          () => buyStockByBudget(s, def.id, s.cash).error,
                          `🚀 All-in cổ phiếu ${def.id}!`
                        )
                      }
                      className="rounded-lg bg-emerald-600/35 py-1.5 text-[10px] font-black text-emerald-200 transition hover:bg-emerald-600/50 disabled:opacity-35"
                    >
                      All-in
                    </button>
                    <button
                      type="button"
                      disabled={h.shares <= 0}
                      onClick={() =>
                        act(() => sellStockByFraction(s, def.id, 0.5).error, `💰 Đã chốt lời 50% ${def.id}!`)
                      }
                      className="rounded-lg bg-red-500/20 py-1.5 text-[10px] font-bold text-red-300 transition hover:bg-red-500/30 disabled:opacity-35"
                    >
                      Bán 50%
                    </button>
                    <button
                      type="button"
                      disabled={h.shares <= 0}
                      onClick={() =>
                        act(() => sellStockByFraction(s, def.id, 1).error, `💰 Đã bán hết ${def.id}!`)
                      }
                      className="rounded-lg bg-red-500/30 py-1.5 text-[10px] font-black text-red-200 transition hover:bg-red-500/45 disabled:opacity-35"
                    >
                      Bán hết
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SAVINGS & LOANS */}
      {tab === 'bank' && (
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
      )}
    </div>
  );
}
