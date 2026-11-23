import { useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { BUILDINGS, REGION_NAMES } from '../../game/constants';
import {
  formatMoney,
  getActiveInvestment,
  getBulkUpgradeCandidates,
  getDailyIncome,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  setBulkBusinessPaused,
  toggleBusinessPause,
  toggleRentalListing,
} from '../../game/engine';
import type { GameState, RegionId } from '../../game/types';
import type { ActionRunner } from '../ui';

export function BusinessPanel({
  s,
  act,
  onPick,
  onBulkUpgrade,
}: {
  s: GameState;
  act: ActionRunner;
  onPick: (plotId: number) => void;
  onBulkUpgrade?: () => void;
}) {
  const [regionFilter, setRegionFilter] = useState<RegionId | 'all'>('all');

  const allBuilt = getOwnedPlots(s).filter((p) => p.b);
  const completedBuilt = allBuilt.filter((p) => p.b && p.b.buildLeft === 0);
  const pausedCount = completedBuilt.filter((p) => p.b?.paused).length;
  const activeCount = completedBuilt.length - pausedCount;

  const built = regionFilter === 'all' ? allBuilt : allBuilt.filter((p) => p.region === regionFilter);
  const regionsWithBuildings = [...new Set(allBuilt.map((p) => p.region))];

  const filteredCompleted = built.filter((p) => p.b && p.b.buildLeft === 0);
  const filteredPausedCount = filteredCompleted.filter((p) => p.b?.paused).length;
  const filteredPausableCount = filteredCompleted.filter(
    (p) => !p.b?.paused && !getActiveInvestment(s, p.id)
  ).length;

  const upgradeableCount = getBulkUpgradeCandidates(s).length;
  const totalDailyIncome = allBuilt.reduce((sum, p) => sum + getDailyIncome(s, p), 0);
  const totalDailyMaint = allBuilt.reduce(
    (sum, p) => sum + (!p.b || p.b.buildLeft || p.b.paused ? 0 : BUILDINGS[p.b.type].maint * p.b.level),
    0
  );
  const npcListings = s.plots.filter((p) => p.forSale && p.owner && p.owner !== 'me').slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary p-2.5">
          <div className="text-xs text-muted-foreground">Thu nhập/ngày</div>
          <div className="font-bold text-success">{formatMoney(totalDailyIncome)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Hoạt động: <b className="text-foreground">{activeCount}</b>
            {pausedCount > 0 && (
              <>
                {' · '}
                <span className="text-amber-400">Tạm ngừng: {pausedCount}</span>
              </>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-secondary p-2.5">
          <div className="text-xs text-muted-foreground">Bảo trì/ngày</div>
          <div className="font-bold text-destructive">{formatMoney(totalDailyMaint)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Tạm ngừng KD = <b>0đ</b> bảo trì
          </div>
        </div>
      </div>

      {/* Bulk Pause / Resume + Region Filter */}
      {completedBuilt.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
          {regionsWithBuildings.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRegionFilter('all')}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  regionFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                Tất cả ({allBuilt.length})
              </button>
              {regionsWithBuildings.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegionFilter(reg)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    regionFilter === reg
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {REGION_NAMES[reg]} ({allBuilt.filter((p) => p.region === reg).length})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={filteredPausableCount === 0}
              onClick={() =>
                act(() => {
                  const res = setBulkBusinessPaused(s, true, regionFilter);
                  return res.error;
                }, `⏸ Đã tạm ngừng kinh doanh ${filteredPausableCount} công trình!`)
              }
              className="btn-ghost flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-amber-300 disabled:opacity-40"
            >
              <PauseCircle size={13} /> Tạm ngừng ({filteredPausableCount})
            </button>
            <button
              type="button"
              disabled={filteredPausedCount === 0}
              onClick={() =>
                act(() => {
                  const res = setBulkBusinessPaused(s, false, regionFilter);
                  return res.error;
                }, `▶ Đã mở lại kinh doanh ${filteredPausedCount} công trình!`)
              }
              className="btn-ghost flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-emerald-400 disabled:opacity-40"
            >
              <PlayCircle size={13} /> Mở lại ({filteredPausedCount})
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Công trình đang khai thác</h3>
        {upgradeableCount >= 1 && onBulkUpgrade && (
          <button type="button" onClick={onBulkUpgrade} className="btn-gold px-2.5 py-1 text-[11px]">
            ⬆ Nâng hàng loạt ({upgradeableCount})
          </button>
        )}
      </div>

      {built.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có công trình. Mua đất rồi xây dựng để có thu nhập.</p>
      )}
      {built.map((plot) => {
        const b = plot.b!;
        const def = BUILDINGS[b.type];
        const isPaused = Boolean(b.paused);
        const hasInv = Boolean(getActiveInvestment(s, plot.id));

        return (
          <div
            key={plot.id}
            className={`flex items-center justify-between gap-2 rounded-xl p-2.5 text-xs ${
              isPaused ? 'border border-amber-500/35 bg-secondary/50 opacity-85' : 'bg-secondary'
            }`}
          >
            <button className="min-w-0 text-left" onClick={() => onPick(plot.id)}>
              <div className="truncate">
                <b>{def.name}</b> c{b.level} · #{plot.id}
              </div>
              <span className="text-muted-foreground">
                {b.buildLeft
                  ? `Đang xây (${b.buildLeft} ngày)`
                  : isPaused
                    ? '⏸ Đang tạm ngừng · 0đ bảo trì'
                    : def.rental
                      ? b.rented
                        ? '✅ Đã có khách thuê'
                        : b.listed
                          ? '⏳ Đang tìm khách'
                          : 'Chưa cho thuê'
                      : '🛒 Đang kinh doanh'}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`font-bold ${isPaused ? 'text-amber-400' : 'text-success'}`}>
                {isPaused ? '0 đ' : formatMoney(getDailyIncome(s, plot))}
              </span>
              {!b.buildLeft && (
                <>
                  {def.rental && !isPaused && (
                    <button
                      className="btn-ghost px-2 py-1 text-[10px]"
                      onClick={() => act(() => toggleRentalListing(plot))}
                    >
                      {b.listed ? 'Ngừng thuê' : 'Cho thuê'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!isPaused && hasInv}
                    title={
                      !isPaused && hasInv
                        ? 'Không thể tạm ngừng công trình đang có hợp đồng đầu tư'
                        : isPaused
                          ? 'Mở lại kinh doanh'
                          : 'Tạm ngừng kinh doanh (0đ bảo trì)'
                    }
                    onClick={() =>
                      act(
                        () => toggleBusinessPause(s, plot),
                        isPaused ? '▶ Đã mở lại kinh doanh!' : '⏸ Đã tạm ngừng kinh doanh!',
                        plot
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition disabled:opacity-35 ${
                      isPaused
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                    }`}
                  >
                    {isPaused ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
                    <span>{isPaused ? 'Mở lại' : 'Ngừng'}</span>
                  </button>
                </>
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
