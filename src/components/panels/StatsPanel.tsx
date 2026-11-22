import {
  formatMoney,
  getNetWorth,
  getRealEstateValue,
  getTotalDebt,
} from '../../game/engine';
import type { GameState } from '../../game/types';
import { StatRow } from '../ui';

export function StatsPanel({ s }: { s: GameState }) {
  const hist = s.history;
  const maxW = Math.max(1, ...hist.map((h) => h.worth));
  const minW = Math.min(0, ...hist.map((h) => h.worth));
  const points = hist
    .map((h, i) => `${(i / Math.max(1, hist.length - 1)) * 300},${100 - ((h.worth - minW) / (maxW - minW)) * 95}`)
    .join(' ');
  const monthProfit = s.month.revenue - s.month.expense;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-secondary p-3">
        <h3 className="mb-1 text-sm font-bold">Bảng tài sản</h3>
        <StatRow k="Tiền mặt" v={formatMoney(s.cash)} />
        <StatRow k="Tiết kiệm" v={formatMoney(s.savings)} />
        <StatRow k="Bất động sản" v={formatMoney(getRealEstateValue(s))} />
        <StatRow k="Nợ vay" v={`-${formatMoney(getTotalDebt(s))}`} c="text-destructive" />
        <StatRow k="Tài sản ròng" v={formatMoney(getNetWorth(s))} c="text-primary" />
      </div>

      <div className="rounded-2xl bg-secondary p-3">
        <h3 className="mb-1 text-sm font-bold">Tháng này</h3>
        <StatRow k="Doanh thu" v={formatMoney(s.month.revenue)} c="text-success" />
        <StatRow k="Chi phí" v={formatMoney(s.month.expense)} c="text-destructive" />
        <StatRow
          k="Lợi nhuận"
          v={formatMoney(monthProfit)}
          c={monthProfit >= 0 ? 'text-success' : 'text-destructive'}
        />
        <h3 className="mb-1 mt-2 text-sm font-bold">Tổng cộng</h3>
        <StatRow k="Doanh thu" v={formatMoney(s.total.revenue)} />
        <StatRow k="Chi phí" v={formatMoney(s.total.expense)} />
        <StatRow k="Thuế" v={formatMoney(s.total.tax)} />
      </div>

      <div className="rounded-2xl bg-secondary p-3">
        <h3 className="mb-1 text-sm font-bold">Tài sản ròng theo ngày</h3>
        {hist.length > 1 ? (
          <svg viewBox="0 0 300 100" className="h-28 w-full">
            <polyline points={points} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
          </svg>
        ) : (
          <p className="text-xs text-muted-foreground">Chờ vài ngày để có dữ liệu.</p>
        )}
      </div>

      <div className="rounded-2xl bg-secondary p-3">
        <h3 className="mb-1 text-sm font-bold">Đối thủ</h3>
        {s.npcs
          .filter((n) => n.rival)
          .map((rival) => (
            <StatRow
              key={rival.id}
              k={rival.name}
              v={`${s.plots.filter((p) => p.owner === rival.id).length} lô`}
            />
          ))}
      </div>

      <div className="rounded-2xl bg-secondary p-3 text-xs">
        <h3 className="mb-1 text-sm font-bold">Nhật ký</h3>
        {s.log.slice(0, 15).map((entry, idx) => (
          <div key={idx} className="py-0.5">
            <span className="text-muted-foreground">N{entry.day}</span> {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
