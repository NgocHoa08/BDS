import { useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import {
  BUILDABLE_TYPES,
  BUILDINGS,
  ETEX_CARD_FEE,
  ETEX_MIN_FEE,
  FOREIGN_INFO,
  GOV_INFO,
  isForeignRegion,
  LAND_TYPES,
  PERSONA_LABELS,
  REGION_NAMES,
  VISA_FEE,
} from '../../game/constants';
import {
  applyForVisa,
  buyEmptyLand,
  checkForeignPermission,
  demolishBuilding,
  formatMoney,
  getDailyIncome,
  getDaysUntilNextExpansion,
  getLandPrice,
  getMapHeight,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  getUpgradeCost,
  isCityLandmarkPlot,
  isNearRoad,
  openEtexCard,
  paintBuilding,
  startBuyNegotiation,
  startSellNegotiation,
  toggleRentalListing,
  upgradeBuilding,
} from '../../game/engine';
import type { GameState, Plot, RegionId } from '../../game/types';
import { StatRow, type ActionRunner } from '../ui';

const WALL_SWATCHES = [
  { name: 'Trắng sứ', hex: '#f4f1ea' },
  { name: 'Kem cổ điển', hex: '#efe2c6' },
  { name: 'Vàng nắng', hex: '#f4d37a' },
  { name: 'Hồng phấn', hex: '#f2b8be' },
  { name: 'Xanh bạc hà', hex: '#b6dfd0' },
  { name: 'Xanh da trời', hex: '#a9d0ec' },
  { name: 'Tím oải hương', hex: '#cfc1eb' },
  { name: 'Xám hiện đại', hex: '#9ea7b2' },
];

const ROOF_SWATCHES = [
  { name: 'Ngói đỏ', hex: '#b84836' },
  { name: 'Xanh dương', hex: '#395c8a' },
  { name: 'Xanh rêu', hex: '#3d6e52' },
  { name: 'Vàng hoàng kim', hex: '#d9a432' },
  { name: 'Cam đất', hex: '#d46a34' },
  { name: 'Hồng san hô', hex: '#d95b7a' },
  { name: 'Tím than', hex: '#544675' },
  { name: 'Đen tuyền', hex: '#2c323b' },
];

function ownerLabel(s: GameState, p: Plot, visitOwnerName?: string): string {
  if (p.owner === 'me') return visitOwnerName ? `👑 ${visitOwnerName}` : 'Bạn';
  if (isCityLandmarkPlot(p)) return 'Thành phố · Công trình biểu tượng';
  if (!p.owner) return 'Nhà nước (đất trống)';
  const npc = getNpcById(s, p.owner);
  return npc ? `${npc.name} · ${PERSONA_LABELS[npc.persona]}` : 'Không rõ';
}

export function PlotPanel({
  s,
  p,
  act,
  openBuild,
  readOnly = false,
  visitOwnerName,
}: {
  s: GameState;
  p: Plot;
  act: ActionRunner;
  openBuild: () => void;
  readOnly?: boolean;
  visitOwnerName?: string;
}) {
  const [paintOpen, setPaintOpen] = useState(false);

  if (p.kind === 'gov' && p.gov) {
    const info = GOV_INFO[p.gov];
    return (
      <div>
        <div className="text-lg font-bold">🏛 {info.name}</div>
        <p className="mt-1 text-sm text-muted-foreground">{info.desc}</p>

        {p.gov === 'thue' && (
          <div className="mt-3">
            <StatRow k="Thuế đã nộp" v={formatMoney(s.total.tax)} />
            <StatRow
              k="Kỳ gần nhất"
              v={s.lastTax ? `Ngày ${s.lastTax.day}: ${formatMoney(s.lastTax.land + s.lastTax.biz)}` : 'Chưa có'}
            />
            <StatRow k="Kỳ thuế tiếp theo" v={`Ngày ${Math.ceil(s.day / 30) * 30 || 30}`} />
          </div>
        )}

        {p.gov === 'quyhoach' && (
          <div className="mt-3 space-y-1.5 text-xs">
            {(Object.keys(REGION_NAMES) as RegionId[]).map((reg) => (
              <div key={reg}>
                <b>{REGION_NAMES[reg]}:</b>{' '}
                {BUILDABLE_TYPES.filter((t) => BUILDINGS[t].regions.includes(reg))
                  .map((t) => BUILDINGS[t].name)
                  .join(', ')}
              </div>
            ))}
          </div>
        )}

        {p.gov === 'ubnd' && (
          <div className="mt-3 space-y-1 text-xs">
            {s.log.slice(0, 6).map((entry, idx) => (
              <div key={idx}>
                Ngày {entry.day}: {entry.text}
              </div>
            ))}
          </div>
        )}

        {p.gov.startsWith('gov_') && isForeignRegion(p.region) && (
          <div className="mt-3 space-y-2">
            <StatRow
              k="Visa đầu tư"
              v={s.visas.includes(p.region) ? '✅ Đã cấp' : 'Chưa có'}
              c={s.visas.includes(p.region) ? 'text-success' : ''}
            />
            <StatRow
              k="Thẻ ETEX"
              v={s.etex ? '✅ Đang hoạt động' : 'Chưa mở'}
              c={s.etex ? 'text-success' : ''}
            />
            <StatRow k="Phí quẹt thẻ mỗi lần đầu tư" v={`0,2% (tối thiểu ${formatMoney(ETEX_MIN_FEE)})`} />
            <StatRow
              k="Công trình đang xây"
              v={s.plots.filter((pl) => pl.region === p.region && pl.b && pl.b.buildLeft > 0).length}
            />
            {!readOnly && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  className="btn-gold text-xs"
                  disabled={s.visas.includes(p.region)}
                  onClick={() => act(() => applyForVisa(s, p.region), 'Đã cấp visa! 🛂')}
                >
                  {s.visas.includes(p.region) ? 'Đã có visa' : `🛂 Visa ${formatMoney(VISA_FEE)}`}
                </button>
                <button
                  className="btn-gold text-xs"
                  disabled={s.etex}
                  onClick={() => act(() => openEtexCard(s), 'Đã mở thẻ ETEX! 💳')}
                >
                  {s.etex ? 'Đã có ETEX' : `💳 ETEX ${formatMoney(ETEX_CARD_FEE)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {p.gov === 'dangky' && (
          <div className="mt-3">
            <StatRow k="Quy mô bản đồ" v={`${s.plots.length.toLocaleString('vi-VN')} ô (28×${getMapHeight(s)})`} />
            <StatRow
              k="Mở rộng tiếp theo"
              v={
                getDaysUntilNextExpansion(s) !== null
                  ? `Sau ${getDaysUntilNextExpansion(s)} ngày (+56 ô)`
                  : 'Đã đạt tối đa'
              }
            />
            <StatRow k="Lô đất trống" v={s.plots.filter((pl) => pl.kind === 'land' && !pl.owner).length} />
            <StatRow k="Lô của bạn" v={getOwnedPlots(s).length} />
          </div>
        )}
      </div>
    );
  }

  const landPrice = getLandPrice(s, p);
  const totalValue = getPlotTotalValue(s, p);
  const bDef = p.b ? BUILDINGS[p.b.type] : null;
  const foreignErr = isForeignRegion(p.region) ? checkForeignPermission(s, p) : null;
  const canPaint = Boolean(!readOnly && p.owner === 'me' && p.b && p.b.buildLeft === 0);

  const applyWall = (hex: string) => {
    act(() => paintBuilding(p, { wall: hex, roof: p.b?.paint?.roof }));
  };

  const applyRoof = (hex: string) => {
    act(() => paintBuilding(p, { wall: p.b?.paint?.wall, roof: hex }));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1 text-xs">
        <span className="rounded-full bg-secondary px-2 py-0.5">Lô #{p.id}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {REGION_NAMES[p.region]}
          {isForeignRegion(p.region) ? ` · ${FOREIGN_INFO[p.region].city}` : ''}
        </span>
        {isNearRoad(s, p) && <span className="rounded-full bg-secondary px-2 py-0.5">🛣 Mặt đường</span>}
        {p.forSale && p.owner !== 'me' && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-destructive-foreground">Đang rao bán</span>
        )}
      </div>

      <StatRow k="Diện tích" v={`${p.area} m²`} />
      <StatRow k="Loại đất" v={LAND_TYPES[p.region]} />
      <StatRow k="Giá đất" v={`${formatMoney(landPrice)} (${formatMoney(landPrice / p.area)}/m²)`} c="text-primary" />
      <StatRow k="Chủ sở hữu" v={ownerLabel(s, p, visitOwnerName)} />

      {bDef && p.b && (
        <>
          <StatRow k="Công trình" v={`${bDef.name} · cấp ${p.b.level}`} />
          {p.b.buildLeft > 0 ? (
            <StatRow k="Đang xây" v={`còn ${p.b.buildLeft} ngày`} c="text-primary" />
          ) : (
            <StatRow
              k="Thu nhập/ngày"
              v={
                p.owner === 'me'
                  ? formatMoney(getDailyIncome(s, p)) + (bDef.rental && !p.b.rented ? ' (chưa có khách)' : '')
                  : '—'
              }
              c="text-success"
            />
          )}
          <StatRow k="Tổng giá trị" v={formatMoney(totalValue)} />
          {readOnly && p.b.paint && (p.b.paint.wall || p.b.paint.roof) && (
            <div className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="text-muted-foreground">Màu sơn nhà</span>
              <span className="inline-flex items-center gap-1.5">
                {p.b.paint.wall && (
                  <span
                    title="Màu tường"
                    style={{ backgroundColor: p.b.paint.wall }}
                    className="inline-block h-4 w-4 rounded-full border border-white/40"
                  />
                )}
                {p.b.paint.roof && (
                  <span
                    title="Màu mái"
                    style={{ backgroundColor: p.b.paint.roof }}
                    className="inline-block h-4 w-4 rounded-full border border-white/40"
                  />
                )}
              </span>
            </div>
          )}
        </>
      )}

      {!readOnly && foreignErr && (
        <p className="mt-2 rounded-lg bg-secondary p-2 text-xs">
          🛂 {foreignErr} Chạm vào tòa nhà Chính phủ ở giữa nước này để đăng ký.
        </p>
      )}

      {/* Custom Building Color Studio */}
      {canPaint && paintOpen && p.b && (
        <section className="mt-3 space-y-2.5 rounded-2xl border border-border bg-secondary/80 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Palette size={14} /> Sơn màu công trình (miễn phí)
            </span>
            {p.b.paint && (
              <button
                type="button"
                onClick={() => act(() => paintBuilding(p, null), 'Đã khôi phục màu mặc định')}
                className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={11} /> Mặc định
              </button>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Màu tường</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-foreground">
                <span>Tự chọn</span>
                <input
                  type="color"
                  value={p.b.paint?.wall ?? '#efe2c6'}
                  onChange={(e) => applyWall(e.target.value)}
                  className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WALL_SWATCHES.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.name}
                  onClick={() => applyWall(sw.hex)}
                  style={{ backgroundColor: sw.hex }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    p.b?.paint?.wall === sw.hex ? 'border-primary ring-2 ring-primary/50' : 'border-black/25'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Màu mái &amp; điểm nhấn</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-foreground">
                <span>Tự chọn</span>
                <input
                  type="color"
                  value={p.b.paint?.roof ?? '#b84836'}
                  onChange={(e) => applyRoof(e.target.value)}
                  className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROOF_SWATCHES.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.name}
                  onClick={() => applyRoof(sw.hex)}
                  style={{ backgroundColor: sw.hex }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    p.b?.paint?.roof === sw.hex ? 'border-primary ring-2 ring-primary/50' : 'border-black/25'
                  }`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {readOnly ? (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-center text-xs text-primary">
          👁️ Bạn đang tham quan thành phố của <b>{visitOwnerName ?? 'đại gia'}</b> (chế độ chỉ xem).
        </div>
      ) : (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {p.kind === 'land' && !p.owner && (
          <button
            className="btn-gold col-span-2"
            disabled={s.cash < landPrice * 1.005}
            onClick={() => act(() => buyEmptyLand(s, p), 'Đã mua đất! 🎉', p)}
          >
            Mua {formatMoney(landPrice * 1.005)}
          </button>
        )}

        {p.owner && p.owner !== 'me' && !isCityLandmarkPlot(p) && (
          <button className="btn-gold col-span-2" onClick={() => act(() => startBuyNegotiation(s, p))}>
            🤝 Thương lượng mua
          </button>
        )}

        {p.owner === 'me' && (
          <>
            {!p.b && (
              <button className="btn-gold" onClick={openBuild}>
                🏗 Xây dựng
              </button>
            )}
            {p.b && p.b.buildLeft === 0 && p.b.level < 3 && (
              <button
                className="btn-gold text-xs"
                onClick={() => act(() => upgradeBuilding(s, p), 'Đang nâng cấp!', p)}
              >
                ⬆ Nâng cấp {formatMoney(getUpgradeCost(p.b))}
              </button>
            )}
            {canPaint && (
              <button
                type="button"
                className="btn-ghost flex items-center justify-center gap-1.5 text-xs"
                onClick={() => setPaintOpen((prev) => !prev)}
              >
                <Palette size={14} className="text-primary" />
                {paintOpen ? 'Đóng bảng màu' : '🎨 Sơn màu nhà'}
              </button>
            )}
            {p.b && bDef?.rental && p.b.buildLeft === 0 && (
              <button className="btn-ghost text-xs" onClick={() => act(() => toggleRentalListing(p))}>
                {p.b.listed ? (p.b.rented ? 'Ngừng cho thuê' : 'Hủy đăng thuê') : 'Đăng cho thuê'}
              </button>
            )}
            <button className="btn-ghost text-xs" onClick={() => act(() => startSellNegotiation(s, p))}>
              💰 Bán (thương lượng)
            </button>
            {p.b && (
              <button className="btn-ghost text-xs" onClick={() => act(() => demolishBuilding(s, p), 'Đã phá dỡ')}>
                Phá dỡ
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
