import { useMemo, useState } from 'react';
import { CheckSquare, MapPin, ShoppingCart, Square } from 'lucide-react';
import { BUILDINGS, isForeignRegion, MAP_W, MAX_MAP_H, REGION_NAMES } from '../../game/constants';
import {
  buyBulkEmptyLand,
  checkForeignPermission,
  formatMoney,
  getBulkBuyLandCandidates,
  getBuyEmptyLandCost,
  getDaysUntilNextExpansion,
  getLandPrice,
  getMapHeight,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  isNearRoad,
  startSellNegotiation,
  type BulkBuySort,
} from '../../game/engine';
import { notifyStore, pushFloatingFx } from '../../game/store';
import type { GameState, Plot, RegionId } from '../../game/types';
import type { ActionRunner } from '../ui';

const QUICK_QTYS = [5, 10, 20, 50] as const;

export function LandPanel({
  s,
  act,
  onPick,
  onBulkBuild,
}: {
  s: GameState;
  act: ActionRunner;
  onPick: (plotId: number) => void;
  onBulkBuild?: () => void;
}) {
  const [tab, setTab] = useState<'owned' | 'bulk_buy'>('owned');
  const [buyRegion, setBuyRegion] = useState<RegionId | 'all'>('all');
  const [roadOnly, setRoadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BulkBuySort>('cheapest');
  const [qtyMode, setQtyMode] = useState<number | 'max'>(5);
  const [manualPick, setManualPick] = useState(false);
  const [pickedIds, setPickedIds] = useState<number[]>([]);

  const owned = getOwnedPlots(s);
  const emptyOwnedCount = owned.filter((p) => p.kind === 'land' && !p.b).length;
  const mapH = getMapHeight(s);
  const nextExp = getDaysUntilNextExpansion(s);

  const allBuyableEmpty = useMemo(
    () => getBulkBuyLandCandidates(s, 'all', false, 'cheapest'),
    [s]
  );

  const lockedForeignCount = useMemo(
    () =>
      s.plots.filter(
        (p) => p.kind === 'land' && !p.owner && isForeignRegion(p.region) && Boolean(checkForeignPermission(s, p))
      ).length,
    [s]
  );

  const freeByRegion = useMemo(() => {
    const map = new Map<RegionId, number>();
    for (const pl of allBuyableEmpty) {
      map.set(pl.region, (map.get(pl.region) ?? 0) + 1);
    }
    return map;
  }, [allBuyableEmpty]);

  const candidates = useMemo(
    () => getBulkBuyLandCandidates(s, buyRegion, roadOnly, sortBy),
    [s, buyRegion, roadOnly, sortBy]
  );

  // Determine exact target plots & affordable total
  const buyPlan = useMemo(() => {
    const pool: Plot[] = manualPick
      ? candidates.filter((pl) => pickedIds.includes(pl.id))
      : qtyMode === 'max'
        ? candidates
        : candidates.slice(0, qtyMode);

    let cashLeft = s.cash;
    const affordable: Plot[] = [];
    let affordableCost = 0;
    let poolTotalCost = 0;

    for (const pl of pool) {
      const c = getBuyEmptyLandCost(s, pl);
      poolTotalCost += c;
      if (cashLeft >= c) {
        cashLeft -= c;
        affordable.push(pl);
        affordableCost += c;
      }
    }

    return { pool, affordable, affordableCost, poolTotalCost };
  }, [candidates, manualPick, pickedIds, qtyMode, s]);

  const togglePick = (id: number) => {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('owned')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'owned'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MapPin size={14} /> Đất của bạn ({owned.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('bulk_buy')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
            tab === 'bulk_buy'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart size={14} /> Mua hàng loạt ({allBuyableEmpty.length})
        </button>
      </div>

      {/* TAB 1: OWNED LAND */}
      {tab === 'owned' && (
        <div className="space-y-3">
          {/* Dynamic Map Expansion Status */}
          <div className="rounded-xl border border-border bg-secondary/70 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>
                🗺 Quy mô bản đồ: {MAP_W}×{mapH} ({s.plots.length.toLocaleString('vi-VN')} ô)
              </span>
              <span className="text-primary">{allBuyableEmpty.length + lockedForeignCount} ô trống</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {nextExp !== null
                ? `Mở rộng thêm +56 ô phía Nam sau ${nextExp} ngày (tối đa ${MAP_W}×${MAX_MAP_H}) · Lấn biển mỗi 20 ngày.`
                : 'Đã đạt quy mô mở rộng tối đa!'}
            </div>
          </div>

          {s.offers.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">📩 Lời đề nghị mua</h3>
              {s.offers.map((offer, idx) => {
                const npc = getNpcById(s, offer.npcId);
                return (
                  <div
                    key={`${offer.plotId}-${offer.npcId}-${idx}`}
                    className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-secondary p-2 text-xs"
                  >
                    <span>
                      {npc?.name ?? 'Khách hàng'} trả <b className="text-primary">{formatMoney(offer.price)}</b> cho lô
                      #{offer.plotId}
                    </span>
                    <button
                      className="btn-gold shrink-0 px-2.5 py-1 text-xs"
                      onClick={() => {
                        startSellNegotiation(s, s.plots[offer.plotId], offer.npcId, offer.price);
                        s.offers.splice(idx, 1);
                        notifyStore();
                      }}
                    >
                      Thương lượng
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Lô đất của bạn ({owned.length})</h3>
            <div className="flex items-center gap-1.5">
              {allBuyableEmpty.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('bulk_buy')}
                  className="btn-ghost px-2.5 py-1 text-[11px] font-bold text-primary"
                >
                  🛒 Mua loạt
                </button>
              )}
              {emptyOwnedCount >= 1 && onBulkBuild && (
                <button type="button" onClick={onBulkBuild} className="btn-gold px-2.5 py-1 text-[11px]">
                  🏗 Xây loạt ({emptyOwnedCount})
                </button>
              )}
            </div>
          </div>

          {owned.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Bạn chưa có lô đất nào. Chạm vào ô đất trống trên bản đồ hoặc chuyển sang tab <b>Mua hàng loạt</b> để gom
              đất nhanh.
            </p>
          )}
          {owned.map((plot) => (
            <button
              key={plot.id}
              onClick={() => onPick(plot.id)}
              className="flex w-full items-center justify-between rounded-xl bg-secondary p-2.5 text-left text-xs hover:brightness-110"
            >
              <span>
                <b>#{plot.id}</b> · {REGION_NAMES[plot.region]} · {plot.area}m²{' '}
                {plot.b ? `· ${BUILDINGS[plot.b.type].name} c${plot.b.level}` : '· Đất trống'}
              </span>
              <span className="font-bold text-primary">{formatMoney(getPlotTotalValue(s, plot))}</span>
            </button>
          ))}

          <h3 className="pt-2 text-sm font-bold">Chỉ số giá khu vực</h3>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(s.idx) as RegionId[]).map((reg) => (
              <div key={reg} className="rounded-xl bg-secondary p-2.5 text-xs">
                <div className="text-muted-foreground">{REGION_NAMES[reg]}</div>
                <div className={`text-base font-bold ${s.idx[reg] >= 1 ? 'text-success' : 'text-destructive'}`}>
                  {(s.idx[reg] * 100).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: BULK BUY EMPTY LAND */}
      {tab === 'bulk_buy' && (
        <div className="space-y-3">
          {allBuyableEmpty.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Hiện chưa còn lô đất trống nào khả dụng để mua. Chờ quy hoạch mở rộng thêm đất mới hoặc mở Visa/ETEX để
              mua đất nước ngoài!
            </div>
          ) : (
            <>
              {/* Region & Filter Controls */}
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">1. Chọn khu vực &amp; bộ lọc</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualPick) {
                        setPickedIds(candidates.slice(0, 10).map((pl) => pl.id));
                      }
                      setManualPick((prev) => !prev);
                    }}
                    className="rounded-lg bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:brightness-110"
                  >
                    {manualPick ? 'Chế độ mua nhanh' : 'Tick chọn từng lô'}
                  </button>
                </div>

                {/* Region Chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBuyRegion('all')}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      buyRegion === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả ({allBuyableEmpty.length})
                  </button>
                  {[...freeByRegion.entries()].map(([reg, cnt]) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setBuyRegion(reg)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        buyRegion === reg
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {REGION_NAMES[reg]} ({cnt})
                    </button>
                  ))}
                </div>

                {/* Road Filter + Sort */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setRoadOnly((prev) => !prev)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      roadOnly
                        ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                        : 'bg-background/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🛣 Chỉ mặt đường
                  </button>

                  {([
                    ['cheapest', 'Giá rẻ nhất'],
                    ['price_per_sqm', 'Rẻ nhất/m²'],
                    ['area_desc', 'Diện tích lớn'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSortBy(mode)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        sortBy === mode
                          ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                          : 'bg-background/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {lockedForeignCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    🛂 Còn {lockedForeignCount} ô trống ở nước láng giềng — mở Visa &amp; thẻ ETEX để mua.
                  </p>
                )}
              </div>

              {/* Quantity Quick Picker (when not in manual pick mode) */}
              {!manualPick && (
                <div className="space-y-2 rounded-2xl border border-border bg-secondary/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">2. Số lượng lô muốn mua</span>
                    <span className="text-[11px] text-muted-foreground">
                      Khả dụng: <b>{candidates.length}</b> lô
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {QUICK_QTYS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQtyMode(q)}
                        className={`rounded-xl py-1.5 text-xs font-bold transition ${
                          qtyMode === q
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'bg-background/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {q} lô
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQtyMode('max')}
                      className={`rounded-xl py-1.5 text-xs font-bold transition ${
                        qtyMode === 'max'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tối đa
                    </button>
                  </div>
                </div>
              )}

              {/* Purchase Summary & CTA */}
              <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/70 to-secondary/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Tiền mặt hiện có: <b className="text-primary">{formatMoney(s.cash)}</b>
                  </span>
                  <span className="text-[11px] text-muted-foreground">Gồm 0,5% phí trước bạ</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Đủ tiền mua: <b className="text-success">{buyPlan.affordable.length}</b>
                  {!manualPick && qtyMode !== 'max' ? `/${Math.min(qtyMode, candidates.length)}` : `/${buyPlan.pool.length}`}{' '}
                  lô · Tổng chi phí: <b className="text-foreground">{formatMoney(buyPlan.affordableCost)}</b>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={buyPlan.affordable.length === 0}
                    className="btn-gold flex-1 py-2 text-xs font-black"
                    onClick={() => {
                      const targetIds = buyPlan.affordable.map((pl) => pl.id);
                      const count = targetIds.length;
                      const spent = buyPlan.affordableCost;
                      act(() => {
                        const res = buyBulkEmptyLand(s, targetIds);
                        if (res.error) return res.error;
                        res.boughtIds.slice(0, 14).forEach((id) => {
                          const pl = s.plots[id];
                          if (pl) pushFloatingFx(pl.x, pl.y, 'Đã mua! 🎉', '#ffd166');
                        });
                        if (manualPick) {
                          const boughtSet = new Set(res.boughtIds);
                          setPickedIds((prev) => prev.filter((id) => !boughtSet.has(id)));
                        }
                        return null;
                      }, `🛒 Đã mua hàng loạt ${count} lô đất (-${formatMoney(spent)})!`);
                    }}
                  >
                    {buyPlan.affordable.length > 0
                      ? `🛒 Mua hàng loạt ${buyPlan.affordable.length} lô (${formatMoney(buyPlan.affordableCost)})`
                      : candidates.length > 0
                        ? `Chưa đủ tiền (lô rẻ nhất ${formatMoney(getBuyEmptyLandCost(s, candidates[0]))})`
                        : 'Không có lô phù hợp bộ lọc'}
                  </button>
                  {emptyOwnedCount >= 1 && onBulkBuild && (
                    <button
                      type="button"
                      onClick={onBulkBuild}
                      className="btn-ghost shrink-0 px-3 py-2 text-xs font-bold text-primary"
                    >
                      🏗 Xây loạt
                    </button>
                  )}
                </div>
              </div>

              {/* Preview / Selectable List of Candidate Plots (top 40 for smooth scrolling) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {manualPick
                      ? `Chọn từng lô (hiển thị ${Math.min(candidates.length, 40)}/${candidates.length} lô đầu)`
                      : `Xem trước các lô sẽ mua (${Math.min(buyPlan.affordable.length, 25)} lô đầu)`}
                  </span>
                  {manualPick && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPickedIds(candidates.slice(0, 40).map((pl) => pl.id))}
                        className="font-semibold text-primary hover:underline"
                      >
                        Chọn 40 lô
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickedIds([])}
                        className="hover:text-foreground"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  )}
                </div>

                {(manualPick ? candidates.slice(0, 40) : buyPlan.affordable.slice(0, 25)).map((pl) => {
                  const totalCost = getBuyEmptyLandCost(s, pl);
                  const basePrice = getLandPrice(s, pl);
                  const checked = pickedIds.includes(pl.id);
                  const road = isNearRoad(s, pl);

                  if (manualPick) {
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => togglePick(pl.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                          checked
                            ? 'border-primary/50 bg-secondary'
                            : 'border-transparent bg-secondary/45 opacity-75'
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
                              #{pl.id} · {REGION_NAMES[pl.region]} {road ? '🛣' : ''}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {pl.area} m² · {formatMoney(basePrice / pl.area)}/m²
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 font-bold text-primary">{formatMoney(totalCost)}</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onPick(pl.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl bg-secondary/75 px-2.5 py-2 text-left text-xs hover:brightness-110"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-bold">
                          #{pl.id} · {REGION_NAMES[pl.region]} {road ? '🛣' : ''}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {pl.area} m² · {formatMoney(basePrice / pl.area)}/m²
                        </div>
                      </div>
                      <span className="shrink-0 font-bold text-primary">{formatMoney(totalCost)}</span>
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
