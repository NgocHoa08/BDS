import { BUILDINGS, REGION_NAMES } from '../../game/constants';
import {
  formatMoney,
  getNpcById,
  getOwnedPlots,
  getPlotTotalValue,
  startSellNegotiation,
} from '../../game/engine';
import { notifyStore } from '../../game/store';
import type { GameState, RegionId } from '../../game/types';

export function LandPanel({ s, onPick }: { s: GameState; onPick: (plotId: number) => void }) {
  const owned = getOwnedPlots(s);

  return (
    <div className="space-y-3">
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
                  {npc?.name ?? 'Khách hàng'} trả <b className="text-primary">{formatMoney(offer.price)}</b> cho lô #
                  {offer.plotId}
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

      <h3 className="text-sm font-bold">Lô đất của bạn ({owned.length})</h3>
      {owned.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Bạn chưa có lô đất nào. Chạm vào ô đất trống trên bản đồ để mua. Vùng quê và vùng núi có giá rẻ nhất để khởi
          đầu.
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
  );
}
