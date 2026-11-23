import { useState } from 'react';
import { CalendarCheck2, Check, Flame, Gift, Sparkles, Target } from 'lucide-react';
import {
  DAILY_QUESTS,
  DAILY_STREAK_REWARDS,
  LANDMARK_SYNERGY_BOOST,
  LUCKY_WHEEL_PRIZES,
  SYNERGY_RULES,
} from '../../game/constants';
import {
  claimDailyCheckIn,
  claimDailyQuest,
  ensureDailyState,
  formatMoney,
  getDailyQuestProgress,
  saveGameState,
  spinLuckyWheel,
} from '../../game/engine';
import { notifyStore, playSfx } from '../../game/store';
import type { GameState } from '../../game/types';
import { Button } from '../ui';

export function RewardsPanel({
  s,
  onToast,
}: {
  s: GameState;
  onToast: (msg: string) => void;
}) {
  const daily = ensureDailyState(s);
  const [tab, setTab] = useState<'daily' | 'wheel' | 'synergy'>('daily');
  const [wheelDeg, setWheelDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastPrizeMsg, setLastPrizeMsg] = useState<string | null>(null);

  const sliceCount = LUCKY_WHEEL_PRIZES.length;
  const sliceAngle = 360 / sliceCount;

  const handleCheckIn = () => {
    const res = claimDailyCheckIn(s);
    if (res.error) {
      playSfx('error');
      onToast('⚠ ' + res.error);
      return;
    }
    playSfx('win');
    if (res.summary) onToast(res.summary);
    saveGameState(s);
    notifyStore();
  };

  const handleClaimQuest = (questId: string) => {
    const res = claimDailyQuest(s, questId);
    if (res.error) {
      playSfx('error');
      onToast('⚠ ' + res.error);
      return;
    }
    playSfx('win');
    if (res.summary) onToast(res.summary);
    saveGameState(s);
    notifyStore();
  };

  const handleSpin = () => {
    if (spinning) return;
    const res = spinLuckyWheel(s);
    if (res.error || res.prizeIndex === undefined) {
      playSfx('error');
      onToast('⚠ ' + (res.error ?? 'Hết lượt quay!'));
      return;
    }

    setSpinning(true);
    setLastPrizeMsg(null);
    playSfx('click');

    // Compute exact rotation so chosen slice center aligns with the top pointer (0 deg)
    const targetCenter = res.prizeIndex * sliceAngle + sliceAngle / 2;
    const desiredMod = (360 - targetCenter) % 360;
    const currentMod = ((wheelDeg % 360) + 360) % 360;
    const delta = (desiredMod - currentMod + 360) % 360;
    const nextDeg = wheelDeg + 360 * 5 + delta;
    setWheelDeg(nextDeg);

    saveGameState(s);
    notifyStore();

    window.setTimeout(() => {
      setSpinning(false);
      playSfx('win');
      if (res.summary) {
        setLastPrizeMsg(res.summary);
        onToast(res.summary);
      }
    }, 2900);
  };

  const nextStreakDay = daily.checkedIn ? daily.streak : (daily.streak % 7) + 1;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab('daily')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'daily'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarCheck2 size={13} /> Điểm danh
        </button>
        <button
          type="button"
          onClick={() => setTab('wheel')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'wheel'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gift size={13} /> Vòng quay ({daily.spinsLeft})
        </button>
        <button
          type="button"
          onClick={() => setTab('synergy')}
          className={`flex items-center justify-center gap-1 rounded-xl py-1.5 transition ${
            tab === 'synergy'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles size={13} /> Combo (+60%)
        </button>
      </div>

      {/* TAB 1: 7-DAY STREAK & DAILY QUESTS */}
      {tab === 'daily' && (
        <div className="space-y-4">
          {/* 7-Day Streak Grid */}
          <section className="space-y-2.5 rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/15 via-secondary/70 to-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-black text-primary">
                <Flame size={16} /> Chuỗi Điểm Danh 7 Ngày
              </div>
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-bold">
                Chuỗi: {daily.streak}/7 ngày
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {DAILY_STREAK_REWARDS.map((item) => {
                const isClaimed = daily.checkedIn ? item.day <= daily.streak : item.day < nextStreakDay;
                const isToday = item.day === nextStreakDay;
                const isGrand = item.day === 7;
                return (
                  <div
                    key={item.day}
                    className={`relative rounded-xl border p-2 text-center text-[10px] ${
                      isGrand ? 'col-span-2' : ''
                    } ${
                      isClaimed
                        ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                        : isToday
                          ? 'border-primary bg-primary/20 text-foreground ring-1 ring-primary/60'
                          : 'border-border/70 bg-background/40 text-muted-foreground'
                    }`}
                  >
                    <div className="font-bold">Ngày {item.day}</div>
                    <div className="mt-0.5 text-[10px] font-black leading-tight">{item.label}</div>
                    {isClaimed && (
                      <span className="absolute right-1 top-1 text-emerald-400">
                        <Check size={11} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={daily.checkedIn}
              onClick={handleCheckIn}
              className="btn-gold w-full py-2 text-xs font-black disabled:opacity-50"
            >
              {daily.checkedIn
                ? '✅ Đã điểm danh hôm nay — Quay lại ngày mai nhé!'
                : `🎁 Điểm danh Ngày ${nextStreakDay} ngay!`}
            </button>
          </section>

          {/* Daily Quests */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <Target size={15} className="text-primary" /> Nhiệm vụ hằng ngày
              </h3>
              <span className="text-[11px] text-muted-foreground">Làm mới mỗi ngày</span>
            </div>

            {DAILY_QUESTS.map((q) => {
              const prog = Math.min(q.target, getDailyQuestProgress(s, q.id));
              const claimed = daily.claimedQuests.includes(q.id);
              const done = prog >= q.target;

              return (
                <article key={q.id} className="rounded-xl border border-border bg-secondary/70 p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">{q.name}</div>
                      <div className="text-[11px] text-muted-foreground">{q.detail}</div>
                    </div>
                    <span className="shrink-0 text-right font-bold text-primary">
                      +{formatMoney(q.rewardCash)}
                      {q.rewardSpins > 0 && <div className="text-[10px] text-emerald-400">+1 lượt quay 🎡</div>}
                    </span>
                  </div>

                  <progress
                    className="mission-progress my-2 h-1.5 w-full"
                    value={claimed ? q.target : prog}
                    max={q.target}
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {q.id === 'dq_earn'
                        ? `${formatMoney(prog)} / ${formatMoney(q.target)}`
                        : `${prog} / ${q.target}`}
                    </span>
                    <Button
                      size="sm"
                      variant={claimed ? 'ghost' : 'default'}
                      disabled={claimed || !done}
                      onClick={() => handleClaimQuest(q.id)}
                    >
                      {claimed ? '✅ Đã nhận' : 'Nhận thưởng'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      )}

      {/* TAB 2: LUCKY WHEEL */}
      {tab === 'wheel' && (
        <div className="space-y-4 text-center">
          <p className="text-xs text-muted-foreground">
            Mỗi ngày nhận <b>1 lượt quay miễn phí</b> — hoàn thành Nhiệm vụ ngày để nhận thêm lượt!
          </p>

          {/* Animated SVG Lucky Wheel */}
          <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
            {/* Pointer arrow at top */}
            <div
              className="absolute -top-2 left-1/2 z-10 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '18px solid #facc15',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              }}
            />

            <div
              className="h-52 w-52 rounded-full border-4 border-primary/80 shadow-2xl"
              style={{
                transform: `rotate(${wheelDeg}deg)`,
                transition: spinning ? 'transform 2.85s cubic-bezier(0.14, 0.86, 0.22, 1)' : 'none',
              }}
            >
              <svg viewBox="0 0 200 200" className="h-full w-full">
                {LUCKY_WHEEL_PRIZES.map((prize, idx) => {
                  const startDeg = idx * sliceAngle - 90;
                  const endDeg = startDeg + sliceAngle;
                  const sr = (startDeg * Math.PI) / 180;
                  const er = (endDeg * Math.PI) / 180;
                  const x1 = 100 + 98 * Math.cos(sr);
                  const y1 = 100 + 98 * Math.sin(sr);
                  const x2 = 100 + 98 * Math.cos(er);
                  const y2 = 100 + 98 * Math.sin(er);
                  const midDeg = startDeg + sliceAngle / 2;
                  const mr = (midDeg * Math.PI) / 180;
                  const tx = 100 + 62 * Math.cos(mr);
                  const ty = 100 + 62 * Math.sin(mr);

                  return (
                    <g key={prize.id}>
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                        fill={prize.color}
                        fillOpacity={0.85}
                        stroke="#111827"
                        strokeWidth="1.5"
                      />
                      <text
                        x={tx}
                        y={ty}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="20"
                        transform={`rotate(${midDeg + 90}, ${tx}, ${ty})`}
                      >
                        {prize.icon}
                      </text>
                    </g>
                  );
                })}
                <circle cx="100" cy="100" r="18" fill="#111827" stroke="#facc15" strokeWidth="3" />
                <text x="100" y="101" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" fill="#facc15">
                  VIP
                </text>
              </svg>
            </div>
          </div>

          {lastPrizeMsg && (
            <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/15 px-3 py-2 text-xs font-bold text-primary">
              {lastPrizeMsg}
            </div>
          )}

          <button
            type="button"
            disabled={spinning || daily.spinsLeft <= 0}
            onClick={handleSpin}
            className="btn-gold w-full py-2.5 text-sm font-black disabled:opacity-45"
          >
            {spinning
              ? '🎡 Đang quay...'
              : daily.spinsLeft > 0
                ? `🎡 QUAY NGAY (còn ${daily.spinsLeft} lượt)`
                : 'Hết lượt quay — Hoàn thành Nhiệm vụ ngày để nhận thêm!'}
          </button>

          {/* Prize Legend */}
          <div className="grid grid-cols-2 gap-1.5 text-left text-[11px]">
            {LUCKY_WHEEL_PRIZES.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 rounded-xl bg-secondary/70 px-2.5 py-1.5">
                <span className="text-sm">{p.icon}</span>
                <span className="truncate font-semibold">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: URBAN SYNERGY COMBO GUIDE */}
      {tab === 'synergy' && (
        <div className="space-y-2.5">
          <div className="rounded-2xl border border-primary/35 bg-primary/10 p-3 text-xs">
            <div className="font-black text-primary">✦ Quy hoạch thông minh — Nhân doanh thu tới +60%!</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Xây các công trình bổ trợ cách nhau trong bán kính <b>2 ô</b> sẽ tự động kích hoạt Combo cộng dồn doanh
              thu và phát sáng sao vàng <b>✦</b> trên bản đồ!
            </p>
          </div>

          {SYNERGY_RULES.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border bg-secondary/75 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {rule.icon} {rule.name}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300">
                  +{Math.round(rule.boost * 100)}% thu nhập
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{rule.hint}</p>
            </div>
          ))}

          <div className="rounded-xl border border-primary/45 bg-gradient-to-r from-primary/15 to-secondary/70 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-primary">👑 Hào Quang Siêu Tháp</span>
              <span className="rounded-full bg-primary/25 px-2 py-0.5 text-[11px] font-black text-primary">
                +{Math.round(LANDMARK_SYNERGY_BOOST * 100)}% thu nhập
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Mọi công trình đặt trong bán kính <b>3 ô</b> quanh 1 trong 6 Tháp Biểu Tượng đều được hưởng hào quang tăng
              mạnh doanh thu!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
