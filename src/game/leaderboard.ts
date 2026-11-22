import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getNetWorth, getOwnedPlots, getPlayerTitle, hydrateGameState, saveGameState } from './engine';
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

export type LeaderboardConnectionStatus = 'unconfigured' | 'connecting' | 'connected' | 'error';

export interface LeaderboardSnapshot {
  configured: boolean;
  status: LeaderboardConnectionStatus;
  error: string | null;
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;
  playerName: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  onlineUserIds: string[];
  onlineCount: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  cloudSaving: boolean;
  cloudSavedAt: number | null;
  cloudError: string | null;
}

const PROFILE_STORAGE_KEY = 'bdsnh-profile-v1';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const SUPABASE_ANON_KEY =
  (
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  )?.trim() ?? '';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let initialized = false;
let lastSyncedHash = '';
let lastSyncedMs = 0;
let lastCloudSaveHash = '';
let lastCloudSaveMs = 0;

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
  email: null,
  isAnonymous: true,
  playerName: typeof window !== 'undefined' ? loadProfileName() : 'Đại gia BDSNH',
  entries: [],
  myRank: null,
  onlineUserIds: [],
  onlineCount: 0,
  syncing: false,
  lastSyncedAt: null,
  cloudSaving: false,
  cloudSavedAt: null,
  cloudError: null,
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

function applyAuthUser(user: User | null): void {
  const email = user?.email ?? null;
  const isAnon = !email || Boolean(user?.is_anonymous);
  emit({
    userId: user?.id ?? null,
    email,
    isAnonymous: isAnon,
    myRank: computeRank(snapshot.entries, user?.id ?? null),
  });
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

async function subscribeRealtime(uid: string | null): Promise<void> {
  if (!supabase) return;
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel).catch(() => {});
    realtimeChannel = null;
  }

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
}

export async function initLeaderboard(
  initialState?: GameState | null,
  onCloudStateLoaded?: (cloudState: GameState) => void
): Promise<void> {
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

    const { data: sessData } = await supabase.auth.getSession();
    let user: User | null = sessData.session?.user ?? null;

    if (!user) {
      const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        emit({
          status: 'error',
          error:
            'Không thể đăng nhập ẩn danh. Hãy bật Anonymous Sign-Ins trong Supabase -> Authentication -> Providers.',
        });
        await refreshLeaderboard();
        return;
      }
      user = anonData.user ?? null;
    }

    applyAuthUser(user);
    await refreshLeaderboard();
    await subscribeRealtime(user?.id ?? null);

    // If user is signed into a linked account and local state is brand new, pull cloud save automatically
    if (user && !snapshot.isAnonymous && initialState && initialState.day <= 1 && initialState.total.revenue === 0) {
      const loaded = await loadCloudState();
      if (loaded.state && onCloudStateLoaded) {
        onCloudStateLoaded(loaded.state);
        return;
      }
    }

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
    if (!snapshot.isAnonymous) {
      saveCloudState(state, true).catch(() => {});
    }
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
      p_plots_count: Math.min(1400, plotsCount),
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

// =========================================================================
// Cloud Save & Cross-Device Account Sync (Supabase bdsnh_saves + Email Auth)
// =========================================================================

