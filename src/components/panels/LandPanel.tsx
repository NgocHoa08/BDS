import { useMemo, useState } from 'react';
import { CheckSquare, Handshake, MapPin, ShoppingCart, Square } from 'lucide-react';
import { BUILDINGS, isForeignRegion, MAP_W, MAX_MAP_H, REGION_NAMES } from '../../game/constants';
import {
  buyBulkEmptyLand,
  buyBulkOwnedPlots,
  checkForeignPermission,
  formatMoney,
  getBulkBuyLandCandidates,
  getBulkBuyOwnedCandidates,
  getBuyEmptyLandCost,
  getDaysUntilNextExpansion,
  getLandPrice,
  getMapHeight,
  getNpcBuyoutTotalCost,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  hasStaff,
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
  const [tab, setTab] = useState<'owned' | 'bulk_buy' | 'bulk_takeover'>('owned');

  // Shared / Empty Bulk Buy state
  const [buyRegion, setBuyRegion] = useState<RegionId | 'all'>('all');
  const [roadOnly, setRoadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<BulkBuySort>('cheapest');
  const [qtyMode, setQtyMode] = useState<number | 'max'>(5);
  const [manualPick, setManualPick] = useState(false);
  const [pickedIds, setPickedIds] = useState<number[]>([]);

  // Bulk Takeover (Already-Owned NPC/Rival plots) state
  const [takeRegion, setTakeRegion] = useState<RegionId | 'all'>('all');
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [emptyOnly, setEmptyOnly] = useState(false);
  const [rivalOnly, setRivalOnly] = useState(false);
  const [takeRoadOnly, setTakeRoadOnly] = useState(false);
  const [takeSort, setTakeSort] = useState<BulkBuySort>('cheapest');
  const [takeQty, setTakeQty] = useState<number | 'max'>(5);
  const [takeManual, setTakeManual] = useState(false);
  const [takePickedIds, setTakePickedIds] = useState<number[]>([]);

  const owned = getOwnedPlots(s);
  const emptyOwnedCount = owned.filter((p) => p.kind === 'land' && !p.b && !p.megaParentId).length;
  const mapH = getMapHeight(s);
  const nextExp = getDaysUntilNextExpansion(s);

  const allBuyableEmpty = useMemo(() => getBulkBuyLandCandidates(s, 'all', false, 'cheapest'), [s]);
  const allTakeoverPlots = useMemo(() => getBulkBuyOwnedCandidates(s, {}), [s]);

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

  const takeoverByRegion = useMemo(() => {
    const map = new Map<RegionId, number>();
    for (const pl of allTakeoverPlots) {
      map.set(pl.region, (map.get(pl.region) ?? 0) + 1);
    }
    return map;
  }, [allTakeoverPlots]);

  const candidates = useMemo(
    () => getBulkBuyLandCandidates(s, buyRegion, roadOnly, sortBy),
    [s, buyRegion, roadOnly, sortBy]
  );

  const takeoverCandidates = useMemo(
    () =>
      getBulkBuyOwnedCandidates(s, {
        region: takeRegion,
        forSaleOnly,
        emptyOnly,
        rivalOnly,
        roadOnly: takeRoadOnly,
        sortBy: takeSort,
      }),
    [s, takeRegion, forSaleOnly, emptyOnly, rivalOnly, takeRoadOnly, takeSort]
  );

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

  const takeoverPlan = useMemo(() => {
    const pool: Plot[] = takeManual
      ? takeoverCandidates.filter((pl) => takePickedIds.includes(pl.id))
      : takeQty === 'max'
        ? takeoverCandidates
        : takeoverCandidates.slice(0, takeQty);

    let cashLeft = s.cash;
    const affordable: Plot[] = [];
    let affordableCost = 0;
    let poolTotalCost = 0;

    for (const pl of pool) {
      const c = getNpcBuyoutTotalCost(s, pl);
      poolTotalCost += c;
      if (cashLeft >= c) {
        cashLeft -= c;
        affordable.push(pl);
        affordableCost += c;
      }
    }
    return { pool, affordable, affordableCost, poolTotalCost };
  }, [takeoverCandidates, takeManual, takePickedIds, takeQty, s]);

  const togglePick = (id: number) => {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTakePick = (id: number) => {
    setTakePickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setTab('owned')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'owned'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MapPin size={13} /> Của bạn ({owned.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('bulk_buy')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'bulk_buy'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingCart size={13} /> Đất trống ({allBuyableEmpty.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('bulk_takeover')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'bulk_takeover'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-primary/90 hover:text-primary'
          }`}
        >
          <Handshake size={13} /> Mua lại ({allTakeoverPlots.length})
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
              {allTakeoverPlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('bulk_takeover')}
                  className="btn-ghost px-2 py-1 text-[11px] font-bold text-primary"
                >
                  🤝 Mua lại loạt
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
              Bạn chưa có lô đất nào. Chạm vào ô đất trống trên bản đồ hoặc chuyển sang tab <b>Đất trống / Mua lại</b>{' '}
              để gom đất nhanh.
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
                {plot.b ? `· ${BUILDINGS[plot.b.type].name} c${plot.b.level}` : plot.megaParentId ? '· Thuộc Siêu Dự Án' : '· Đất trống'}
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
              Hiện chưa còn lô đất trống nào khả dụng để mua. Chuyển sang tab <b>Mua lại</b> để thâu tóm đất đã có chủ
              hoặc chờ quy hoạch mở rộng thêm đất mới!
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">1. Chọn khu vực &amp; bộ lọc</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualPick) setPickedIds(candidates.slice(0, 10).map((pl) => pl.id));
                      setManualPick((prev) => !prev);
                    }}
                    className="rounded-lg bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:brightness-110"
                  >
                    {manualPick ? 'Chế độ mua nhanh' : 'Tick chọn từng lô'}
                  </button>
                </div>

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

              <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/70 to-secondary/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Tiền mặt: <b className="text-primary">{formatMoney(s.cash)}</b>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Gồm 0,5% trước bạ{hasStaff(s, 'super_broker') ? ' · -10% Môi giới' : ''}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Đủ tiền mua: <b className="text-success">{buyPlan.affordable.length}</b>
                  {!manualPick && qtyMode !== 'max'
                    ? `/${Math.min(qtyMode, candidates.length)}`
                    : `/${buyPlan.pool.length}`}{' '}
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
                      }, `🛒 Đã mua hàng loạt ${count} lô đất trống (-${formatMoney(spent)})!`);
                    }}
                  >
                    {buyPlan.affordable.length > 0
                      ? `🛒 Mua ${buyPlan.affordable.length} lô trống (${formatMoney(buyPlan.affordableCost)})`
                      : candidates.length > 0
                        ? `Chưa đủ tiền (rẻ nhất ${formatMoney(getBuyEmptyLandCost(s, candidates[0]))})`
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {manualPick
                      ? `Chọn từng lô (hiển thị ${Math.min(candidates.length, 40)}/${candidates.length})`
                      : `Xem trước (${Math.min(buyPlan.affordable.length, 25)} lô đầu)`}
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
                      <button type="button" onClick={() => setPickedIds([])} className="hover:text-foreground">
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

                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => (manualPick ? togglePick(pl.id) : onPick(pl.id))}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                        manualPick
                          ? checked
                            ? 'border-primary/50 bg-secondary'
                            : 'border-transparent bg-secondary/45 opacity-75'
                          : 'border-transparent bg-secondary/75 hover:brightness-110'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {manualPick &&
                          (checked ? (
                            <CheckSquare size={15} className="shrink-0 text-primary" />
                          ) : (
                            <Square size={15} className="shrink-0 text-muted-foreground" />
                          ))}
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
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: BULK TAKEOVER OF ALREADY-OWNED PLOTS (NPCs & RIVALS) */}
      {tab === 'bulk_takeover' && (
        <div className="space-y-3">
          {allTakeoverPlots.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Bạn đã thâu tóm sạch đất có chủ rồi! Mở Visa &amp; thẻ ETEX để mua lại đất tại các nước láng giềng.
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">1. Lọc đất đã có chủ (NPC &amp; Đối thủ)</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!takeManual) setTakePickedIds(takeoverCandidates.slice(0, 10).map((pl) => pl.id));
                      setTakeManual((prev) => !prev);
                    }}
                    className="rounded-lg bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:brightness-110"
                  >
                    {takeManual ? 'Chế độ mua nhanh' : 'Tick chọn từng lô'}
                  </button>
                </div>

                {/* Region chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTakeRegion('all')}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      takeRegion === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả ({allTakeoverPlots.length})
                  </button>
                  {[...takeoverByRegion.entries()].map(([reg, cnt]) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setTakeRegion(reg)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        takeRegion === reg
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {REGION_NAMES[reg]} ({cnt})
                    </button>
                  ))}
                </div>

                {/* Smart takeover filters */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setForSaleOnly((p) => !p)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      forSaleOnly
                        ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                        : 'bg-background/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🏷 Đang rao bán (rẻ hơn)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRivalOnly((p) => !p)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      rivalOnly
                        ? 'bg-destructive/30 text-red-300 ring-1 ring-red-400/50'
                        : 'bg-background/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ⚔️ Tập đoàn đối thủ
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmptyOnly((p) => !p)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      emptyOnly
                        ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                        : 'bg-background/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🌱 Chưa xây nhà
                  </button>
                  <button
                    type="button"
                    onClick={() => setTakeRoadOnly((p) => !p)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      takeRoadOnly
                        ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                        : 'bg-background/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🛣 Mặt đường
                  </button>
                </div>

                {/* Sort chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    ['cheapest', 'Giá rẻ nhất'],
                    ['price_per_sqm', 'Rẻ nhất/m²'],
                    ['area_desc', 'Diện tích lớn'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTakeSort(mode)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        takeSort === mode
                          ? 'bg-primary/25 text-primary ring-1 ring-primary/50'
                          : 'bg-background/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity picker */}
              {!takeManual && (
                <div className="space-y-2 rounded-2xl border border-border bg-secondary/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">2. Số lượng lô muốn mua lại</span>
                    <span className="text-[11px] text-muted-foreground">
                      Khả dụng: <b>{takeoverCandidates.length}</b> lô
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {QUICK_QTYS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setTakeQty(q)}
                        className={`rounded-xl py-1.5 text-xs font-bold transition ${
                          takeQty === q
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'bg-background/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {q} lô
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTakeQty('max')}
                      className={`rounded-xl py-1.5 text-xs font-bold transition ${
                        takeQty === 'max'
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tối đa
                    </button>
                  </div>
                </div>
              )}

              {/* Summary & Takeover CTA */}
              <div className="rounded-2xl border border-primary/45 bg-gradient-to-r from-primary/15 via-secondary/75 to-secondary/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Tiền mặt: <b className="text-primary">{formatMoney(s.cash)}</b>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Mua trọn đất + công trình sẵn có{hasStaff(s, 'super_broker') ? ' (-10% Môi giới)' : ''}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Đủ tiền mua lại: <b className="text-success">{takeoverPlan.affordable.length}</b>
                  {!takeManual && takeQty !== 'max'
                    ? `/${Math.min(takeQty, takeoverCandidates.length)}`
                    : `/${takeoverPlan.pool.length}`}{' '}
                  lô · Tổng chi phí: <b className="text-foreground">{formatMoney(takeoverPlan.affordableCost)}</b>
                </div>

                <button
                  type="button"
                  disabled={takeoverPlan.affordable.length === 0}
                  className="btn-gold mt-2.5 w-full py-2 text-xs font-black"
                  onClick={() => {
                    const targetIds = takeoverPlan.affordable.map((pl) => pl.id);
                    const count = targetIds.length;
                    const spent = takeoverPlan.affordableCost;
                    act(() => {
                      const res = buyBulkOwnedPlots(s, targetIds);
                      if (res.error) return res.error;
                      res.boughtIds.slice(0, 14).forEach((id) => {
                        const pl = s.plots[id];
                        if (pl) pushFloatingFx(pl.x, pl.y, '🤝 Thâu tóm!', '#ffd166');
                      });
                      if (takeManual) {
                        const doneSet = new Set(res.boughtIds);
                        setTakePickedIds((prev) => prev.filter((id) => !doneSet.has(id)));
                      }
                      return null;
                    }, `🤝 Đã mua lại hàng loạt ${count} lô đất có chủ (-${formatMoney(spent)})!`);
                  }}
                >
                  {takeoverPlan.affordable.length > 0
                    ? `🤝 Mua lại hàng loạt ${takeoverPlan.affordable.length} lô (${formatMoney(takeoverPlan.affordableCost)})`
                    : takeoverCandidates.length > 0
                      ? `Chưa đủ tiền (lô rẻ nhất ${formatMoney(getNpcBuyoutTotalCost(s, takeoverCandidates[0]))})`
                      : 'Không có lô đất có chủ phù hợp bộ lọc'}
                </button>
              </div>

              {/* Preview / Selectable list of NPC/Rival plots */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {takeManual
                      ? `Chọn từng lô (hiển thị ${Math.min(takeoverCandidates.length, 40)}/${takeoverCandidates.length})`
                      : `Xem trước (${Math.min(takeoverPlan.affordable.length, 25)} lô đầu)`}
                  </span>
                  {takeManual && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTakePickedIds(takeoverCandidates.slice(0, 40).map((pl) => pl.id))}
                        className="font-semibold text-primary hover:underline"
                      >
                        Chọn 40 lô
                      </button>
                      <button type="button" onClick={() => setTakePickedIds([])} className="hover:text-foreground">
                        Bỏ chọn
                      </button>
                    </div>
                  )}
                </div>

                {(takeManual ? takeoverCandidates.slice(0, 40) : takeoverPlan.affordable.slice(0, 25)).map((pl) => {
                  const totalCost = getNpcBuyoutTotalCost(s, pl);
                  const npc = pl.owner ? getNpcById(s, pl.owner) : undefined;
                  const checked = takePickedIds.includes(pl.id);
                  const road = isNearRoad(s, pl);

                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => (takeManual ? toggleTakePick(pl.id) : onPick(pl.id))}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                        takeManual
                          ? checked
                            ? 'border-primary/50 bg-secondary'
                            : 'border-transparent bg-secondary/45 opacity-75'
                          : 'border-transparent bg-secondary/75 hover:brightness-110'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {takeManual &&
                          (checked ? (
                            <CheckSquare size={15} className="shrink-0 text-primary" />
                          ) : (
                            <Square size={15} className="shrink-0 text-muted-foreground" />
                          ))}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate font-bold">
                            <span>
                              #{pl.id} · {REGION_NAMES[pl.region]} {road ? '🛣' : ''}
                            </span>
                            {pl.forSale && (
                              <span className="rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-300">Rao bán</span>
                            )}
                            {npc?.rival && (
                              <span className="rounded bg-destructive/25 px-1 text-[9px] text-red-300">Đối thủ</span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {npc?.name ?? 'NPC'} · {pl.area}m²{' '}
                            {pl.b ? `· 🏢 ${BUILDINGS[pl.b.type].name} c${pl.b.level}` : '· Đất trống'}
                          </div>
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
