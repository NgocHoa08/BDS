import { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, CheckSquare, Hammer, Layers, Square } from 'lucide-react';
import { BUILDABLE_TYPES, BUILDINGS, REGION_NAMES } from '../../game/constants';
import {
  buildBulkOnPlots,
  buildOnPlot,
  canBuildInPlot,
  checkForeignPermission,
  formatMoney,
  getActiveInvestment,
  getBuildPlotCost,
  getBulkUpgradeCandidates,
  getDailyIncome,
  getOwnedPlots,
  getUpgradePlotCost,
  upgradeBulkPlots,
} from '../../game/engine';
import { pushFloatingFx } from '../../game/store';
import type { BuildingType, GameState, Plot, RegionId } from '../../game/types';
import type { ActionRunner } from '../ui';

const CATEGORIES = [
  'Tất cả',
  'Nhà ở',
  'Thương mại',
  'Dịch vụ',
  'Giải trí',
  'Văn phòng',
  'Du lịch',
  'Công nghiệp',
  'Nông nghiệp',
  'Y tế & Giáo dục',
];

export type BuildPanelTab = 'single' | 'bulk_build' | 'bulk_upgrade';

export function BuildPanel({
  s,
  p,
  act,
  initialTab = 'single',
}: {
  s: GameState;
  p: Plot | null;
  act: ActionRunner;
  initialTab?: BuildPanelTab;
}) {
  const canBuildHere = Boolean(p && p.owner === 'me' && !p.b && p.kind === 'land');
  const [tab, setTab] = useState<BuildPanelTab>(initialTab);
  const [cat, setCat] = useState('Tất cả');

  // Bulk Build state
  const [bulkRegion, setBulkRegion] = useState<RegionId | 'all'>('all');
  const [manualBuildPick, setManualBuildPick] = useState(false);
  const [pickedBuildIds, setPickedBuildIds] = useState<number[]>([]);

  // Bulk Upgrade state
  const [upgRegion, setUpgRegion] = useState<RegionId | 'all'>('all');
  const [upgLevel, setUpgLevel] = useState<'all' | 1 | 2>('all');
  const [upgType, setUpgType] = useState<BuildingType | 'all'>('all');
  const [excludedUpgIds, setExcludedUpgIds] = useState<number[]>([]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const ownedPlots = getOwnedPlots(s);
  const emptyOwnedPlots = useMemo(
    () =>
      ownedPlots.filter(
        (pl) =>
          pl.kind === 'land' &&
          !pl.b &&
          !getActiveInvestment(s, pl.id) &&
          !checkForeignPermission(s, pl)
      ),
    [ownedPlots, s]
  );

  const emptyByRegion = useMemo(() => {
    const map = new Map<RegionId, Plot[]>();
    for (const pl of emptyOwnedPlots) {
      const arr = map.get(pl.region) ?? [];
      arr.push(pl);
      map.set(pl.region, arr);
    }
    return map;
  }, [emptyOwnedPlots]);

  const filteredEmptyPlots = useMemo(
    () =>
      bulkRegion === 'all' ? emptyOwnedPlots : emptyOwnedPlots.filter((pl) => pl.region === bulkRegion),
    [emptyOwnedPlots, bulkRegion]
  );

  const activeBuildPool = useMemo(() => {
    if (!manualBuildPick) return filteredEmptyPlots;
    const pickedSet = new Set(pickedBuildIds);
    return filteredEmptyPlots.filter((pl) => pickedSet.has(pl.id));
  }, [manualBuildPick, filteredEmptyPlots, pickedBuildIds]);

  const allUpgradeable = useMemo(() => getBulkUpgradeCandidates(s, 'all', 'all', 'all'), [s]);

  const upgByRegion = useMemo(() => {
    const map = new Map<RegionId, number>();
    for (const pl of allUpgradeable) {
      map.set(pl.region, (map.get(pl.region) ?? 0) + 1);
    }
    return map;
  }, [allUpgradeable]);

  const upgTypesAvailable = useMemo(() => {
    const set = new Set<BuildingType>();
    for (const pl of allUpgradeable) {
      if (pl.b && (upgRegion === 'all' || pl.region === upgRegion)) {
        set.add(pl.b.type);
      }
    }
    return [...set];
  }, [allUpgradeable, upgRegion]);

  const filteredUpgradeable = useMemo(
    () => getBulkUpgradeCandidates(s, upgRegion, upgType, upgLevel),
    [s, upgRegion, upgType, upgLevel]
  );

  const excludedSet = useMemo(() => new Set(excludedUpgIds), [excludedUpgIds]);
  const selectedUpgradeable = useMemo(
    () => filteredUpgradeable.filter((pl) => !excludedSet.has(pl.id)),
    [filteredUpgradeable, excludedSet]
  );

  const upgradeBudgetCalc = useMemo(() => {
    let cashLeft = s.cash;
    let affordableCount = 0;
    let affordableCost = 0;
    let totalSelectedCost = 0;
    for (const pl of selectedUpgradeable) {
      const c = getUpgradePlotCost(pl);
      totalSelectedCost += c;
      if (cashLeft >= c) {
        cashLeft -= c;
        affordableCount += 1;
        affordableCost += c;
      }
    }
    return { affordableCount, affordableCost, totalSelectedCost };
  }, [selectedUpgradeable, s.cash]);

  const singleList = BUILDABLE_TYPES.filter((t) => (!canBuildHere || (p ? canBuildInPlot(p, t) : true))).filter(
    (t) => cat === 'Tất cả' || BUILDINGS[t].category === cat
  );

  const bulkBuildList = BUILDABLE_TYPES.filter(
    (t) => cat === 'Tất cả' || BUILDINGS[t].category === cat
  );

  const toggleBuildPick = (id: number) => {
    setPickedBuildIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleUpgPick = (id: number) => {
    setExcludedUpgIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('single')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'single' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Hammer size={13} /> Xây 1 lô
        </button>
        <button
          type="button"
          onClick={() => setTab('bulk_build')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'bulk_build'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers size={13} /> Xây loạt ({emptyOwnedPlots.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('bulk_upgrade')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'bulk_upgrade'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowUpCircle size={13} /> Nâng loạt ({allUpgradeable.length})
        </button>
      </div>

      {/* TAB 1: SINGLE PLOT BUILD */}
      {tab === 'single' && (
        <div>
          {!canBuildHere ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary p-2.5 text-xs">
              <span>
                Chọn một lô đất trống <b>của bạn</b> trên bản đồ để xây, hoặc chuyển sang <b>Xây loạt</b>.
              </span>
              {emptyOwnedPlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('bulk_build')}
                  className="btn-gold shrink-0 px-2.5 py-1 text-[11px]"
                >
                  🏗 Xây loạt ({emptyOwnedPlots.length} lô)
                </button>
              )}
            </div>
          ) : (
            <p className="mb-2 text-sm">
              Xây trên lô #{p!.id} ({REGION_NAMES[p!.region]}). Phí giấy phép 2%.
            </p>
          )}

          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  cat === c
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {singleList.map((type) => {
              const def = BUILDINGS[type];
              const allowed = !p || canBuildInPlot(p, type);
              const plotCost = p ? getBuildPlotCost(p, type) : def.cost * 1.02;
              return (
                <div key={type} className={`rounded-xl bg-secondary p-2.5 ${allowed ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <b>
                      {def.name}{' '}
                      <span className="text-[10px] font-normal text-muted-foreground">· {def.category}</span>
                    </b>
                    <span className="text-sm font-bold text-primary">{formatMoney(def.cost)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    ⏱ {def.days} ngày · 🔧 {formatMoney(def.maint)}/ngày · 💵 ~{formatMoney(def.income)}/ngày ·{' '}
                    {def.rental ? 'Cho thuê' : 'Kinh doanh'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Khu vực: {def.regions.map((r) => REGION_NAMES[r]).join(', ')}
                  </div>
                  {canBuildHere && p && (
                    <button
                      disabled={!allowed || s.cash < plotCost}
                      className="btn-gold mt-2 w-full text-sm"
                      onClick={() => act(() => buildOnPlot(s, p, type), 'Khởi công! 🏗', p)}
                    >
                      {allowed ? `Xây tại đây (${formatMoney(plotCost)})` : 'Không đúng quy hoạch'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BULK BUILD */}
      {tab === 'bulk_build' && (
        <div className="space-y-3">
          {emptyOwnedPlots.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Bạn chưa có lô đất trống nào sẵn sàng xây dựng. Hãy mua thêm đất trên bản đồ trước nhé!
            </div>
          ) : (
            <>
              {/* Region filter bar */}
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">1. Chọn khu vực đất trống</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualBuildPick) {
                        setPickedBuildIds(filteredEmptyPlots.map((pl) => pl.id));
                      }
                      setManualBuildPick((prev) => !prev);
                    }}
                    className="rounded-lg bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:brightness-110"
                  >
                    {manualBuildPick ? 'Chế độ tự động theo vùng' : 'Tick chọn từng lô'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRegion('all');
                      if (manualBuildPick) setPickedBuildIds(emptyOwnedPlots.map((pl) => pl.id));
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      bulkRegion === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả ({emptyOwnedPlots.length})
                  </button>
                  {[...emptyByRegion.entries()].map(([reg, arr]) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => {
                        setBulkRegion(reg);
                        if (manualBuildPick) setPickedBuildIds(arr.map((pl) => pl.id));
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        bulkRegion === reg
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {REGION_NAMES[reg]} ({arr.length})
                    </button>
                  ))}
                </div>

                {/* Optional per-plot checkbox grid */}
                {manualBuildPick && (
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Đã chọn <b className="text-primary">{activeBuildPool.length}</b>/{filteredEmptyPlots.length} lô
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPickedBuildIds(filteredEmptyPlots.map((pl) => pl.id))}
                          className="font-semibold text-primary hover:underline"
                        >
                          Chọn hết
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickedBuildIds([])}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3">
                      {filteredEmptyPlots.map((pl) => {
                        const checked = pickedBuildIds.includes(pl.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => toggleBuildPick(pl.id)}
                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] transition ${
                              checked
                                ? 'border-primary/60 bg-primary/15 text-foreground'
                                : 'border-border/60 bg-background/40 text-muted-foreground'
                            }`}
                          >
                            {checked ? (
                              <CheckSquare size={13} className="shrink-0 text-primary" />
                            ) : (
                              <Square size={13} className="shrink-0" />
                            )}
                            <span className="truncate">
                              <b>#{pl.id}</b> · {REGION_NAMES[pl.region]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Category filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      cat === c
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Bulk building options */}
              <div className="space-y-2">
                {bulkBuildList.map((type) => {
                  const def = BUILDINGS[type];
                  const eligible = activeBuildPool.filter((pl) => canBuildInPlot(pl, type));
                  if (eligible.length === 0) return null;

                  let cashLeft = s.cash;
                  let canAfford = 0;
                  let totalCost = 0;
                  for (const pl of eligible) {
                    const c = getBuildPlotCost(pl, type);
                    if (cashLeft >= c) {
                      cashLeft -= c;
                      canAfford += 1;
                      totalCost += c;
                    }
                  }

                  return (
                    <div key={type} className="rounded-xl bg-secondary p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <b>
                          {def.name}{' '}
                          <span className="text-[10px] font-normal text-muted-foreground">· {def.category}</span>
                        </b>
                        <span className="text-sm font-bold text-primary">{formatMoney(def.cost)}/lô</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        ⏱ {def.days} ngày · 💵 ~{formatMoney(def.income)}/ngày · Hợp quy hoạch:{' '}
                        <b className="text-foreground">
                          {eligible.length}/{activeBuildPool.length} lô
                        </b>
                      </div>
                      <button
                        type="button"
                        disabled={canAfford === 0}
                        className="btn-gold mt-2 w-full text-xs font-black"
                        onClick={() => {
                          act(() => {
                            const res = buildBulkOnPlots(
                              s,
                              eligible.map((pl) => pl.id),
                              type
                            );
                            if (res.error) return res.error;
                            res.builtIds.slice(0, 12).forEach((id) => {
                              const pl = s.plots[id];
                              if (pl) pushFloatingFx(pl.x, pl.y, 'Khởi công! 🏗', '#ffd166');
                            });
                            return null;
                          }, `🏗 Khởi công hàng loạt ${canAfford} ${def.name} (-${formatMoney(totalCost)})!`);
                        }}
                      >
                        {canAfford > 0
                          ? `🏗 Xây hàng loạt ${canAfford}${canAfford < eligible.length ? `/${eligible.length}` : ''} lô (${formatMoney(totalCost)})`
                          : `Chưa đủ tiền (cần tối thiểu ${formatMoney(getBuildPlotCost(eligible[0], type))})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: BULK UPGRADE */}
      {tab === 'bulk_upgrade' && (
        <div className="space-y-3">
          {allUpgradeable.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Chưa có công trình nào sẵn sàng nâng cấp (công trình phải xây xong, dưới cấp 3 và không đang trong hợp đồng
              đầu tư).
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="font-bold text-primary">Lọc công trình nâng cấp</div>

                {/* Region chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUpgRegion('all')}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      upgRegion === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả ({allUpgradeable.length})
                  </button>
                  {[...upgByRegion.entries()].map(([reg, count]) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setUpgRegion(reg)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        upgRegion === reg
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {REGION_NAMES[reg]} ({count})
                    </button>
                  ))}
                </div>

                {/* Level & Building Type filters */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    ['all', 'Mọi cấp'],
                    [1, 'Cấp 1 → 2'],
                    [2, 'Cấp 2 → 3'],
                  ] as const).map(([lv, label]) => (
                    <button
                      key={String(lv)}
                      type="button"
                      onClick={() => setUpgLevel(lv)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        upgLevel === lv
                          ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                          : 'bg-background/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}

                  {upgTypesAvailable.length > 1 && (
                    <select
                      value={upgType}
                      onChange={(e) => setUpgType(e.target.value as BuildingType | 'all')}
                      className="ml-auto rounded-lg border border-border bg-input px-2 py-1 text-[11px] text-foreground outline-none"
                    >
                      <option value="all">Mọi loại nhà</option>
                      {upgTypesAvailable.map((t) => (
                        <option key={t} value={t}>
                          {BUILDINGS[t].name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Summary + Bulk Upgrade Action */}
              <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/70 to-secondary/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Đã chọn: <b className="text-primary">{selectedUpgradeable.length}</b>/{filteredUpgradeable.length}{' '}
                    công trình
                  </span>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setExcludedUpgIds([])}
                      className="font-semibold text-primary hover:underline"
                    >
                      Chọn hết
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcludedUpgIds(filteredUpgradeable.map((pl) => pl.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Tổng chi phí đã chọn: <b>{formatMoney(upgradeBudgetCalc.totalSelectedCost)}</b> · Đủ tiền nâng:{' '}
                  <b className="text-success">{upgradeBudgetCalc.affordableCount}</b> công trình
                </div>
                <button
                  type="button"
                  disabled={upgradeBudgetCalc.affordableCount === 0}
                  className="btn-gold mt-2 w-full py-2 text-xs font-black"
                  onClick={() => {
                    act(() => {
                      const res = upgradeBulkPlots(
                        s,
                        selectedUpgradeable.map((pl) => pl.id)
                      );
                      if (res.error) return res.error;
                      res.upgradedIds.slice(0, 12).forEach((id) => {
                        const pl = s.plots[id];
                        if (pl && pl.b) pushFloatingFx(pl.x, pl.y, `⬆ Cấp ${pl.b.level}!`, '#ffd166');
                      });
                      return null;
                    }, `⬆ Đã nâng cấp hàng loạt ${upgradeBudgetCalc.affordableCount} công trình (-${formatMoney(upgradeBudgetCalc.affordableCost)})!`);
                  }}
                >
                  {upgradeBudgetCalc.affordableCount > 0
                    ? `⬆ Nâng cấp hàng loạt ${upgradeBudgetCalc.affordableCount} công trình (${formatMoney(upgradeBudgetCalc.affordableCost)})`
                    : 'Chưa đủ tiền nâng cấp các công trình đã chọn'}
                </button>
              </div>

              {/* Selectable list of upgradeable plots */}
              <div className="space-y-1.5">
                {filteredUpgradeable.map((pl) => {
                  const b = pl.b!;
                  const def = BUILDINGS[b.type];
                  const cost = getUpgradePlotCost(pl);
                  const curInc = getDailyIncome(s, pl);
                  const checked = !excludedSet.has(pl.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => toggleUpgPick(pl.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                        checked
                          ? 'border-primary/45 bg-secondary'
                          : 'border-transparent bg-secondary/40 opacity-60'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {checked ? (
                          <CheckSquare size={15} className="shrink-0 text-primary" />
                        ) : (
                          <Square size={15} className="shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-bold">
                            {def.name}{' '}
                            <span className="text-primary">
                              c{b.level} → c{b.level + 1}
                            </span>
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            #{pl.id} · {REGION_NAMES[pl.region]} · Hiện thu {formatMoney(curInc)}/ngày
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-bold text-primary">{formatMoney(cost)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
