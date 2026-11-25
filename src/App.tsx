import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChartColumn,
  Compass,
  Crown,
  Eye,
  Gift,
  Hammer,
  HandCoins,
  Landmark,
  Map as MapIcon,
  Megaphone,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  Settings,
  Store,
  Trophy,
  VolumeX,
  X,
} from 'lucide-react';
import { ChatWidget } from './components/ChatWidget';
import { AuctionModal } from './components/modals/AuctionModal';
import { DilemmaModal } from './components/modals/DilemmaModal';
import { NegotiationModal } from './components/modals/NegotiationModal';
import { OfflineModal } from './components/modals/OfflineModal';
import { TutorialModal } from './components/modals/TutorialModal';
import { BankPanel } from './components/panels/BankPanel';
import { BuildPanel, type BuildPanelTab } from './components/panels/BuildPanel';
import { BusinessPanel } from './components/panels/BusinessPanel';
import { CityJourneyPanel } from './components/panels/CityJourneyPanel';
import { InvestPanel } from './components/panels/InvestPanel';
import { LandPanel } from './components/panels/LandPanel';
import { LeaderboardPanel } from './components/panels/LeaderboardPanel';
import { PlotPanel } from './components/panels/PlotPanel';
import { RewardsPanel } from './components/panels/RewardsPanel';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { BottomSheet, Button, type ActionRunner } from './components/ui';
import { BrandLogo } from './components/BrandLogo';
import { BUILDINGS, isLandmarkType, MISSIONS, SEASON_INFO, SPEEDS } from './game/constants';
import {
  advanceTime,
  applyOfflineProgress,
  buildVisitedGameState,
  createInitialGameState,
  ensureDailyState,
  formatMoney,
  getCurrentSeason,
  getDailyNotificationCount,
  getNetWorth,
  getOwnedPlots,
  loadGameState,
  saveGameState,
  speedUpAllConstructions,
} from './game/engine';
import { CityCanvas } from './game/renderer/CityCanvas';
import {
  getFbInstantInfo,
  loadFbCloudState,
  onFbPause,
  saveFbCloudState,
} from './game/fbInstant';
import {
  broadcastServerNews,
  dismissLatestNews,
  disposeLeaderboard,
  fetchCitySnapshot,
  initLeaderboard,
  registerLiveStateGetter,
  saveCloudState,
  setChatOpen,
  setPlayerDisplayName,
  syncPlayerScore,
  useLeaderboard,
  type LeaderboardEntry,
} from './game/leaderboard';
import {
  enterVisitMode,
  exitVisitMode,
  getViewState,
  GRAPHICS_PRESETS,
  isFeverActive,
  notifyStore,
  playSfx,
  pushFloatingFx,
  setMusicEnabled,
  store,
  useGameVersion,
} from './game/store';
import { chillMusic } from './game/music';
import type { ActivePanel, GameState, OfflineReport } from './game/types';

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
  rewards: 'Phúc lợi & Quy hoạch',
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
  const [buildTab, setBuildTab] = useState<BuildPanelTab>('single');
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [tutStep, setTutStep] = useState(0);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const [visitingBusyId, setVisitingBusyId] = useState<string | null>(null);
  const visitCycleRef = useRef(0);
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
    const runOfflineCheck = (state: GameState) => {
      const report = applyOfflineProgress(state);
      if (report) {
        saveGameState(state);
        syncPlayerScore(state, true).catch(() => {});
        saveCloudState(state, true).catch(() => {});
        notifyStore();
        playSfx('coin');
        setOfflineReport(report);
      } else {
        saveGameState(state);
      }
    };

    store.s = loadGameState() ?? createInitialGameState();
    registerLiveStateGetter(() => store.s);
    runOfflineCheck(store.s);
    notifyStore();

    // Facebook Instant Games: auto-fill FB display name & pull FB Player Cloud Save if local is fresh
    const fb = getFbInstantInfo();
    if (fb.active) {
      if (fb.playerName && lb.playerName.startsWith('Đại gia #')) {
        setPlayerDisplayName(fb.playerName, store.s);
      }
      if (store.s.day <= 1 && store.s.total.revenue === 0) {
        loadFbCloudState()
          .then((fbState) => {
            if (fbState) {
              store.s = fbState;
              store.selected = null;
              runOfflineCheck(fbState);
              notifyStore();
              pushToast('🎮 Đã tải tiến trình từ Facebook Cloud!');
            }
          })
          .catch(() => {});
      }
    }

    initLeaderboard(store.s, (cloudState) => {
      store.s = cloudState;
      store.selected = null;
      runOfflineCheck(cloudState);
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

      if (s && !store.visiting && !s.paused && !s.nego && !s.auction && !s.dilemma && s.tutorialDone) {
        const feverMult = isFeverActive() ? 2 : 1;
        const dayTicks = advanceTime(s, (dt * s.speed * 24) / 12, feverMult);
        for (const res of dayTicks) {
          res.fx.forEach((item) => {
            const p = s.plots[item.plotId];
            if (p) pushFloatingFx(p.x, p.y, item.text, item.color);
          });
          res.events.forEach(pushToast);
          if (res.completedLandmarks?.length) {
            for (const lmName of res.completedLandmarks) {
              broadcastServerNews(`🏙️ {player} vừa khánh thành siêu công trình ${lmName}!`).catch(() => {});
            }
          }
        }
        if (dayTicks.length) {
          saveGameState(s);
          saveFbCloudState(s).catch(() => {});
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
        saveGameState(store.s);
        syncPlayerScore(store.s).catch(() => {});
        saveCloudState(store.s).catch(() => {});
      }
    }, 20000);

    // Active Golden Map Drop spawner (VIP Guests / Gift Chests / Fever x2 Stars every ~26s!)
    let dropSeq = 1;
    const dropInterval = window.setInterval(() => {
      const s = store.s;
      if (!s || !s.tutorialDone || s.paused || store.visiting) return;
      const nowMs = Date.now();
      if (store.mapDrop && store.mapDrop.expiresAt <= nowMs) {
        store.mapDrop = null;
        notifyStore();
      }
      if (!store.mapDrop && Math.random() < 0.55) {
        const owned = getOwnedPlots(s);
        const pool = owned.length ? owned : s.plots.filter((p) => p.kind === 'land' && p.x >= 8 && p.x <= 22 && p.y >= 8 && p.y <= 22);
        if (pool.length) {
          const target = pool[Math.floor(Math.random() * pool.length)];
          const roll = Math.random();
          const kind: 'vip' | 'gift' | 'fever' = roll < 0.45 ? 'vip' : roll < 0.78 ? 'gift' : 'fever';
          store.mapDrop = {
            id: dropSeq++,
            plotId: target.id,
            x: target.x,
            y: target.y,
            kind,
            expiresAt: nowMs + 22000,
          };
          notifyStore();
        }
      }
    }, 9000);

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
        saveFbCloudState(store.s, true).catch(() => {});
        syncPlayerScore(store.s, true).catch(() => {});
        saveCloudState(store.s, true).catch(() => {});
      }
    };
    const offFbPause = onFbPause(() => {
      onHide();
      chillMusic.stop();
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onHide();
      } else if (document.visibilityState === 'visible' && store.s) {
        last = performance.now();
        runOfflineCheck(store.s);
      }
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(syncInterval);
      window.clearInterval(dropInterval);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      offFbPause();
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
      } else if (e.key === '3' || e.key === '4') {
        s.speed = 4;
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

  const visiting = store.visiting;
  const viewState = getViewState() ?? s;

  const handleVisitCity = async (entry: LeaderboardEntry, rank: number) => {
    if (entry.user_id === lb.userId) {
      pushToast('Đó là thành phố của chính bạn!');
      return;
    }
    if (visitingBusyId) return;
    setVisitingBusyId(entry.user_id);
    try {
      const res = await fetchCitySnapshot(entry.user_id);
      if (!res.snapshot) {
        pushToast('⚠ ' + (res.error ?? 'Chưa thể tải bản đồ thành phố này.'));
        playSfx('error');
        return;
      }
      const visitedState = buildVisitedGameState({ day: entry.day, cash: entry.cash }, res.snapshot);
      const owned = getOwnedPlots(visitedState);
      const built = owned.filter((p) => p.b);
      enterVisitMode({
        userId: entry.user_id,
        playerName: entry.player_name,
        rank,
        netWorth: entry.net_worth,
        day: entry.day,
        title: entry.title,
        ownedCount: owned.length,
        buildingsCount: built.length,
        state: visitedState,
      });
      visitCycleRef.current = 0;
      setPanel(null);
      setChatOpen(false);
      playSfx('win');
      pushToast(`👁️ Đang tham quan thành phố của ${entry.player_name} (Hạng #${rank})`);

      // Auto-fly camera to their most impressive building (or first owned plot)
      const sorted = [...owned].sort((a, b) => {
        const scoreA = a.b ? (isLandmarkType(a.b.type) ? 1e12 : BUILDINGS[a.b.type].cost * a.b.level) : 0;
        const scoreB = b.b ? (isLandmarkType(b.b.type) ? 1e12 : BUILDINGS[b.b.type].cost * b.b.level) : 0;
        return scoreB - scoreA;
      });
      if (sorted[0]) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('city-focus', { detail: sorted[0].id }));
        }, 60);
      }
    } finally {
      setVisitingBusyId(null);
    }
  };

  const handleExitVisit = () => {
    exitVisitMode();
    setPanel(null);
    playSfx('click');
    pushToast('🏠 Đã quay về thành phố của bạn!');
  };

  const handleCycleVisitBuilding = () => {
    if (!visiting) return;
    const owned = getOwnedPlots(visiting.state);
    const targets = owned.filter((p) => p.b);
    const list = targets.length ? targets : owned;
    if (!list.length) {
      pushToast('Đại gia này chưa sở hữu lô đất nào trên bản đồ.');
      return;
    }
    const target = list[visitCycleRef.current % list.length];
    visitCycleRef.current += 1;
    store.selected = target.id;
    notifyStore();
    window.dispatchEvent(new CustomEvent('city-focus', { detail: target.id }));
    playSfx('click');
  };

  const handlePlotTap = (plotId: number | null) => {
    if (plotId !== null) {
      const raw = viewState.plots[plotId];
      // Clicking any of the 3 satellite plots of a 2x2 Mega-Project selects its anchor!
      const resolvedId = raw?.megaParentId != null ? raw.megaParentId : plotId;
      store.selected = resolvedId;
      notifyStore();
      const p = viewState.plots[resolvedId];
      if (p && p.kind !== 'road' && p.kind !== 'water') {
        playSfx('click');
        setPanel('plot');
      }
    } else {
      store.selected = null;
      notifyStore();
    }
  };

  const handleClaimMapDrop = () => {
    const drop = store.mapDrop;
    if (!drop || store.visiting) return;
    store.mapDrop = null;
    playSfx('win');

    const worth = getNetWorth(s);
    if (drop.kind === 'fever') {
      store.feverUntil = Date.now() + 25000;
      pushFloatingFx(drop.x, drop.y, '🔥 FEVER x2!', '#f97316');
      pushToast('🔥 CƠN SỐT GIAO DỊCH! Doanh thu x2 trong 25 giây!');
    } else if (drop.kind === 'gift') {
      const roll = Math.random();
      if (roll < 0.45) {
        ensureDailyState(s).spinsLeft += 1;
        pushFloatingFx(drop.x, drop.y, '🎁 +1 Lượt quay!', '#c084fc');
        pushToast('🎁 Hộp quà bí ẩn: +1 Lượt quay VIP miễn phí!');
      } else if (roll < 0.78) {
        const cnt = speedUpAllConstructions(s, 3);
        if (cnt > 0) {
          pushFloatingFx(drop.x, drop.y, '⚡ -3 ngày xây!', '#facc15');
          pushToast(`⚡ Hộp quà thi công: rút ngắn 3 ngày cho ${cnt} công trình!`);
        } else {
          const bonus = Math.max(120_000_000, Math.round((worth * 0.015) / 10_000_000) * 10_000_000);
          s.cash += bonus;
          pushFloatingFx(drop.x, drop.y, '+' + formatMoney(bonus), '#ffd166');
          pushToast(`🎁 Hộp quà bất ngờ: +${formatMoney(bonus)} tiền mặt!`);
        }
      } else {
        const bonus = Math.max(150_000_000, Math.round((worth * 0.02) / 10_000_000) * 10_000_000);
        s.cash += bonus;
        pushFloatingFx(drop.x, drop.y, '+' + formatMoney(bonus), '#ffd166');
        pushToast(`🎁 Hộp quà đại gia: +${formatMoney(bonus)} tiền mặt!`);
      }
    } else {
      const tip = Math.max(100_000_000, Math.min(4_000_000_000, Math.round((worth * 0.018) / 10_000_000) * 10_000_000));
      s.cash += tip;
      pushFloatingFx(drop.x, drop.y, '💼 +' + formatMoney(tip), '#fde047');
      pushToast(`💼 Đoàn khách VIP ghé thăm! Thưởng nóng +${formatMoney(tip)}!`);
    }
    saveGameState(s);
    notifyStore();
  };

  const selectedPlot = store.selected === null ? null : viewState.plots[store.selected] ?? null;
  const netWorth = getNetWorth(s);
  const day = s.day;
  const monthIdx = Math.floor((day - 1) / 30) + 1;
  const year = Math.floor((day - 1) / 360) + 1;
  const hr = Math.floor(s.hour);
  const min = Math.floor((s.hour % 1) * 60);
  const curSeason = getCurrentSeason(s);
  const seasonInfo = SEASON_INFO[curSeason];
  const dailyBadgeCount = getDailyNotificationCount(s);

  return (
    <div className="relative h-dvh w-full overflow-hidden select-none bg-background text-foreground">
      <CityCanvas
        onTap={handlePlotTap}
        onPalaceTap={() => setPanel('palace')}
        onMapDropTap={handleClaimMapDrop}
        fpsRef={fpsRef}
      />

      {/* Unified Top HUD Stack (adapts to ultra-compact single-row in mobile landscape!) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] [@media(max-height:520px)]:gap-1 [@media(max-height:520px)]:pt-1.5">
        {visiting ? (
          /* Visiting City Mode Top Banner */
          <div className="panel pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/55 bg-background/90 px-3 py-2 shadow-xl [@media(max-height:520px)]:py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Eye size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-black sm:text-sm">
                  <span className="truncate text-primary">{visiting.playerName}</span>
                  {visiting.rank && (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-black text-primary-foreground">
                      Hạng #{visiting.rank}
                    </span>
                  )}
                  <span className="hidden rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground sm:inline">
                    Chỉ xem
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  Ròng <b className="text-success">{formatMoney(visiting.netWorth)}</b> · {visiting.buildingsCount}{' '}
                  công trình · {visiting.ownedCount} lô · Ngày {visiting.day}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={handleCycleVisitBuilding} className="h-8 px-2.5 text-xs">
                <Compass size={14} className="text-primary" />
                <span className="hidden sm:inline">Bay tới công trình</span>
                <span className="sm:hidden">Xem nhà</span>
              </Button>
              <Button size="sm" onClick={handleExitVisit} className="h-8 px-2.5 text-xs font-black">
                <ArrowLeft size={14} /> Về thành phố của tôi
              </Button>
            </div>
          </div>
        ) : (
        <>
        <div className="panel pointer-events-auto flex flex-col gap-1.5 rounded-2xl px-2.5 py-2 sm:px-3 [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:items-center [@media(max-height:520px)]:justify-between [@media(max-height:520px)]:gap-2 [@media(max-height:520px)]:py-1.5">
          <div className="flex items-center justify-between gap-2 [@media(max-height:520px)]:gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <BrandLogo size="sm" compactMobile className="border-r border-border pr-2 sm:pr-3" />
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-widest [@media(max-height:520px)]:hidden">
                  Tiền mặt
                </div>
                <div className="text-gold truncate whitespace-nowrap text-base font-black leading-tight sm:text-lg [@media(max-height:520px)]:text-sm">
                  {formatMoney(s.cash)}
                </div>
              </div>
            </div>
            <div className="min-w-0 text-right [@media(max-height:520px)]:border-l [@media(max-height:520px)]:border-border [@media(max-height:520px)]:pl-2.5 [@media(max-height:520px)]:text-left">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-widest [@media(max-height:520px)]:hidden">
                Tài sản ròng
              </div>
              <div className="truncate whitespace-nowrap text-sm font-bold leading-tight text-success sm:text-base [@media(max-height:520px)]:text-xs">
                <span className="hidden text-[10px] font-normal text-muted-foreground [@media(max-height:520px)]:inline">
                  Ròng{' '}
                </span>
                {formatMoney(netWorth)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPanel('settings')}
                title={`${seasonInfo.name} (${s.seasonMode === 'auto' ? 'Tự động 4 mùa' : 'Đang khóa mùa'}) — Chạm để đổi mùa`}
                className="inline-flex items-center gap-1 truncate whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 hover:brightness-110"
              >
                <span>{seasonInfo.icon}</span>
                <span>{hr >= 6 && hr < 18 ? '☀️' : '🌙'}</span>
                <span>
                  {String(hr).padStart(2, '0')}:{String(min).padStart(2, '0')}
                </span>
                <span>·</span>
                <span>N{day}</span>
                <span className="hidden min-[360px]:inline [@media(max-height:520px)]:hidden lg:[@media(max-height:520px)]:inline">
                  · T{((monthIdx - 1) % 12) + 1} · Năm {year}
                </span>
              </button>
              {store.showFps && (
                <button
                  onClick={() => setPanel('settings')}
                  title="Cấu hình đồ hoạ & FPS"
                  className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] font-semibold text-success md:inline-flex [@media(max-height:520px)]:hidden"
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
            className="h-8 border border-border px-2.5 text-xs [@media(max-height:520px)]:h-7 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:text-[11px]"
            onClick={() => setPanel('city')}
          >
            <Trophy size={14} /> Nhiệm vụ {s.claimedMissions.length}/{MISSIONS.length}
          </Button>
          <Button
            aria-label="Bảng xếp hạng"
            variant="secondary"
            size="sm"
            className="h-8 border border-border px-2.5 text-xs [@media(max-height:520px)]:h-7 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:text-[11px]"
            onClick={() => setPanel('leaderboard')}
          >
            <Crown size={14} className="text-primary" />
            {lb.myRank ? `#${lb.myRank}` : 'BXH'}
            {lb.status === 'connected' && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" title="Realtime online" />
            )}
          </Button>
          <Button
            aria-label="Phúc lợi hằng ngày"
            variant="secondary"
            size="sm"
            className="relative h-8 border border-primary/45 px-2.5 text-xs [@media(max-height:520px)]:h-7 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:text-[11px]"
            onClick={() => setPanel('rewards')}
          >
            <Gift size={14} className="text-primary" />
            <span>Quà</span>
            {dailyBadgeCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                {dailyBadgeCount}
              </span>
            )}
          </Button>
          {s.auction && (
            <button onClick={notifyStore} className="btn-gold animate-pulse px-2.5 py-1 text-xs">
              🔨 Đấu giá #{s.auction.plotId}
            </button>
          )}
          {s.offers.length > 0 && (
            <button onClick={() => setPanel('dat')} className="btn-ghost px-2.5 py-1 text-xs">
              📩 {s.offers.length} đề nghị mua
            </button>
          )}
          {isFeverActive() && (
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-orange-400/70 bg-gradient-to-r from-orange-500/35 to-amber-500/35 px-2.5 py-1 text-xs font-black text-amber-200 shadow">
              🔥 FEVER x2 ({Math.max(1, Math.ceil((store.feverUntil - Date.now()) / 1000))}s)
            </span>
          )}
          {store.mapDrop && store.mapDrop.expiresAt > Date.now() && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('city-focus', { detail: store.mapDrop!.plotId }));
                handleClaimMapDrop();
              }}
              className="btn-gold animate-bounce px-2.5 py-1 text-xs font-black shadow-lg"
            >
              {store.mapDrop.kind === 'fever'
                ? '🔥 Bắt Cơn Sốt x2!'
                : store.mapDrop.kind === 'gift'
                  ? '🎁 Nhặt Hộp Quà!'
                  : '💼 Đón Khách VIP!'}
            </button>
          )}
        </div>
        </>
        )}

        {/* Live Server-Wide News Ticker Banner (Top 1 overtake, Landmark built!) */}
        {lb.latestNews && (
          <div className="flex justify-center px-2">
            <div className="panel pointer-events-auto animate-pop flex max-w-[92vw] items-center gap-2 rounded-full border border-primary/60 bg-gradient-to-r from-primary/25 via-background/95 to-primary/20 px-3 py-1 text-xs shadow-lg">
              <Megaphone size={14} className="shrink-0 text-primary" />
              <span className="truncate font-bold text-foreground">{lb.latestNews.message}</span>
              <button
                type="button"
                aria-label="Đóng tin nóng"
                onClick={dismissLatestNews}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

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

      {/* Right floating toolbar (compact 2x2 grid in landscape so it never collides!) */}
      <div className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 [@media(max-height:520px)]:grid [@media(max-height:520px)]:grid-cols-2 [@media(max-height:520px)]:gap-1.5">
        <button
          aria-label="Phóng to"
          title="Phóng to"
          onClick={() => window.__zoom?.(1.25)}
          className="panel rounded-full p-2 hover:brightness-110 [@media(max-height:520px)]:p-1.5"
        >
          <Plus size={18} className="[@media(max-height:520px)]:h-4 [@media(max-height:520px)]:w-4" />
        </button>
        <button
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
          onClick={() => window.__zoom?.(0.8)}
          className="panel rounded-full p-2 hover:brightness-110 [@media(max-height:520px)]:p-1.5"
        >
          <Minus size={18} className="[@media(max-height:520px)]:h-4 [@media(max-height:520px)]:w-4" />
        </button>
        <button
          aria-label="Bản đồ giá"
          title="Bản đồ nhiệt giá đất"
          onClick={() => {
            viewState.heatmap = !viewState.heatmap;
            notifyStore();
          }}
          className={`panel rounded-full p-2 hover:brightness-110 [@media(max-height:520px)]:p-1.5 ${
            viewState.heatmap ? 'text-primary' : ''
          }`}
        >
          <MapIcon size={18} className="[@media(max-height:520px)]:h-4 [@media(max-height:520px)]:w-4" />
        </button>
        {!visiting && (
          <Button
            aria-label="Đầu tư và gọi vốn"
            title="Đầu tư và gọi vốn"
            size="icon"
            variant="secondary"
            className="rounded-full border border-border [@media(max-height:520px)]:h-8 [@media(max-height:520px)]:w-8"
            onClick={() => setPanel('invest')}
          >
            <HandCoins size={18} className="[@media(max-height:520px)]:h-4 [@media(max-height:520px)]:w-4" />
          </Button>
        )}
      </div>

      {/* Live Corner Chat Đại Gia & Server News */}
      <ChatWidget
        onToast={pushToast}
        onVisitUser={handleVisitCity}
        hidden={Boolean(panel || !s.tutorialDone)}
      />

      {/* Bottom Navigation (hidden while visiting another player's city) */}
      {!visiting && (
      <nav className="absolute inset-x-0 bottom-0 z-10 px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 sm:p-2">
        <div className="panel grid grid-cols-6 gap-0.5 rounded-2xl p-1 [@media(max-height:520px)]:py-0.5">
          {NAV_ITEMS.map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setPanel(panel === key ? null : key)}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0 py-1.5 text-[9px] font-semibold leading-tight tracking-tight transition-colors sm:px-0.5 sm:text-[11px] sm:tracking-normal [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:gap-1.5 [@media(max-height:520px)]:py-1.5 [@media(max-height:520px)]:text-[11px] ${
                panel === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={18} className="shrink-0 sm:h-5 sm:w-5 [@media(max-height:520px)]:h-4 [@media(max-height:520px)]:w-4" />
              <span className="max-w-full whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </nav>
      )}

      {/* Active Bottom Sheet */}
      {panel && (
        <BottomSheet
          title={visiting && panel === 'plot' ? `Tham quan · ${visiting.playerName}` : PANEL_TITLES[panel]}
          onClose={() => setPanel(null)}
        >
          {panel === 'plot' && selectedPlot && (
            <PlotPanel
              s={viewState}
              p={selectedPlot}
              act={runAction}
              openBuild={() => {
                setBuildTab('single');
                setPanel('build');
              }}
              readOnly={Boolean(visiting)}
              visitOwnerName={visiting?.playerName}
            />
          )}
          {panel === 'dat' && (
            <LandPanel
              s={s}
              act={runAction}
              onPick={(id) => {
                store.selected = id;
                window.dispatchEvent(new CustomEvent('city-focus', { detail: id }));
                setPanel('plot');
                notifyStore();
              }}
              onBulkBuild={() => {
                setBuildTab('bulk_build');
                setPanel('build');
              }}
            />
          )}
          {panel === 'build' && <BuildPanel s={s} p={selectedPlot} act={runAction} initialTab={buildTab} />}
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
              onBulkUpgrade={() => {
                setBuildTab('bulk_upgrade');
                setPanel('build');
              }}
            />
          )}
          {panel === 'stats' && <StatsPanel s={s} />}
          {panel === 'leaderboard' && (
            <LeaderboardPanel
              s={s}
              onToast={pushToast}
              onOpenSettings={() => setPanel('settings')}
              onVisit={handleVisitCity}
              visitingBusyId={visitingBusyId}
            />
          )}
          {panel === 'rewards' && <RewardsPanel s={s} onToast={pushToast} />}
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
      {offlineReport && !s.nego && !s.auction && s.tutorialDone && (
        <OfflineModal
          report={offlineReport}
          onClose={() => {
            playSfx('coin');
            setOfflineReport(null);
          }}
        />
      )}
      {s.nego && <NegotiationModal s={s} toast={pushToast} />}
      {s.auction && <AuctionModal s={s} toast={pushToast} />}
      {s.dilemma && !s.nego && !s.auction && !visiting && <DilemmaModal s={s} toast={pushToast} />}
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
