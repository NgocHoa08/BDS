import { useState } from 'react';
import { Briefcase, Building2, CheckCircle2, PauseCircle, PlayCircle, UserMinus, UserPlus } from 'lucide-react';
import { BUILDINGS, REGION_NAMES, STAFF_LIST } from '../../game/constants';
import {
  fireStaff,
  formatMoney,
  getActiveInvestment,
  getBulkUpgradeCandidates,
  getDailyIncome,
  getDailyStaffSalary,
  getEffectiveBizTaxRate,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  hasStaff,
  hireStaff,
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
  const [tab, setTab] = useState<'ops' | 'staff'>('ops');
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
  const dailyStaffSalary = getDailyStaffSalary(s);
  const hiredCount = s.staff?.length ?? 0;
  const npcListings = s.plots.filter((p) => p.forSale && p.owner && p.owner !== 'me').slice(0, 12);

  return (
    <div className="space-y-3">
      {/* Top Tabs: Khai thác | Đội ngũ quản lý */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('ops')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'ops'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 size={14} /> Khai thác ({allBuilt.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('staff')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'staff'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase size={14} /> Đội ngũ quản lý ({hiredCount}/{STAFF_LIST.length})
        </button>
      </div>

      {/* TAB 1: OPERATIONS */}
      {tab === 'ops' && (
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
              <div className="text-xs text-muted-foreground">Chi phí vận hành/ngày</div>
              <div className="font-bold text-destructive">{formatMoney(totalDailyMaint + dailyStaffSalary)}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Bảo trì {formatMoney(totalDailyMaint)}
                {dailyStaffSalary > 0 ? ` · Lương ${formatMoney(dailyStaffSalary)}` : ''}
              </div>
            </div>
          </div>

          {/* Active Management Perks Banner */}
          {hiredCount > 0 && (
            <button
              type="button"
              onClick={() => setTab('staff')}
              className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-left text-[11px]"
            >
              <span className="font-bold text-primary">👔 Đội ngũ:</span>
              {hasStaff(s, 'architect') && <span className="rounded bg-background/60 px-1.5 py-0.5">📐 -25% ngày xây</span>}
              {hasStaff(s, 'tax_expert') && <span className="rounded bg-background/60 px-1.5 py-0.5">🧾 Thuế KD 5%</span>}
              {hasStaff(s, 'super_broker') && (
                <span className="rounded bg-background/60 px-1.5 py-0.5">🤝 100% thuê &amp; -10% đất</span>
              )}
            </button>
          )}

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
      )}

      {/* TAB 2: MANAGEMENT TEAM (STAFF) */}
      {tab === 'staff' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/15 via-secondary/70 to-secondary/50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-primary">👔 Ban Điều Hành BDSNH</span>
              <span className="font-semibold">
                Đang tuyển: <b>{hiredCount}/{STAFF_LIST.length}</b>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                Tổng lương/ngày: <b className="text-amber-300">{formatMoney(dailyStaffSalary)}</b>
              </span>
              <span>
                Thuế KD hiện tại: <b className="text-success">{Math.round(getEffectiveBizTaxRate(s) * 100)}%</b>
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {STAFF_LIST.map((st) => {
              const hired = hasStaff(s, st.id);
              return (
                <article
                  key={st.id}
                  className={`rounded-2xl border p-3 text-xs transition ${
                    hired ? 'border-emerald-500/45 bg-emerald-950/20' : 'border-border bg-secondary/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/60 text-xl">
                        {st.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-black">
                          <span>{st.name}</span>
                          {hired && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              <CheckCircle2 size={10} /> Đang làm
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{st.role}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-primary">{formatMoney(st.hireCost)}</div>
                      <div className="text-[10px] text-muted-foreground">Lương {formatMoney(st.dailySalary)}/ngày</div>
                    </div>
                  </div>

                  <ul className="mt-2.5 space-y-1 rounded-xl bg-background/45 px-2.5 py-2 text-[11px] text-foreground/90">
                    {st.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-1.5">
                        <span className="text-primary">✦</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2.5">
                    {hired ? (
                      <button
                        type="button"
                        onClick={() =>
                          act(() => fireStaff(s, st.id), `Đã ngừng hợp đồng với ${st.name}.`)
                        }
                        className="btn-ghost flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <UserMinus size={14} /> Sa thải (ngừng trả lương)
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={s.cash < st.hireCost}
                        onClick={() =>
                          act(() => hireStaff(s, st.id), `${st.icon} Đã tuyển ${st.name}!`)
                        }
                        className="btn-gold flex w-full items-center justify-center gap-1.5 text-xs font-black"
                      >
                        <UserPlus size={14} /> Tuyển {st.name} ({formatMoney(st.hireCost)})
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