export async function saveCloudState(state: GameState, force = false): Promise<string | null> {
  if (!supabase || !snapshot.userId) return 'Chưa kết nối máy chủ Cloud.';
  if (!force && snapshot.isAnonymous) return null;

  const netWorth = Math.round(getNetWorth(state));
  const plotsCount = getOwnedPlots(state).length;
  const hash = `${snapshot.playerName}|${state.day}|${netWorth}|${plotsCount}|${state.claimedMissions.length}`;
  const now = Date.now();
  if (!force && (hash === lastCloudSaveHash || now - lastCloudSaveMs < 35000)) {
    return null;
  }

  emit({ cloudSaving: true, cloudError: null });
  try {
    const cleanState: GameState = { ...state, nego: null };
    const { error } = await supabase.from('bdsnh_saves').upsert(
      {
        user_id: snapshot.userId,
        player_name: snapshot.playerName,
        state: cleanState,
        day: state.day,
        net_worth: netWorth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      const friendly = error.message.includes('bdsnh_saves')
        ? 'Chưa tạo bảng bdsnh_saves — hãy chạy file supabase/cloud_save.sql trong Supabase SQL Editor.'
        : error.message;
      emit({ cloudSaving: false, cloudError: friendly });
      return friendly;
    }

    lastCloudSaveHash = hash;
    lastCloudSaveMs = now;
    emit({ cloudSaving: false, cloudSavedAt: now, cloudError: null });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi lưu Cloud.';
    emit({ cloudSaving: false, cloudError: msg });
    return msg;
  }
}

export async function loadCloudState(): Promise<{ state: GameState | null; error: string | null }> {
  if (!supabase || !snapshot.userId) return { state: null, error: 'Chưa kết nối máy chủ Cloud.' };
  try {
    const { data, error } = await supabase
      .from('bdsnh_saves')
      .select('state, player_name, updated_at')
      .eq('user_id', snapshot.userId)
      .maybeSingle();

    if (error) {
      const friendly = error.message.includes('bdsnh_saves')
        ? 'Chưa tạo bảng bdsnh_saves — hãy chạy file supabase/cloud_save.sql trong Supabase SQL Editor.'
        : error.message;
      emit({ cloudError: friendly });
      return { state: null, error: friendly };
    }

    if (!data?.state) return { state: null, error: null };

    const hydrated = hydrateGameState(data.state);
    if (!hydrated) return { state: null, error: 'Dữ liệu Cloud không hợp lệ.' };

    if (typeof data.player_name === 'string' && data.player_name.trim().length >= 2) {
      saveProfileName(data.player_name.trim());
      emit({ playerName: data.player_name.trim() });
    }
    saveGameState(hydrated);
    emit({ cloudSavedAt: new Date(data.updated_at).getTime(), cloudError: null });
    return { state: hydrated, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải dữ liệu Cloud.';
    emit({ cloudError: msg });
    return { state: null, error: msg };
  }
}

export async function linkEmailAccount(
  rawEmail: string,
  password: string,
  currentState: GameState
): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Chưa cấu hình Supabase.' };
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, message: 'Email không hợp lệ.' };
  if (password.length < 6) return { ok: false, message: 'Mật khẩu phải từ 6 ký tự trở lên.' };

  try {
    // Upgrade current anonymous account so user_id & leaderboard rank are preserved!
    if (snapshot.userId && snapshot.isAnonymous) {
      const { data, error } = await supabase.auth.updateUser({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('already')) {
          return { ok: false, message: 'Email này đã có tài khoản — hãy chuyển sang tab Đăng nhập.' };
        }
        return { ok: false, message: error.message };
      }
      applyAuthUser(data.user ?? null);
      const saveErr = await saveCloudState(currentState, true);
      await syncPlayerScore(currentState, true);
      if (saveErr) {
        return { ok: true, message: `Đã liên kết email, nhưng lưu Cloud lỗi: ${saveErr}` };
      }
      const needsConfirm = Boolean(data.user && !data.user.email_confirmed_at && data.user.new_email);
      return {
        ok: true,
        message: needsConfirm
          ? '📧 Đã lưu Cloud! Hãy bấm link xác nhận trong email (hoặc tắt Confirm Email trong Supabase).'
          : '☁️ Đã liên kết tài khoản & sao lưu lên Cloud thành công!',
      };
    }

    // Fallback: normal signUp
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    applyAuthUser(data.user ?? null);
    if (data.session) {
      await subscribeRealtime(data.user?.id ?? null);
      await saveCloudState(currentState, true);
      await syncPlayerScore(currentState, true);
      return { ok: true, message: '☁️ Đã tạo tài khoản & sao lưu lên Cloud thành công!' };
    }
    return { ok: true, message: '📧 Đã tạo tài khoản! Kiểm tra email để xác nhận trước khi đăng nhập.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Lỗi liên kết tài khoản.' };
  }
}

export async function signInEmailAccount(
  rawEmail: string,
  password: string,
  currentState: GameState
): Promise<{ ok: boolean; message: string; loadedState?: GameState }> {
  if (!supabase) return { ok: false, message: 'Chưa cấu hình Supabase.' };
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, message: 'Email không hợp lệ.' };
  if (password.length < 6) return { ok: false, message: 'Mật khẩu phải từ 6 ký tự trở lên.' };

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) {
        return { ok: false, message: 'Sai email hoặc mật khẩu.' };
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return {
          ok: false,
          message: 'Email chưa được xác nhận (kiểm tra hộp thư hoặc tắt Confirm Email trong Supabase Auth).',
        };
      }
      return { ok: false, message: error.message };
    }

    applyAuthUser(data.user ?? null);
    lastSyncedHash = '';
    lastCloudSaveHash = '';
    await subscribeRealtime(data.user?.id ?? null);

    const cloud = await loadCloudState();
    if (cloud.state) {
      await refreshLeaderboard();
      return {
        ok: true,
        message: '☁️ Đăng nhập thành công! Đã tải toàn bộ dữ liệu từ Cloud.',
        loadedState: cloud.state,
      };
    }

    // Account exists but no cloud save yet -> upload current progress
    await saveCloudState(currentState, true);
    await syncPlayerScore(currentState, true);
    return {
      ok: true,
      message: '☁️ Đăng nhập thành công! Đã đồng bộ tiến trình hiện tại lên Cloud.',
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Lỗi đăng nhập.' };
  }
}

export async function signOutAccount(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  lastSyncedHash = '';
  lastCloudSaveHash = '';
  emit({ email: null, isAnonymous: true, cloudSavedAt: null, cloudError: null });
  const { data } = await supabase.auth.signInAnonymously();
  applyAuthUser(data.user ?? null);
  await subscribeRealtime(data.user?.id ?? null);
  await refreshLeaderboard();
}

export function disposeLeaderboard(): void {
  if (supabase && realtimeChannel) {
    supabase.removeChannel(realtimeChannel).catch(() => {});
    realtimeChannel = null;
  }
  initialized = false;
}
