import { getNetWorth, hydrateGameState, saveGameState } from './engine';
import type { GameState } from './types';

interface FBInstantPlayer {
  getID: () => string | null;
  getName: () => string | null;
  getPhoto: () => string | null;
  getDataAsync: (keys: string[]) => Promise<Record<string, unknown>>;
  setDataAsync: (data: Record<string, unknown>) => Promise<void>;
}

interface FBInstantContext {
  getID: () => string | null;
  chooseAsync: (options?: { filters?: string[]; maxSize?: number; minSize?: number }) => Promise<void>;
}

interface FBInstantAPI {
  initializeAsync: () => Promise<void>;
  setLoadingProgress: (pct: number) => void;
  startGameAsync: () => Promise<void>;
  onPause: (cb: () => void) => void;
  quit: () => void;
  getPlatform: () => string;
  getLocale: () => string;
  postSessionScoreAsync: (score: number) => Promise<void>;
  canCreateShortcutAsync: () => Promise<boolean>;
  createShortcutAsync: () => Promise<void>;
  shareAsync: (payload: {
    intent?: 'INVITE' | 'REQUEST' | 'CHALLENGE' | 'SHARE';
    image: string;
    text: string;
    data?: Record<string, unknown>;
  }) => Promise<void>;
  player: FBInstantPlayer;
  context: FBInstantContext;
}

declare global {
  interface Window {
    FBInstant?: FBInstantAPI;
  }
}

export interface FbInstantInfo {
  active: boolean;
  playerId: string | null;
  playerName: string | null;
  playerPhoto: string | null;
  platform: string | null;
}

const FB_SAVE_KEY = 'bdsnh_state_v1';
let fbInfo: FbInstantInfo = {
  active: false,
  playerId: null,
  playerName: null,
  playerPhoto: null,
  platform: null,
};
let lastFbSaveMs = 0;
let lastFbScore = -1;
const pauseHandlers = new Set<() => void>();

