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
  getLandPrice,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  getUpgradeCost,
  isCityLandmarkPlot,
  isNearRoad,
  openEtexCard,
  startBuyNegotiation,
  startSellNegotiation,
  toggleRentalListing,
  upgradeBuilding,
} from '../../game/engine';
import type { GameState, Plot, RegionId } from '../../game/types';
import { StatRow, type ActionRunner } from '../ui';

function ownerLabel(s: GameState, p: Plot): string {
  if (p.owner === 'me') return 'Bạn';
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
}: {
  s: GameState;
  p: Plot;
  act: ActionRunner;
  openBuild: () => void;
}) {
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
          </div>
        )}

        {p.gov === 'dangky' && (
          <div className="mt-3">
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
      <StatRow k="Chủ sở hữu" v={ownerLabel(s, p)} />

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
        </>
      )}

      {foreignErr && (
        <p className="mt-2 rounded-lg bg-secondary p-2 text-xs">
          🛂 {foreignErr} Chạm vào tòa nhà Chính phủ ở giữa nước này để đăng ký.
        </p>
      )}

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
    </div>
  );
}
