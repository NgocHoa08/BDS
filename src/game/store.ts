import { useSyncExternalStore } from 'react';
import type { FloatingFx, GameState } from './types';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsPresetConfig {
  label: string;
  desc: string;
  bakeScale: number;
  maxDpr: number;
  vehicles: number;
  boats: number;
  clouds: number;
  nightGlow: boolean;
  waterSparkles: boolean;
  textures: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPresetConfig> = {
  low: {
    label: 'Tiết kiệm',
    desc: 'Tối ưu pin & máy yếu',
    bakeScale: 1,
    maxDpr: 1,
    vehicles: 10,
    boats: 3,
    clouds: 0,
    nightGlow: false,
    waterSparkles: false,
    textures: false,
  },
  medium: {
    label: 'Trung bình',
    desc: 'Cân bằng đẹp & mượt',
    bakeScale: 1.25,
    maxDpr: 1.5,
    vehicles: 22,
    boats: 5,
    clouds: 4,
    nightGlow: true,
    waterSparkles: true,
    textures: true,
  },
  high: {
    label: 'Cao (HD)',
    desc: 'Chi tiết sắc nét, ánh sáng đêm',
    bakeScale: 1.5,
    maxDpr: 2,
    vehicles: 36,
    boats: 8,
    clouds: 7,
    nightGlow: true,
    waterSparkles: true,
    textures: true,
  },
  ultra: {
    label: 'Siêu nét (Ultra)',
    desc: '2x HiDPI, xe cộ & thuyền sống động',
    bakeScale: 2,
    maxDpr: 2,
    vehicles: 52,
    boats: 12,
    clouds: 10,
    nightGlow: true,
    waterSparkles: true,
    textures: true,
  },
};

const GFX_STORAGE_KEY = 'bdsnh-gfx-v1';
const LEGACY_GFX_STORAGE_KEY = 'dai-gia-gfx-v1';

function loadGfxSettings(): { quality: GraphicsQuality; showFps: boolean; sfx: boolean } {
  try {
    const raw = localStorage.getItem(GFX_STORAGE_KEY) ?? localStorage.getItem(LEGACY_GFX_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ quality: GraphicsQuality; showFps: boolean; sfx: boolean }>;
      const q = p.quality && p.quality in GRAPHICS_PRESETS ? p.quality : 'ultra';
      return {
        quality: q,
        showFps: typeof p.showFps === 'boolean' ? p.showFps : true,
        sfx: typeof p.sfx === 'boolean' ? p.sfx : true,
      };
    }
  } catch {
    // ignore
  }
  return { quality: 'ultra', showFps: true, sfx: true };
}

const initialGfx = typeof window !== 'undefined' ? loadGfxSettings() : { quality: 'ultra' as GraphicsQuality, showFps: true, sfx: true };

export interface GameStore {
  s: GameState | null;
  fx: FloatingFx[];
  selected: number | null;
  version: number;
  sfxEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  showFps: boolean;
}

export const store: GameStore = {
  s: null,
  fx: [],
  selected: null,
  version: 0,
  sfxEnabled: initialGfx.sfx,
  graphicsQuality: initialGfx.quality,
  showFps: initialGfx.showFps,
};

export function saveGfxSettings(): void {
  try {
    localStorage.setItem(
      GFX_STORAGE_KEY,
      JSON.stringify({
        quality: store.graphicsQuality,
        showFps: store.showFps,
        sfx: store.sfxEnabled,
      })
    );
  } catch {
    // ignore
  }
}

const listeners = new Set<() => void>();

export function notifyStore(): void {
  store.version += 1;
  listeners.forEach((fn) => fn());
}

export function useGameVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => store.version,
    () => 0
  );
}

export function pushFloatingFx(x: number, y: number, text: string, color: string): void {
  store.fx.push({ x, y, text, color, t: performance.now() });
  if (store.fx.length > 48) store.fx.shift();
}

// Lightweight synthesized Web Audio SFX
let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext | null {
  if (!store.sfxEnabled || typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSfx(kind: 'coin' | 'build' | 'click' | 'error' | 'win'): void {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'coin') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (kind === 'build') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (kind === 'win') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (kind === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.14);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // ignore Web Audio issues
  }
}
