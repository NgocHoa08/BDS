import { MILLION, REGION_NAMES } from '../../game/constants';
import { bidInAuction, closeAuction, formatMoney, getLandPrice, getNpcById, saveGameState } from '../../game/engine';
import { notifyStore, playSfx, pushFloatingFx } from '../../game/store';
import type { GameState } from '../../game/types';
import { ModalFrame } from '../ui';

export function AuctionModal({ s, toast }: { s: GameState; toast: (msg: string) => void }) {
  const auction = s.auction;
  if (!auction) return null;
  const plot = s.plots[auction.plotId];
  const nextBid = Math.round((auction.bid * 1.06) / MILLION) * MILLION;

  return (
    <ModalFrame>
      <h3 className="text-gold text-xl font-black">🔨 Đấu giá đất</h3>
      <p className="text-sm text-muted-foreground">
        UBND đấu giá lô #{plot.id} · {REGION_NAMES[plot.region]} · {plot.area}m² · Định giá{' '}
        {formatMoney(getLandPrice(s, plot))}
      </p>

      <div className="my-3 rounded-2xl bg-secondary p-3 text-center">
        <div className="text-xs text-muted-foreground">Giá cao nhất hiện tại</div>
        <div className="text-gold text-2xl font-black">{formatMoney(auction.bid)}</div>
        <div className="text-xs">
          {auction.leader === 'me'
            ? 'Bạn đang dẫn đầu'
            : auction.leader
              ? `${getNpcById(s, auction.leader)?.name ?? 'Đối thủ'} đang dẫn`
              : 'Chưa có ai trả giá'}
        </div>
      </div>

      {auction.done ? (
        <button
          className="btn-gold w-full"
          onClick={() => {
            toast('🏆 Bạn đã thắng đấu giá!');
            pushFloatingFx(plot.x, plot.y, 'Trúng đấu giá!', '#ffd166');
            playSfx('win');
            closeAuction(s);
            saveGameState(s);
            notifyStore();
          }}
        >
          🏆 Nhận đất
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              closeAuction(s);
              notifyStore();
            }}
          >
            Bỏ cuộc
          </button>
          <button
            className="btn-gold"
            onClick={() => {
              const err = bidInAuction(s);
              if (err) {
                toast('⚠ ' + err);
                playSfx('error');
              } else {
                playSfx('coin');
              }
              notifyStore();
            }}
          >
            Trả {formatMoney(nextBid)}
          </button>
        </div>
      )}
    </ModalFrame>
  );
}
