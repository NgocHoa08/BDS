import { BUILDINGS, REGION_NAMES } from '../../game/constants';
import {
  formatMoney,
  getDailyIncome,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  toggleRentalListing,
} from '../../game/engine';
import type { GameState } from '../../game/types';
import type { ActionRunner } from '../ui';

export function BusinessPanel({
  s,
  act,
  onPick,
}: {
  s: GameState;
  act: ActionRunner;
  onPick: (plotId: number) => void;
}) {
  const built = getOwnedPlots(s).filter((p) => p.b);
  const totalDailyIncome = built.reduce((sum, p) => sum + getDailyIncome(s, p), 0);
  const totalDailyMaint = built.reduce(
    (sum, p) => sum + (!p.b || p.b.buildLeft ? 0 : BUILDINGS[p.b.type].maint * p.b.level),
    0
  );
  const npcListings = s.plots.filter((p) => p.forSale && p.owner && p.owner !== 'me').slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary p-2.5">
          <div className="text-xs text-muted-foreground">Thu nhập/ngày</div>
          <div className="font-bold text-success">{formatMoney(totalDailyIncome)}</div>
        </div>
        <div className="rounded-xl bg-secondary p-2.5">
          <div className="text-xs text-muted-foreground">Bảo trì/ngày</div>
          <div className="font-bold text-destructive">{formatMoney(totalDailyMaint)}</div>
        </div>
      </div>

      <h3 className="text-sm font-bold">Công trình đang khai thác</h3>
      {built.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có công trình. Mua đất rồi xây dựng để có thu nhập.</p>
      )}
      {built.map((plot) => {
        const b = plot.b!;
        const def = BUILDINGS[b.type];
        return (
          <div key={plot.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-2.5 text-xs">
            <button className="text-left" onClick={() => onPick(plot.id)}>
              <b>{def.name}</b> c{b.level} · #{plot.id}
              <br />
              <span className="text-muted-foreground">
                {b.buildLeft
                  ? `Đang xây (${b.buildLeft} ngày)`
                  : def.rental
                    ? b.rented
                      ? '✅ Đã có khách thuê'
                      : b.listed
                        ? '⏳ Đang tìm khách'
                        : 'Chưa cho thuê'
                    : '🛒 Đang kinh doanh'}
              </span>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-success">{formatMoney(getDailyIncome(s, plot))}</span>
              {def.rental && !b.buildLeft && (
                <button className="btn-ghost px-2 py-1 text-[10px]" onClick={() => act(() => toggleRentalListing(plot))}>
                  {b.listed ? 'Ngừng' : 'Cho thuê'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <h3 className="pt-1 text-sm font-bold">🏷 Đất NPC đang rao bán</h3>
      {npcListings.map((plot) => (
        <button
          key={plot.id}
          onClick={() => onPick(plot.id)}
          className="flex w-full justify-between rounded-xl bg-secondary p-2.5 text-left text-xs hover:brightness-110"
        >
          <span>
            #{plot.id} · {REGION_NAMES[plot.region]} · {plot.area}m² · {getNpcById(s, plot.owner!)?.name ?? ''}
          </span>
          <span className="font-bold text-primary">{formatMoney(getPlotTotalValue(s, plot))}</span>
        </button>
      ))}
    </div>
  );
}
