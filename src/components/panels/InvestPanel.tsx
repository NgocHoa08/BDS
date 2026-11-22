import { useState } from 'react';
import { Check, FilePenLine, HandCoins, X } from 'lucide-react';
import { BUILDABLE_TYPES, BUILDINGS, REGION_NAMES } from '../../game/constants';
import {
  canBuildInPlot,
  formatMoney,
  getActiveInvestment,
  getOwnedPlots,
  getProjectCapital,
  repayInvestment,
  signInvestment,
} from '../../game/engine';
import type { BuildingType, GameState } from '../../game/types';
import { Button, type ActionRunner } from '../ui';

export function InvestPanel({ s, act }: { s: GameState; act: ActionRunner }) {
  const emptyPlots = getOwnedPlots(s).filter((p) => !p.b && !getActiveInvestment(s, p.id));
  const investors = s.npcs.filter((n) => !n.rival);

  const [plotId, setPlotId] = useState<number>(emptyPlots[0]?.id ?? -1);
  const [npcId, setNpcId] = useState<string>(
    investors.find((n) => n.role === 'Nhà đầu tư')?.id ?? investors[0]?.id ?? ''
  );
  const [bType, setBType] = useState<BuildingType>('nha_cap4');
  const [term, setTerm] = useState<number>(180);
  const [drafting, setDrafting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const chosenPlot = emptyPlots.find((p) => p.id === plotId);
  const chosenNpc = investors.find((n) => n.id === npcId);
  const capital = getProjectCapital(bType);
  const ready = Boolean(chosenPlot && chosenNpc && canBuildInPlot(chosenPlot, bType) && chosenNpc.cash >= capital);

  const selectCls = 'mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <HandCoins className="text-primary" size={28} />
        <div>
          <h3 className="font-bold">Hợp tác đầu tư</h3>
          <p className="text-xs text-muted-foreground">Nhà đầu tư 70% · Bạn 30% lợi nhuận ròng</p>
        </div>
      </div>

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
      ) : (
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
      )}

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-bold">Sổ hợp đồng ({s.investments.length})</h3>
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
