import { useMemo, useState } from 'react';
import { Check, CheckSquare, FilePenLine, HandCoins, Layers, Square, X } from 'lucide-react';
import { BUILDABLE_TYPES, BUILDINGS, PLAYER_SHARE, REGION_NAMES } from '../../game/constants';
import {
  canBuildInPlot,
  checkForeignPermission,
  formatMoney,
  getActiveInvestment,
  getOwnedPlots,
  getProjectCapital,
  previewBulkInvestmentCapacity,
  repayBulkInvestments,
  repayInvestment,
  signBulkInvestments,
  signInvestment,
} from '../../game/engine';
import { pushFloatingFx } from '../../game/store';
import type { BuildingType, GameState, Plot, RegionId } from '../../game/types';
import { Button, type ActionRunner } from '../ui';

export function InvestPanel({ s, act }: { s: GameState; act: ActionRunner }) {
  const emptyPlots = getOwnedPlots(s).filter(
    (p) => p.kind === 'land' && !p.b && !getActiveInvestment(s, p.id) && !checkForeignPermission(s, p)
  );
  const investors = s.npcs.filter((n) => !n.rival);

  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single investment state
  const [plotId, setPlotId] = useState<number>(emptyPlots[0]?.id ?? -1);
  const [npcId, setNpcId] = useState<string>(
    investors.find((n) => n.role === 'Nhà đầu tư')?.id ?? investors[0]?.id ?? ''
  );
  const [bType, setBType] = useState<BuildingType>('nha_cap4');
  const [term, setTerm] = useState<number>(365);
  const [drafting, setDrafting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Bulk investment state
  const [bulkRegion, setBulkRegion] = useState<RegionId | 'all'>('all');
  const [bulkType, setBulkType] = useState<BuildingType>('khach_san');
  const [bulkTerm, setBulkTerm] = useState<number>(365);
  const [bulkNpc, setBulkNpc] = useState<string>('auto');
  const [manualPick, setManualPick] = useState(false);
  const [pickedIds, setPickedIds] = useState<number[]>([]);

  const chosenPlot = emptyPlots.find((p) => p.id === plotId);
  const chosenNpc = investors.find((n) => n.id === npcId);
  const capital = getProjectCapital(bType);
  const ready = Boolean(chosenPlot && chosenNpc && canBuildInPlot(chosenPlot, bType) && chosenNpc.cash >= capital);

  const emptyByRegion = useMemo(() => {
    const map = new Map<RegionId, Plot[]>();
    for (const pl of emptyPlots) {
      const arr = map.get(pl.region) ?? [];
      arr.push(pl);
      map.set(pl.region, arr);
    }
    return map;
  }, [emptyPlots]);

  const filteredEmptyPlots = useMemo(
    () => (bulkRegion === 'all' ? emptyPlots : emptyPlots.filter((pl) => pl.region === bulkRegion)),
    [emptyPlots, bulkRegion]
  );

  const activeBulkPool = useMemo(() => {
    if (!manualPick) return filteredEmptyPlots;
    const set = new Set(pickedIds);
    return filteredEmptyPlots.filter((pl) => set.has(pl.id));
  }, [manualPick, filteredEmptyPlots, pickedIds]);

  const validBulkTypes = useMemo(() => {
    const types = BUILDABLE_TYPES.filter((t) =>
      activeBulkPool.length === 0 ? true : activeBulkPool.some((pl) => canBuildInPlot(pl, t))
    );
    return types.sort((a, b) => BUILDINGS[b].income - BUILDINGS[a].income);
  }, [activeBulkPool]);

  const effectiveBulkType: BuildingType = validBulkTypes.includes(bulkType)
    ? bulkType
    : validBulkTypes[0] ?? 'nha_cap4';

  const bulkPreview = useMemo(
    () =>
      previewBulkInvestmentCapacity(
        s,
        activeBulkPool.map((pl) => pl.id),
        effectiveBulkType,
        bulkNpc
      ),
    [s, activeBulkPool, effectiveBulkType, bulkNpc]
  );

  const totalNpcCash = investors.reduce((sum, n) => sum + n.cash, 0);

  // Active contracts & bulk repay calculation
  const openContracts = s.investments.filter((i) => i.status !== 'closed');
  const bulkRepayCalc = useMemo(() => {
    const sorted = [...openContracts].sort((a, b) => {
      if (a.status === 'due' && b.status !== 'due') return -1;
      if (b.status === 'due' && a.status !== 'due') return 1;
      return a.remaining - b.remaining;
    });
    let cashLeft = s.cash;
    let count = 0;
    let total = 0;
    for (const inv of sorted) {
      if (cashLeft >= inv.remaining) {
        cashLeft -= inv.remaining;
        count += 1;
        total += inv.remaining;
      }
    }
    return { count, total };
  }, [openContracts, s.cash]);

  const togglePick = (id: number) => {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectCls = 'mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <HandCoins className="text-primary" size={28} />
        <div>
          <h3 className="font-bold">Hợp tác đầu tư</h3>
          <p className="text-xs text-muted-foreground">Nhà đầu tư 70% · Bạn 30% lợi nhuận ròng</p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      {!drafting && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
              mode === 'single'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FilePenLine size={14} /> Gọi vốn 1 lô
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 transition ${
              mode === 'bulk'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers size={14} /> Gọi vốn hàng loạt ({emptyPlots.length})
          </button>
        </div>
      )}

      {drafting ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">THỎA THUẬN ĐẦU TƯ</h3>
            <Button variant="ghost" size="icon" aria-label="Hủy soạn hợp đồng" onClick={() => setDrafting(false)}>
              <X size={18} />
            </Button>
          </div>

          <div className="space-y-2 text-sm leading-relaxed">
            <p>
              <b>Bên A:</b> {chosenNpc?.name} (nhà đầu tư NPC)
            </p>
            <p>
              <b>Bên B:</b> Bạn (chủ đất, quản lý vận hành)
            </p>
            <p>
              <b>Dự án:</b> {BUILDINGS[bType].name} · lô #{plotId}
            </p>
            <p>
              <b>Vốn Bên A:</b> {formatMoney(capital)}, gồm xây dựng và giấy phép 2%, giải ngân trực tiếp khi ký.
            </p>
            <p>
              <b>Thời hạn:</b> {term} ngày, từ ngày {s.day} đến ngày {s.day + term}.
            </p>
            <p>
              <b>Chia lời:</b> Bên A 70%, Bên B 30% lợi nhuận sau bảo trì, dự phòng thuế kinh doanh và thuế đất; lỗ vận
              hành được bù trước khi chia lời tiếp.
            </p>
            <p>
              <b>Hoàn vốn:</b> Trả đủ {formatMoney(capital)} khi đến hạn; được tất toán sớm. Thiếu tiền thì tiếp tục
              chia lời cho đến khi hoàn vốn, không phạt thêm.
            </p>
            <p>
              <b>Tài sản:</b> Đất và công trình thuộc Bên B; không bán, phá dỡ hoặc nâng cấp khi hợp đồng chưa tất toán.
              Không cam kết lợi nhuận.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-primary"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            Tôi đồng ý các điều khoản hợp tác.
          </label>

          <Button
            className="w-full"
            disabled={!agreed || !ready}
            onClick={() =>
              act(() => {
                const err = signInvestment(s, plotId, npcId, bType, term);
                if (!err) setDrafting(false);
                return err;
              }, 'Đã ký hợp đồng và giải ngân xây dựng!')
            }
          >
            <Check size={16} /> Ký kết &amp; nhận vốn
          </Button>
        </section>
      ) : mode === 'single' ? (
        <section className="space-y-3">
          <h3 className="text-sm font-bold">Gọi vốn xây dựng</h3>
          {!emptyPlots.length && (
            <p className="text-sm text-muted-foreground">
              Chưa có đất trống để gọi vốn. Mua một lô đất trước khi lập hợp đồng.
            </p>
          )}

          <label className="block text-xs text-muted-foreground">
            Lô đất
            <select
              aria-label="Lô đất đầu tư"
              className={selectCls}
              value={chosenPlot ? plotId : -1}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setPlotId(nextId);
                const pl = emptyPlots.find((p) => p.id === nextId);
                if (pl && !canBuildInPlot(pl, bType)) setBType('nha_cap4');
              }}
            >
              <option value={-1} disabled>
                Chọn lô đất
              </option>
              {emptyPlots.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} · {REGION_NAMES[p.region]} · {p.area} m²
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted-foreground">
            Đối tác góp vốn
            <select
              aria-label="Nhà đầu tư"
              value={npcId}
              onChange={(e) => setNpcId(e.target.value)}
              className={selectCls}
            >
              {investors.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {formatMoney(n.cash)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted-foreground">
            Công trình
            <select
              aria-label="Công trình đầu tư"
              value={bType}
              onChange={(e) => setBType(e.target.value as BuildingType)}
              className={selectCls}
            >
              {BUILDABLE_TYPES.filter((t) => !chosenPlot || canBuildInPlot(chosenPlot, t)).map((t) => (
                <option key={t} value={t}>
                  {BUILDINGS[t].name} · {formatMoney(getProjectCapital(t))}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted-foreground">
            Kỳ hạn hợp tác
            <select
              aria-label="Kỳ hạn hợp tác"
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className={selectCls}
            >
              {[90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} ngày
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-between border-y border-border py-3 text-sm">
            <span>Vốn cần huy động</span>
            <b className="text-primary">{formatMoney(capital)}</b>
          </div>

          {chosenNpc && chosenNpc.cash < capital && (
            <p className="text-xs text-destructive">Đối tác chưa đủ vốn cho công trình này.</p>
          )}

          <Button
            className="w-full"
            disabled={!ready}
            onClick={() => {
              setDrafting(true);
              setAgreed(false);
            }}
          >
            <FilePenLine size={16} /> Soạn hợp đồng
          </Button>
        </section>
      ) : (
        /* BULK INVESTMENT FUNDRAISING TAB */
        <section className="space-y-3">
          {emptyPlots.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Chưa có lô đất trống nào để gọi vốn hàng loạt. Hãy mua đất trống trước nhé!
            </div>
          ) : (
            <>
              {/* Step 1: Region & optional per-plot checkboxes */}
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">1. Chọn khu vực đất trống</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualPick) setPickedIds(filteredEmptyPlots.map((pl) => pl.id));
                      setManualPick((prev) => !prev);
                    }}
                    className="rounded-lg bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:brightness-110"
                  >
                    {manualPick ? 'Tự động theo vùng' : 'Tick chọn từng lô'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRegion('all');
                      if (manualPick) setPickedIds(emptyPlots.map((pl) => pl.id));
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      bulkRegion === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả ({emptyPlots.length})
                  </button>
                  {[...emptyByRegion.entries()].map(([reg, arr]) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => {
                        setBulkRegion(reg);
                        if (manualPick) setPickedIds(arr.map((pl) => pl.id));
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

                {manualPick && (
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Đã chọn <b className="text-primary">{activeBulkPool.length}</b>/{filteredEmptyPlots.length} lô
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPickedIds(filteredEmptyPlots.map((pl) => pl.id))}
                          className="font-semibold text-primary hover:underline"
                        >
                          Chọn hết
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickedIds([])}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3">
                      {filteredEmptyPlots.map((pl) => {
                        const checked = pickedIds.includes(pl.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => togglePick(pl.id)}
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

              {/* Step 2: Building, Partner Allocation, Term */}
              <div className="space-y-2.5 rounded-2xl border border-border bg-secondary/50 p-2.5 text-xs">
                <label className="block text-muted-foreground">
                  <span className="font-bold text-primary">2. Công trình muốn gọi vốn</span>
                  <select
                    aria-label="Công trình gọi vốn hàng loạt"
                    value={effectiveBulkType}
                    onChange={(e) => setBulkType(e.target.value as BuildingType)}
                    className={selectCls}
                  >
                    {validBulkTypes.map((t) => (
                      <option key={t} value={t}>
                        {BUILDINGS[t].name} · Vốn {formatMoney(getProjectCapital(t))}/lô · Thu ~
                        {formatMoney(BUILDINGS[t].income)}/ngày
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-muted-foreground">
                  <span className="font-bold text-primary">3. Phân bổ nhà đầu tư</span>
                  <select
                    aria-label="Phân bổ nhà đầu tư"
                    value={bulkNpc}
                    onChange={(e) => setBulkNpc(e.target.value)}
                    className={selectCls}
                  >
                    <option value="auto">
                      ⚡ Tự động chia các NPC giàu nhất (Quỹ {formatMoney(totalNpcCash)})
                    </option>
                    {investors
                      .slice()
                      .sort((a, b) => b.cash - a.cash)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          Chỉ {n.name} · {formatMoney(n.cash)}
                        </option>
                      ))}
                  </select>
                </label>

                <div>
                  <div className="mb-1 font-bold text-primary">4. Kỳ hạn hợp tác</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setBulkTerm(d)}
                        className={`rounded-xl py-1.5 text-xs font-bold transition ${
                          bulkTerm === d
                            ? 'bg-primary text-primary-foreground shadow'
                            : 'bg-background/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {d} ngày {d === 365 ? '★' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Capacity Summary & Bulk Sign CTA */}
              <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/70 to-secondary/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Hợp quy hoạch: <b>{bulkPreview.eligibleCount}</b>/{activeBulkPool.length} lô
                  </span>
                  <span>
                    NPC đủ vốn cho: <b className="text-success">{bulkPreview.fundableCount} lô</b>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    Tổng vốn huy động: <b className="text-primary">{formatMoney(bulkPreview.totalCapital)}</b>
                  </span>
                  <span>
                    Ước tính bạn nhận (30%):{' '}
                    <b className="text-success">
                      ~
                      {formatMoney(
                        bulkPreview.fundableCount *
                          Math.max(0, BUILDINGS[effectiveBulkType].income * 0.93 - BUILDINGS[effectiveBulkType].maint) *
                          PLAYER_SHARE
                      )}
                      /ngày
                    </b>
                  </span>
                </div>

                <button
                  type="button"
                  disabled={bulkPreview.fundableCount === 0}
                  className="btn-gold mt-2.5 w-full py-2 text-xs font-black"
                  onClick={() => {
                    const count = bulkPreview.fundableCount;
                    const cap = bulkPreview.totalCapital;
                    act(() => {
                      const res = signBulkInvestments(
                        s,
                        activeBulkPool.map((pl) => pl.id),
                        effectiveBulkType,
                        bulkTerm,
                        bulkNpc
                      );
                      if (res.error) return res.error;
                      res.signedIds.slice(0, 14).forEach((id) => {
                        const pl = s.plots[id];
                        if (pl) pushFloatingFx(pl.x, pl.y, '🤝 Gọi vốn!', '#ffd166');
                      });
                      if (manualPick) {
                        const doneSet = new Set(res.signedIds);
                        setPickedIds((prev) => prev.filter((id) => !doneSet.has(id)));
                      }
                      return null;
                    }, `🤝 Ký gọi vốn hàng loạt ${count} ${BUILDINGS[effectiveBulkType].name} (+${formatMoney(cap)})!`);
                  }}
                >
                  {bulkPreview.fundableCount > 0
                    ? `🤝 Ký gọi vốn hàng loạt ${bulkPreview.fundableCount} lô (${formatMoney(bulkPreview.totalCapital)})`
                    : bulkPreview.eligibleCount === 0
                      ? 'Không có lô nào hợp quy hoạch công trình này'
                      : 'Các nhà đầu tư không đủ vốn cho công trình này — hãy chọn công trình nhỏ hơn'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Contracts Ledger + Bulk Repayment */}
      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">
            Sổ hợp đồng ({openContracts.length} đang mở / {s.investments.length})
          </h3>
          {openContracts.length >= 2 && (
            <button
              type="button"
              disabled={bulkRepayCalc.count === 0}
              onClick={() =>
                act(() => {
                  const res = repayBulkInvestments(s);
                  return res.error;
                }, `✅ Tất toán hàng loạt ${bulkRepayCalc.count} hợp đồng (-${formatMoney(bulkRepayCalc.total)})!`)
              }
              className="btn-gold px-2.5 py-1 text-[11px] disabled:opacity-45"
            >
              {bulkRepayCalc.count > 0
                ? `✅ Tất toán loạt ${bulkRepayCalc.count} HĐ (${formatMoney(bulkRepayCalc.total)})`
                : 'Chưa đủ tiền tất toán'}
            </button>
          )}
        </div>

        {!s.investments.length && <p className="text-sm text-muted-foreground">Chưa có hợp đồng đầu tư.</p>}

        {s.investments
          .slice()
          .reverse()
          .map((inv) => (
            <article key={inv.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-1">
                <b>
                  HĐ #{inv.id} · Lô #{inv.plotId}
                </b>
                <span className={inv.status === 'due' ? 'text-destructive' : 'text-success'}>
                  {inv.status === 'closed' ? 'Đã tất toán' : inv.status === 'due' ? 'Chờ hoàn vốn' : 'Đang hợp tác'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.npcs.find((n) => n.id === inv.npcId)?.name} · Ngày {inv.signedDay}–{inv.endDay}
              </p>
              <div className="mt-2 flex justify-between">
                <span>Vốn phải hoàn</span>
                <b>{formatMoney(inv.remaining)}</b>
              </div>
              <div className="flex justify-between">
                <span>Lời nhà đầu tư · 70%</span>
                <b>{formatMoney(inv.investorPaid)}</b>
              </div>
              <div className="flex justify-between text-success">
                <span>Lời của bạn · 30%</span>
                <b>{formatMoney(inv.playerProfit)}</b>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Lợi nhuận ròng lũy kế</span>
                <span>{formatMoney(inv.netProfit)}</span>
              </div>
              {inv.status !== 'closed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={s.cash < inv.remaining}
                  onClick={() => act(() => repayInvestment(s, inv.id), 'Đã hoàn vốn và tất toán hợp đồng')}
                >
                  Hoàn vốn &amp; tất toán
                </Button>
              )}
            </article>
          ))}
      </section>
    </div>
  );
}
