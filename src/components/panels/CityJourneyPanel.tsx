import { useState } from 'react';
import { Check, Megaphone, Navigation, Trophy } from 'lucide-react';
import {
  BUILDINGS,
  CAMPAIGNS,
  FOREIGN_INFO,
  isForeignRegion,
  isLandmarkType,
  MISSIONS,
  REGION_NAMES,
} from '../../game/constants';
import {
  buyCityLandmark,
  checkForeignPermission,
  claimMission,
  formatMoney,
  getLandmarkBuyoutTotalCost,
  getMissionProgress,
  getNetWorth,
  getPlayerTitle,
  getTetCalendar,
  getPlotTotalValue,
  isCityLandmarkPlot,
  isTetNightActive,
  launchCampaign,
  setTetMode,
} from '../../game/engine';
import { broadcastServerNews } from '../../game/leaderboard';
import type { CampaignType, GameState, RegionId, TetMode } from '../../game/types';
import { Button, type ActionRunner } from '../ui';

export function CityJourneyPanel({
  s,
  act,
  onVisit,
  onVisitPalace,
}: {
  s: GameState;
  act: ActionRunner;
  onVisit: (plotId: number) => void;
  onVisitPalace: () => void;
}) {
  const [tab, setTab] = useState<'missions' | 'city'>('missions');
  const [campRegion, setCampRegion] = useState<RegionId>('city');

  const landmarks = s.plots.filter((p) => p.b && isLandmarkType(p.b.type));
  const tetCal = getTetCalendar(s);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Trophy className="text-primary" size={24} />
        <div>
          <b>{getPlayerTitle(s)}</b>
          <p className="text-xs text-muted-foreground">
            {s.claimedMissions.length}/{MISSIONS.length} nhiệm vụ · {formatMoney(getNetWorth(s))} tài sản ròng
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === 'missions' ? 'default' : 'secondary'} onClick={() => setTab('missions')}>
          Nhiệm vụ
        </Button>
        <Button variant={tab === 'city' ? 'default' : 'secondary'} onClick={() => setTab('city')}>
          Thành phố
        </Button>
      </div>

      {tab === 'missions' ? (
        <div className="space-y-3">
          {MISSIONS.map((m) => {
            const prog = Math.min(m.target, getMissionProgress(s, m.id));
            const claimed = s.claimedMissions.includes(m.id);
            return (
              <article key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <b className="text-sm">{m.name}</b>
                  <span className="shrink-0 text-xs font-bold text-primary">+{formatMoney(m.reward)}</span>
                </div>
                <p className="my-1 text-xs text-muted-foreground">{m.detail}</p>
                <progress
                  className="mission-progress my-2 h-1.5 w-full"
                  value={claimed ? m.target : prog}
                  max={m.target}
                  aria-label={m.detail}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {m.id === 'income' ? `${formatMoney(prog)} / ${formatMoney(m.target)}` : `${prog} / ${m.target}`}
                  </span>
                  <Button
                    size="sm"
                    variant={claimed ? 'ghost' : 'default'}
                    disabled={claimed || prog < m.target}
                    onClick={() => act(() => claimMission(s, m.id), 'Đã nhận thưởng nhiệm vụ!')}
                  >
                    {claimed ? (
                      <>
                        <Check size={14} /> Đã nhận
                      </>
                    ) : (
                      'Nhận thưởng'
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-3 border-b border-border pb-4">
            <h3 className="font-bold">Lịch Tết toàn quốc</h3>
            <p className="text-xs text-muted-foreground">
              Lịch mô phỏng · Năm {tetCal.year} · Ngày {tetCal.day}/360
            </p>
            <select
              aria-label="Chế độ lịch Tết"
              value={s.tetMode}
              onChange={(e) => act(() => setTetMode(s, e.target.value as TetMode))}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
            >
              <option value="off">Tắt lễ hội</option>
              <option value="calendar">Theo lịch · Giao thừa đến mùng 7</option>
              <option value="tet">Mùa Tết · Mỗi đêm</option>
            </select>
            <p className="text-xs text-primary">
              {isTetNightActive(s)
                ? 'Đêm Tết · Pháo hoa và ánh sáng toàn quốc'
                : tetCal.celebrating
                  ? 'Mùa Tết · Chờ đêm xuống'
                  : 'Ngày thường'}
            </p>
          </section>

          <article className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <b className="text-sm">Dinh Độc Lập</b>
              <p className="text-xs text-muted-foreground">Khuôn viên 2×2 ô · Rìa thành phố</p>
              <p className="mt-1 text-xs text-primary">Di tích công cộng</p>
            </div>
            <Button
              aria-label="Đến Dinh Độc Lập"
              title="Đến Dinh Độc Lập"
              size="icon"
              variant="outline"
              onClick={onVisitPalace}
            >
              <Navigation size={16} />
            </Button>
          </article>

          <section className="space-y-3">
            <div>
              <h3 className="font-bold">Công trình biểu tượng</h3>
              <p className="text-[11px] text-muted-foreground">
                Đấu thầu mua lại từ Thành phố bằng tiền mặt để hoàn thành nhiệm vụ Chạm tới bầu trời (+1 tỷ).
              </p>
            </div>
            {landmarks.map((plot) => {
              const isOwned = plot.owner === 'me';
              const isCity = isCityLandmarkPlot(plot);
              const buyoutCost = isCity ? getLandmarkBuyoutTotalCost(s, plot) : 0;
              const permErr = isForeignRegion(plot.region) ? checkForeignPermission(s, plot) : null;
              const lmName = plot.b ? BUILDINGS[plot.b.type].name : 'Tháp biểu tượng';

              return (
                <article key={plot.id} className="space-y-2 border-b border-border pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <b className="truncate text-sm">{lmName}</b>
                        {isOwned && (
                          <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            Của bạn
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {plot.b?.type === 'thap_81'
                          ? 'Cảm hứng Landmark 81 · Tháp tầng bậc'
                          : plot.b?.type === 'thap_sen'
                            ? 'Cảm hứng Bitexco · Dáng búp sen'
                            : `${REGION_NAMES[plot.region]} · ${isForeignRegion(plot.region) ? FOREIGN_INFO[plot.region].city : ''}`}
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        Lô #{plot.id} · Thu ~{plot.b ? formatMoney(BUILDINGS[plot.b.type].income) : '0'}/ngày ·{' '}
                        {isCity ? `Đấu thầu ${formatMoney(buyoutCost)}` : formatMoney(getPlotTotalValue(s, plot))}
                      </p>
                    </div>
                    <Button
                      aria-label={`Đến ${lmName}`}
                      title="Đến công trình"
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => onVisit(plot.id)}
                    >
                      <Navigation size={16} />
                    </Button>
                  </div>

                  {isCity && (
                    <button
                      type="button"
                      disabled={Boolean(permErr) || s.cash < buyoutCost}
                      onClick={() => {
                        if (!window.confirm(`Đấu thầu mua lại ${lmName} giá ${formatMoney(buyoutCost)}?`)) return;
                        act(() => {
                          const res = buyCityLandmark(s, plot);
                          if (res.error) return res.error;
                          broadcastServerNews(
                            `🏆 {player} vừa đấu thầu sở hữu siêu công trình biểu tượng ${res.landmarkName ?? lmName} giá ${formatMoney(res.totalPaid ?? buyoutCost)}!`
                          ).catch(() => {});
                          return null;
                        }, `🏆 Đấu thầu thành công ${lmName}!`, plot);
                      }}
                      className="btn-gold w-full py-1.5 text-xs font-black"
                    >
                      {permErr
                        ? `🛂 Cần Visa & ETEX (${REGION_NAMES[plot.region]})`
                        : `🏆 Đấu thầu sở hữu (${formatMoney(buyoutCost)})`}
                    </button>
                  )}
                </article>
              );
            })}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="flex items-center gap-2 font-bold">
              <Megaphone size={18} /> Chiến dịch kinh doanh
            </h3>
            <select
              aria-label="Khu vực chiến dịch"
              value={campRegion}
              onChange={(e) => setCampRegion(e.target.value as RegionId)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
            >
              {(Object.keys(REGION_NAMES) as RegionId[]).map((reg) => (
                <option key={reg} value={reg}>
                  {REGION_NAMES[reg]}
                </option>
              ))}
            </select>

            {(Object.keys(CAMPAIGNS) as CampaignType[]).map((cType) => {
              const def = CAMPAIGNS[cType];
              const activeInRegion = s.campaigns.some((c) => c.region === campRegion && c.endDay > s.day);
              return (
                <article key={cType} className="rounded-lg border border-border p-3">
                  <b className="text-sm">{def.name}</b>
                  <p className="my-2 text-xs text-muted-foreground">
                    +{Math.round(def.boost * 100)}% doanh thu khu vực · {def.days} ngày · {formatMoney(def.cost)}
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={s.cash < def.cost || activeInRegion}
                    onClick={() => act(() => launchCampaign(s, cType, campRegion), 'Chiến dịch đã bắt đầu!')}
                  >
                    Triển khai
                  </Button>
                </article>
              );
            })}

            {s.campaigns.map((c) => (
              <p key={`${c.region}-${c.type}`} className="text-xs text-success">
                {CAMPAIGNS[c.type].name} · {REGION_NAMES[c.region]} · còn {c.endDay - s.day} ngày
              </p>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
