import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  ChartColumn,
  Crown,
  Hammer,
  HandCoins,
  Landmark,
  Map as MapIcon,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  Settings,
  Store,
  Trophy,
  VolumeX,
} from 'lucide-react';
import { AuctionModal } from './components/modals/AuctionModal';
import { NegotiationModal } from './components/modals/NegotiationModal';
import { TutorialModal } from './components/modals/TutorialModal';
import { BankPanel } from './components/panels/BankPanel';
import { BuildPanel } from './components/panels/BuildPanel';
import { BusinessPanel } from './components/panels/BusinessPanel';
import { CityJourneyPanel } from './components/panels/CityJourneyPanel';
import { InvestPanel } from './components/panels/InvestPanel';
import { LandPanel } from './components/panels/LandPanel';
import { LeaderboardPanel } from './components/panels/LeaderboardPanel';
import { PlotPanel } from './components/panels/PlotPanel';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { BottomSheet, Button, type ActionRunner } from './components/ui';
import { BrandLogo } from './components/BrandLogo';
import { MISSIONS, SPEEDS } from './game/constants';
import {
  advanceTime,
  createInitialGameState,
  formatMoney,
  getNetWorth,
  loadGameState,
  saveGameState,
} from './game/engine';
import { CityCanvas } from './game/renderer/CityCanvas';
import {
  disposeLeaderboard,
  initLeaderboard,
  saveCloudState,
  syncPlayerScore,
  useLeaderboard,
} from './game/leaderboard';
import {
  GRAPHICS_PRESETS,
  notifyStore,
  playSfx,
  pushFloatingFx,
  setMusicEnabled,
  store,
  useGameVersion,
} from './game/store';
import { chillMusic } from './game/music';
import type { ActivePanel } from './game/types';

const PANEL_TITLES: Record<Exclude<ActivePanel, null>, string> = {
  plot: 'Thông tin lô đất',
  dat: 'Quản lý đất',
  build: 'Xây dựng',
  bank: 'Ngân hàng',
  biz: 'Kinh doanh',
  stats: 'Thống kê',
  settings: 'Cài đặt',
  invest: 'Đầu tư & gọi vốn',
  city: 'Hành trình BDSNH',
  palace: 'Dinh Độc Lập',
  leaderboard: 'Bảng xếp hạng BDSNH',
};

const NAV_ITEMS: Array<[Exclude<ActivePanel, null>, typeof Building2, string]> = [
  ['dat', Building2, 'Đất'],
  ['build', Hammer, 'Xây'],
  ['bank', Landmark, 'Ngân hàng'],
  ['biz', Store, 'Kinh doanh'],
  ['stats', ChartColumn, 'Thống kê'],
  ['settings', Settings, 'Cài đặt'],
];