function isLikelyFbInstantHost(): boolean {
  if (typeof window === 'undefined' || !window.FBInstant) return false;
  try {
    const host = window.location.hostname.toLowerCase();
    const inIframe = window.parent !== window;
    return inIframe || host.includes('fbsbx.com') || host.includes('facebook.com');
  } catch {
    return true; // cross-origin parent iframe throws -> definitely embedded
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('FBInstant timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function getFbInstantInfo(): FbInstantInfo {
  return fbInfo;
}

export function isFbInstantActive(): boolean {
  return fbInfo.active;
}

export function onFbPause(cb: () => void): () => void {
  pauseHandlers.add(cb);
  return () => pauseHandlers.delete(cb);
}

/**
 * Initializes Facebook Instant Games SDK v7.1 when running inside Meta Instant Games.
 * Outside Facebook (normal browser / Vercel), resolves immediately in ~0ms.
 */
export async function initFbInstant(): Promise<FbInstantInfo> {
  if (!isLikelyFbInstantHost() || !window.FBInstant) {
    return fbInfo;
  }

  const fb = window.FBInstant;
  try {
    await withTimeout(fb.initializeAsync(), 3500);
    fb.setLoadingProgress(40);
    fb.onPause(() => {
      pauseHandlers.forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    });
    fb.setLoadingProgress(100);
    await withTimeout(fb.startGameAsync(), 4500);

    fbInfo = {
      active: true,
      playerId: fb.player.getID(),
      playerName: fb.player.getName(),
      playerPhoto: fb.player.getPhoto(),
      platform: fb.getPlatform?.() ?? null,
    };

    // Gently prompt home-screen shortcut on supported mobile FB clients
    fb.canCreateShortcutAsync?.()
      .then((ok) => {
        if (ok) fb.createShortcutAsync?.().catch(() => {});
      })
      .catch(() => {});
  } catch {
    // Running outside an active Instant Games session -> fall back to standard web mode cleanly
    fbInfo = { active: false, playerId: null, playerName: null, playerPhoto: null, platform: null };
  }

  return fbInfo;
}

export async function loadFbCloudState(): Promise<GameState | null> {
  if (!fbInfo.active || !window.FBInstant) return null;
  try {
    const data = await window.FBInstant.player.getDataAsync([FB_SAVE_KEY]);
    const raw = data?.[FB_SAVE_KEY];
    if (!raw) return null;
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const hydrated = hydrateGameState(obj);
    if (hydrated) saveGameState(hydrated);
    return hydrated;
  } catch {
    return null;
  }
}

export async function saveFbCloudState(state: GameState, force = false): Promise<void> {
  if (!fbInfo.active || !window.FBInstant) return;
  const now = Date.now();
  if (!force && now - lastFbSaveMs < 28000) return;

  try {
    const payload = JSON.stringify({ ...state, nego: null });
    // Stay safely under Meta's 1MB setDataAsync ceiling
    if (payload.length < 900_000) {
      await window.FBInstant.player.setDataAsync({ [FB_SAVE_KEY]: payload });
      lastFbSaveMs = now;
    }
  } catch {
    // ignore quota/network errors
  }

  // Post session score in millions VND (fits safely inside 32-bit integer)
  const scoreMillions = Math.max(0, Math.min(2_000_000_000, Math.round(getNetWorth(state) / 1_000_000)));
  if (scoreMillions !== lastFbScore && scoreMillions > 0) {
    lastFbScore = scoreMillions;
    window.FBInstant.postSessionScoreAsync?.(scoreMillions).catch(() => {});
  }
}

/**
 * Generates a crisp 600x315 gold-luxury achievement card PNG (base64) for FBInstant.shareAsync.
 */
function renderAchievementShareCard(
  playerName: string,
  netWorthText: string,
  rankText: string,
  day: number
): string {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 315;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  const bg = ctx.createLinearGradient(0, 0, 600, 315);
  bg.addColorStop(0, '#111827');
  bg.addColorStop(0.55, '#1e293b');
  bg.addColorStop(1, '#292218');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 315);

  // Golden luxury frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 572, 287);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('BDSNH — ĐẾ CHẾ BẤT ĐỘNG SẢN', 42, 68);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${playerName} · ${rankText}`, 42, 122);

  ctx.fillStyle = '#fde047';
  ctx.font = '900 54px sans-serif';
  ctx.fillText(netWorthText, 42, 198);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(`Ngày ${day} · Mua đất · Xây Siêu Dự Án 2×2 · Lướt sóng Chứng khoán`, 42, 246);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('▶ Vào đấu trí & ghé thăm thành phố của tôi ngay!', 42, 280);

  return c.toDataURL('image/png');
}

export async function shareScoreToFacebook(
  playerName: string,
  netWorthText: string,
  rankText: string,
  day: number
): Promise<string> {
  const shareText = `${playerName} đang đạt ${netWorthText} (${rankText}) tại BDSNH — Đế Chế Bất Động Sản! Vào đua Top & ghé thăm thành phố của tôi ngay!`;

  if (fbInfo.active && window.FBInstant) {
    try {
      const image = renderAchievementShareCard(playerName, netWorthText, rankText, day);
      await window.FBInstant.shareAsync({
        intent: 'SHARE',
        image,
        text: shareText,
        data: { fromPlayer: playerName },
      });
      return '📢 Đã chia sẻ thành tích lên Facebook!';
    } catch {
      return 'Đã hủy chia sẻ.';
    }
  }

  // Standard web fallback: Facebook Sharer popup
  try {
    const url = encodeURIComponent(window.location.href);
    const quote = encodeURIComponent(shareText);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`,
      '_blank',
      'noopener,noreferrer,width=620,height=520'
    );
    return '📢 Đã mở cửa sổ chia sẻ Facebook!';
  } catch {
    return 'Không thể mở cửa sổ chia sẻ.';
  }
}

export async function inviteFacebookFriends(): Promise<string> {
  if (fbInfo.active && window.FBInstant) {
    try {
      await window.FBInstant.context.chooseAsync();
      return '👥 Đã chọn bạn bè cùng chơi BDSNH!';
    } catch {
      return 'Đã đóng bảng chọn bạn bè.';
    }
  }

  // Web fallback: copy invite link
  try {
    await navigator.clipboard.writeText(window.location.href);
    return '📋 Đã copy link game — dán vào Messenger/Facebook để rủ bạn bè nhé!';
  } catch {
    return 'Hãy copy đường dẫn trên trình duyệt để gửi cho bạn bè!';
  }
}
