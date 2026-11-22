import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getNetWorth, getOwnedPlots, getPlayerTitle } from './engine';
import type { GameState } from './types';

export interface LeaderboardEntry {
  user_id: string;
  player_name: string;
  net_worth: number;
  cash: number;
  plots_count: number;
  day: number;
  title: string;
  missions_done: number;
  updated_at: string;
}

export type LeaderboardConnectionStatus =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'error';

export interface LeaderboardSnapshot {
  configured: boolean;
  status: LeaderboardConnectionStatus;
  error: string | null;
  userId: string | null;
  playerName: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  onlineUserIds: string[];
  onlineCount: number;
  syncing: boolean;
  lastSyncedAt: number | null;
}

const PROFILE_STORAGE_KEY = 'bdsnh-profile-v1';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const SUPABASE_ANON_KEY = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim() ?? '';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let initialized = false;
let lastSyncedHash = '';
let lastSyncedMs = 0;

function loadProfileName(): string {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name && parsed.name.trim().length >= 2) return parsed.name.trim().slice(0, 24);
    }
  } catch {
    // ignore
  }
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const generated = `Đại gia #${suffix}`;
  saveProfileName(generated);
  return generated;
}

function saveProfileName(name: string): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name }));
  } catch {
    // ignore
  }
}

let snapshot: LeaderboardSnapshot = {
  configured: isSupabaseConfigured,
  status: isSupabaseConfigured ? 'connecting' : 'unconfigured',
  error: null,
  userId: null,
  playerName: typeof window !== 'undefined' ? loadProfileName() : 'Đại gia BDSNH',
  entries: [],
  myRank: null,
  onlineUserIds: [],
  onlineCount: 0,
  syncing: false,
  lastSyncedAt: null,
};

const listeners = new Set<() => void>();

function emit(patch: Partial<LeaderboardSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
}

export function useLeaderboard(): LeaderboardSnapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot
  );
}

function computeRank(entries: LeaderboardEntry[], userId: string | null): number | null {
  if (!userId) return null;
  const idx = entries.findIndex((e) => e.user_id === userId);
  return idx >= 0 ? idx + 1 : null;
}

export async function refreshLeaderboard(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('bdsnh_leaderboard')
    .select('user_id, player_name, net_worth, cash, plots_count, day, title, missions_done, updated_at')
    .order('net_worth', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(50);

  if (error) {
    emit({ status: 'error', error: error.message });
    return;
  }

  const rows: LeaderboardEntry[] = (data ?? []).map((r) => ({
    user_id: String(r.user_id),
    player_name: String(r.player_name),
    net_worth: Number(r.net_worth),
    cash: Number(r.cash),
    plots_count: Number(r.plots_count),
    day: Number(r.day),
    title: String(r.title),
    missions_done: Number(r.missions_done),
    updated_at: String(r.updated_at),
  }));

  emit({
    status: 'connected',
    error: null,
    entries: rows,
    myRank: computeRank(rows, snapshot.userId),
  });
}

function mergeRealtimeEntry(row: LeaderboardEntry): void {
  const next = snapshot.entries.filter((e) => e.user_id !== row.user_id);
  next.push({
    ...row,
    net_worth: Number(row.net_worth),
    cash: Number(row.cash),
    plots_count: Number(row.plots_count),
    day: Number(row.day),
    missions_done: Number(row.missions_done),
  });
  next.sort((a, b) => b.net_worth - a.net_worth || a.updated_at.localeCompare(b.updated_at));
  const top50 = next.slice(0, 50);
  emit({
    entries: top50,
    myRank: computeRank(top50, snapshot.userId),
  });
}

export async function initLeaderboard(initialState?: GameState | null): Promise<void> {
  if (!isSupabaseConfigured || initialized) return;
  initialized = true;

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });

    emit({ status: 'connecting', error: null });

    // Ensure Anonymous Auth session for RLS protection
    const { data: sessData } = await supabase.auth.getSession();
    let uid = sessData.session?.user?.id ?? null;

    if (!uid) {
      const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        emit({
          status: 'error',
          error:
            'Không thể đăng nhập ẩn danh. Hãy bật Anonymous Sign-Ins trong Supabase -> Authentication -> Providers.',
        });
        // Still load public leaderboard read-only
        await refreshLeaderboard();
        return;
      }
      uid = anonData.user?.id ?? null;
    }

    emit({ userId: uid });
    await refreshLeaderboard();

    // Subscribe to real-time score changes & live online presence
    realtimeChannel = supabase
      .channel('bdsnh-live-leaderboard', {
        config: {
          presence: { key: uid ?? 'guest' },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bdsnh_leaderboard' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            refreshLeaderboard().catch(() => {});
            return;
          }
          if (payload.new && typeof payload.new === 'object') {
            mergeRealtimeEntry(payload.new as LeaderboardEntry);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        if (!realtimeChannel) return;
        const pres = realtimeChannel.presenceState();
        const ids = Object.keys(pres);
        emit({ onlineUserIds: ids, onlineCount: ids.length });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          emit({ status: 'connected', error: null });
          if (uid && realtimeChannel) {
            await realtimeChannel.track({
              player_name: snapshot.playerName,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    if (initialState) {
      await syncPlayerScore(initialState, true);
    }
  } catch (err) {
    emit({
      status: 'error',
      error: err instanceof Error ? err.message : 'Lỗi kết nối Supabase.',
    });
  }
}

export function setPlayerDisplayName(name: string, state?: GameState | null): string | null {
  const clean = name.trim().slice(0, 24);
  if (clean.length < 2) return 'Tên hiển thị cần ít nhất 2 ký tự.';
  saveProfileName(clean);
  emit({ playerName: clean });

  if (realtimeChannel && snapshot.userId) {
    realtimeChannel
      .track({
        player_name: clean,
        online_at: new Date().toISOString(),
      })
      .catch(() => {});
  }

  if (state && isSupabaseConfigured) {
    syncPlayerScore(state, true).catch(() => {});
  }
  return null;
}

export async function syncPlayerScore(state: GameState, force = false): Promise<string | null> {
  if (!supabase || !snapshot.userId) return null;

  const netWorth = Math.round(getNetWorth(state));
  const cash = Math.round(state.cash);
  const plotsCount = getOwnedPlots(state).length;
  const title = getPlayerTitle(state);
  const missionsDone = state.claimedMissions.length;
  const name = snapshot.playerName;

  const hash = `${name}|${netWorth}|${plotsCount}|${state.day}|${missionsDone}`;
  const now = Date.now();
  if (!force && (hash === lastSyncedHash || now - lastSyncedMs < 12000)) {
    return null;
  }

  emit({ syncing: true });
  try {
    const { data, error } = await supabase.rpc('upsert_bdsnh_score', {
      p_player_name: name,
      p_net_worth: netWorth,
      p_cash: cash,
      p_plots_count: plotsCount,
      p_day: state.day,
      p_title: title,
      p_missions_done: missionsDone,
    });

    if (error) {
      emit({ syncing: false, error: error.message });
      return error.message;
    }

    lastSyncedHash = hash;
    lastSyncedMs = now;
    if (data) mergeRealtimeEntry(data as LeaderboardEntry);
    emit({ syncing: false, lastSyncedAt: now, error: null });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Không thể đồng bộ điểm.';
    emit({ syncing: false, error: msg });
    return msg;
  }
}

export function disposeLeaderboard(): void {
  if (supabase && realtimeChannel) {
    supabase.removeChannel(realtimeChannel).catch(() => {});
    realtimeChannel = null;
  }
  initialized = false;
}