export default function App() {
  useGameVersion();
  const lb = useLeaderboard();
  const [panel, setPanel] = useState<ActivePanel>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [tutStep, setTutStep] = useState(0);
  const toastSeqRef = useRef(0);
  const fpsRef = useRef<HTMLSpanElement | null>(null);

  const pushToast = useCallback((text: string) => {
    const id = ++toastSeqRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  // Main simulation loop & persistence + Supabase Realtime leaderboard & Cloud Save sync
  useEffect(() => {
    store.s = loadGameState() ?? createInitialGameState();
    notifyStore();
    initLeaderboard(store.s, (cloudState) => {
      store.s = cloudState;
      store.selected = null;
      notifyStore();
      pushToast('☁️ Đã tự động tải tiến trình Cloud của bạn!');
    }).catch(() => {});

    let last = performance.now();
    let rafId = 0;
    let lastHour = -1;

    const tick = (now: number) => {
      const s = store.s;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      if (s && !s.paused && !s.nego && !s.auction && s.tutorialDone) {
        const dayTicks = advanceTime(s, (dt * s.speed * 24) / 12);
        for (const res of dayTicks) {
          res.fx.forEach((item) => {
            const p = s.plots[item.plotId];
            if (p) pushFloatingFx(p.x, p.y, item.text, item.color);
          });
          res.events.forEach(pushToast);
        }
        if (dayTicks.length) {
          saveGameState(s);
          syncPlayerScore(s).catch(() => {});
          saveCloudState(s).catch(() => {});
        }
        const curHour = Math.floor(s.hour);
        if (curHour !== lastHour) {
          lastHour = curHour;
          notifyStore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const syncInterval = window.setInterval(() => {
      if (store.s && store.s.tutorialDone) {
        syncPlayerScore(store.s).catch(() => {});
        saveCloudState(store.s).catch(() => {});
      }
    }, 20000);

    const onFirstGesture = () => {
      if (store.musicEnabled) {
        chillMusic.unlockAndStart(true, store.musicVolume);
      }
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);

    const onHide = () => {
      if (store.s) {
        saveGameState(store.s);
        syncPlayerScore(store.s, true).catch(() => {});
        saveCloudState(store.s, true).catch(() => {});
      }
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(syncInterval);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      window.removeEventListener('pagehide', onHide);
      chillMusic.stop();
      disposeLeaderboard();
    };
  }, [pushToast]);

  // Helpful keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = store.s;
      if (!s) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        setPanel(null);
      } else if (e.key === ' ' && s.tutorialDone && !s.nego && !s.auction) {
        e.preventDefault();
        s.paused = !s.paused;
        notifyStore();
      } else if (e.key === '1') {
        s.speed = 1;
        s.paused = false;
        saveGameState(s);
        notifyStore();
      } else if (e.key === '2') {
        s.speed = 2;
        s.paused = false;
        saveGameState(s);
        notifyStore();
      } else if (e.key === 'h' || e.key === 'H') {
        s.heatmap = !s.heatmap;
        notifyStore();
      } else if (e.key === '+' || e.key === '=') {
        window.__zoom?.(1.25);
      } else if (e.key === '-') {
        window.__zoom?.(0.8);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const s = store.s;
  if (!s) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <BrandLogo size="lg" showSubtitle />
      </div>
    );
  }

  const runAction: ActionRunner = (fn, okToast, fxPlot) => {
    const err = fn();
    if (err) {
      pushToast('⚠ ' + err);
      playSfx('error');
    } else {
      if (okToast) {
        pushToast(okToast);
        if (fxPlot) pushFloatingFx(fxPlot.x, fxPlot.y, okToast, '#ffd166');
        playSfx(okToast.includes('Khởi công') || okToast.includes('nâng cấp') ? 'build' : 'coin');
      } else {
        playSfx('click');
      }
      saveGameState(s);
    }
    notifyStore();
  };

  const handlePlotTap = (plotId: number | null) => {
    store.selected = plotId;
    notifyStore();
    if (plotId !== null) {
      const p = s.plots[plotId];
      if (p && p.kind !== 'road' && p.kind !== 'water') {
        playSfx('click');
        setPanel('plot');
      }
    }
  };

  const selectedPlot = store.selected === null ? null : s.plots[store.selected] ?? null;
  const netWorth = getNetWorth(s);
  const day = s.day;
  const monthIdx = Math.floor((day - 1) / 30) + 1;
  const year = Math.floor((day - 1) / 360) + 1;
  const hr = Math.floor(s.hour);
  const min = Math.floor((s.hour % 1) * 60);

  return (
    <div className="relative h-dvh w-full overflow-hidden select-none bg-background text-foreground">
      <CityCanvas onTap={handlePlotTap} onPalaceTap={() => setPanel('palace')} fpsRef={fpsRef} />

      {/* Unified Top HUD Stack (never overlaps on notched or narrow phones) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="panel pointer-events-auto rounded-2xl px-2.5 py-2 sm:px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <BrandLogo size="sm" compactMobile className="border-r border-border pr-2 sm:pr-3" />
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-widest">
                  Tiền mặt
                </div>
                <div className="text-gold truncate whitespace-nowrap text-base font-black leading-tight sm:text-lg">
                  {formatMoney(s.cash)}
                </div>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-widest">
                Tài sản ròng
              </div>
              <div className="truncate whitespace-nowrap text-sm font-bold leading-tight text-success sm:text-base">
                {formatMoney(netWorth)}
              </div>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="inline-flex items-center gap-1 truncate whitespace-nowrap rounded-full bg-secondary px-2 py-0.5">
                <span>🍂</span>
                <span>{hr >= 6 && hr < 18 ? '☀️' : '🌙'}</span>
                <span>
                  {String(hr).padStart(2, '0')}:{String(min).padStart(2, '0')}
                </span>
                <span>·</span>
                <span>N{day}</span>
                <span className="hidden min-[360px]:inline">
                  · T{((monthIdx - 1) % 12) + 1} · Năm {year}
                </span>
              </span>
              {store.showFps && (
                <button
                  onClick={() => setPanel('settings')}
                  title="Cấu hình đồ hoạ & FPS"
                  className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] font-semibold text-success md:inline-flex"
                >
                  <span ref={fpsRef}>60 FPS</span>
                  <span className="text-muted-foreground">· {GRAPHICS_PRESETS[store.graphicsQuality].label}</span>
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                aria-label={store.musicEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
                title={store.musicEnabled ? 'Tắt nhạc nền Chill' : 'Bật nhạc nền Chill'}
                onClick={() => setMusicEnabled(!store.musicEnabled)}
                className={`rounded-full p-1.5 transition-colors ${
                  store.musicEnabled ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {store.musicEnabled ? <Music size={13} /> : <VolumeX size={13} />}
              </button>
              <button
                aria-label="Tạm dừng"
                onClick={() => {
                  s.paused = !s.paused;
                  notifyStore();
                }}
                className={`rounded-full p-1.5 ${
                  s.paused ? 'bg-destructive text-destructive-foreground' : 'bg-secondary'
                }`}
              >
                {s.paused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              {SPEEDS.map((spd) => (
                <Button
                  key={spd}
                  size="sm"
                  variant={s.speed === spd && !s.paused ? 'default' : 'secondary'}
                  onClick={() => {
                    s.speed = spd;
                    s.paused = false;
                    saveGameState(s);
                    notifyStore();
                  }}
                  className="h-6 px-2 text-[11px] sm:h-7 sm:text-xs"
                >
                  x{spd}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Mission & Realtime Leaderboard pills */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 border border-border px-2.5 text-xs"
            onClick={() => setPanel('city')}
          >
            <Trophy size={14} /> Nhiệm vụ {s.claimedMissions.length}/{MISSIONS.length}
          </Button>
          <Button
            aria-label="Bảng xếp hạng"
            variant="secondary"
            size="sm"
            className="h-8 border border-border px-2.5 text-xs"
            onClick={() => setPanel('leaderboard')}
          >
            <Crown size={14} className="text-primary" />
            {lb.myRank ? `#${lb.myRank}` : 'BXH'}
            {lb.status === 'connected' && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" title="Realtime online" />
            )}
          </Button>
          {s.auction && (
            <button onClick={notifyStore} className="btn-gold animate-pulse px-2.5 py-1.5 text-xs">
              🔨 Đấu giá #{s.auction.plotId}
            </button>
          )}
          {s.offers.length > 0 && (
            <button onClick={() => setPanel('dat')} className="btn-ghost px-2.5 py-1.5 text-xs">
              📩 {s.offers.length} đề nghị mua
            </button>
          )}
        </div>

        {/* Toasts neatly anchored below pills */}
        {toasts.length > 0 && (
          <div className="mt-0.5 flex flex-col items-center gap-1 px-2">
            {toasts.map((item) => (
              <div
                key={item.id}
                className="panel animate-pop max-w-[92vw] rounded-full px-3 py-1 text-center text-xs font-semibold"
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right floating toolbar (centered vertically) */}
      <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <button
          aria-label="Phóng to"
          title="Phóng to"
          onClick={() => window.__zoom?.(1.25)}
          className="panel rounded-full p-2 hover:brightness-110"
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
          onClick={() => window.__zoom?.(0.8)}
          className="panel rounded-full p-2 hover:brightness-110"
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Bản đồ giá"
          title="Bản đồ nhiệt giá đất"
          onClick={() => {
            s.heatmap = !s.heatmap;
            notifyStore();
          }}
          className={`panel rounded-full p-2 hover:brightness-110 ${s.heatmap ? 'text-primary' : ''}`}
        >
          <MapIcon size={18} />
        </button>
        <Button
          aria-label="Đầu tư và gọi vốn"
          title="Đầu tư và gọi vốn"
          size="icon"
          variant="secondary"
          className="rounded-full border border-border"
          onClick={() => setPanel('invest')}
        >
          <HandCoins size={18} />
        </Button>
      </div>

      {/* Bottom Navigation (crisp spacing even on 360px phones) */}
      <nav className="absolute inset-x-0 bottom-0 z-10 p-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-2">
        <div className="panel grid grid-cols-6 gap-0.5 rounded-2xl p-1">
          {NAV_ITEMS.map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setPanel(panel === key ? null : key)}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0 py-1.5 text-[9px] font-semibold leading-tight tracking-tight transition-colors sm:px-0.5 sm:text-[11px] sm:tracking-normal ${
                panel === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={18} className="shrink-0 sm:h-5 sm:w-5" />
              <span className="max-w-full whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Active Bottom Sheet */}
      {panel && (
        <BottomSheet title={PANEL_TITLES[panel]} onClose={() => setPanel(null)}>
          {panel === 'plot' && selectedPlot && (
            <PlotPanel s={s} p={selectedPlot} act={runAction} openBuild={() => setPanel('build')} />
          )}
          {panel === 'dat' && (
            <LandPanel
              s={s}
              onPick={(id) => {
                store.selected = id;
                window.dispatchEvent(new CustomEvent('city-focus', { detail: id }));
                setPanel('plot');
                notifyStore();
              }}
            />
          )}
          {panel === 'build' && <BuildPanel s={s} p={selectedPlot} act={runAction} />}
          {panel === 'bank' && <BankPanel s={s} act={runAction} />}
          {panel === 'invest' && <InvestPanel s={s} act={runAction} />}
          {panel === 'city' && (
            <CityJourneyPanel
              s={s}
              act={runAction}
              onVisitPalace={() => {
                window.dispatchEvent(new Event('palace-focus'));
                setPanel(null);
              }}
              onVisit={(id) => {
                store.selected = id;
                window.dispatchEvent(new CustomEvent('city-focus', { detail: id }));
                setPanel(null);
                notifyStore();
              }}
            />
          )}
          {panel === 'palace' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Landmark className="text-primary" size={22} />
                <b>Dinh Độc Lập</b>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Khuôn viên</dt>
                <dd>4 ô · 2×2</dd>
                <dt className="text-muted-foreground">Vị trí</dt>
                <dd>Rìa thành phố</dd>
                <dt className="text-muted-foreground">Loại công trình</dt>
                <dd>Di tích công cộng</dd>
              </dl>
            </div>
          )}
          {panel === 'biz' && (
            <BusinessPanel
              s={s}
              act={runAction}
              onPick={(id) => {
                store.selected = id;
                window.dispatchEvent(new CustomEvent('city-focus', { detail: id }));
                setPanel('plot');
                notifyStore();
              }}
            />
          )}
          {panel === 'stats' && <StatsPanel s={s} />}
          {panel === 'leaderboard' && (
            <LeaderboardPanel s={s} onToast={pushToast} onOpenSettings={() => setPanel('settings')} />
          )}
          {panel === 'settings' && (
            <SettingsPanel
              s={s}
              onToast={pushToast}
              onShowTutorial={() => {
                s.tutorialDone = false;
                setTutStep(0);
                setPanel(null);
                notifyStore();
              }}
            />
          )}
        </BottomSheet>
      )}

      {/* Modals */}
      {s.nego && <NegotiationModal s={s} toast={pushToast} />}
      {s.auction && <AuctionModal s={s} toast={pushToast} />}
      {!s.tutorialDone && (
        <TutorialModal
          step={tutStep}
          next={() => setTutStep((prev) => prev + 1)}
          done={() => {
            s.tutorialDone = true;
            saveGameState(s);
            notifyStore();
          }}
        />
      )}
    </div>
  );
}
