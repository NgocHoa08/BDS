import { useState } from 'react';
import { MILLION, PERSONA_LABELS } from '../../game/constants';
import {
  acceptNegotiationAsk,
  formatMoney,
  getNpcById,
  getPlotTotalValue,
  proposeNegotiationPrice,
  saveGameState,
} from '../../game/engine';
import { notifyStore, playSfx, pushFloatingFx } from '../../game/store';
import type { GameState } from '../../game/types';
import { ModalFrame } from '../ui';

export function NegotiationModal({ s, toast }: { s: GameState; toast: (msg: string) => void }) {
  const nego = s.nego;
  if (!nego) return null;
  const npc = getNpcById(s, nego.npcId);
  const plot = s.plots[nego.plotId];
  const valuation = getPlotTotalValue(s, plot);
  const [offerM, setOfferM] = useState(() =>
    Math.round((nego.mode === 'buy' ? nego.ask * 0.85 : nego.ask * 1.15) / MILLION)
  );

  return (
    <ModalFrame>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-2xl">
          {npc?.rival ? '🏢' : '🧑'}
        </div>
        <div>
          <div className="font-bold">{npc?.name}</div>
          <div className="text-xs text-muted-foreground">
            {npc?.role} · {npc ? PERSONA_LABELS[npc.persona] : ''} · Kiên nhẫn{' '}
            {'❤'.repeat(Math.max(0, nego.patience))}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {nego.mode === 'buy' ? 'Mua' : 'Bán'} lô #{plot.id} · {plot.area}m² · Định giá {formatMoney(valuation)}
      </div>

      <div className="my-3 max-h-40 space-y-1.5 overflow-y-auto">
        {nego.lines.map((line, idx) => (
          <div
            key={idx}
            className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
              line.who === 'me' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-secondary'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      {nego.done ? (
        <button
          className="btn-gold w-full"
          onClick={() => {
            if (nego.done === 'ok') {
              pushFloatingFx(plot.x, plot.y, 'Giao dịch thành công!', '#ffd166');
              toast('🤝 Giao dịch hoàn tất!');
              playSfx('win');
              saveGameState(s);
            }
            s.nego = null;
            notifyStore();
          }}
        >
          {nego.done === 'ok' ? '🎉 Hoàn tất' : 'Đóng'}
        </button>
      ) : (
        <>
          <div className="text-gold mb-1 text-center text-xl font-black">{formatMoney(offerM * MILLION)}</div>
          <input
            type="range"
            className="w-full accent-[var(--color-primary)]"
            min={Math.max(1, Math.round((valuation * 0.5) / MILLION))}
            max={Math.max(2, Math.round((valuation * 1.8) / MILLION))}
            value={offerM}
            onChange={(e) => setOfferM(Number(e.target.value))}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              className="btn-ghost text-xs sm:text-sm"
              onClick={() => {
                s.nego = null;
                notifyStore();
              }}
            >
              Rời đi
            </button>
            <button
              className="btn-ghost text-xs sm:text-sm"
              onClick={() => {
                acceptNegotiationAsk(s);
                playSfx('coin');
                notifyStore();
              }}
            >
              Đồng ý {formatMoney(nego.ask)}
            </button>
            <button
              className="btn-gold text-xs sm:text-sm"
              onClick={() => {
                proposeNegotiationPrice(s, offerM * MILLION);
                playSfx('click');
                notifyStore();
              }}
            >
              Đề nghị
            </button>
          </div>
        </>
      )}
    </ModalFrame>
  );
}
