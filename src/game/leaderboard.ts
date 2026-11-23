import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import {
  extractCitySnapshot,
  formatMoney,
  getNetWorth,
  getOwnedPlots,
  getPlayerTitle,
  hydrateGameState,
  saveGameState,
} from './engine';
import type { ChatMessage, CitySnapshot, GameState } from './types';

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
  messages: ChatMessage[];
  unreadChat: number;
  chatOpen: boolean;
  latestNews: ChatMessage | null;
  chatPersistent: boolean;
  snapshotPersistent: boolean;
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
let lastSnapshotHash = '';
let lastSnapshotMs = 0;
let lastChatSentMs = 0;
let knownTop1UserId: string | null = null;
let chatTableAvailable = true;
let snapshotTableAvailable = true;
let liveStateGetter: (() => GameState | null) | null = null;
const pendingCityReqs = new Map<string, (snap: CitySnapshot | null) => void>();
let newsTimer: ReturnType<typeof setTimeout> | null = null;

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
  messages: [],
  unreadChat: 0,
  chatOpen: false,
  latestNews: null,
  chatPersistent: false,
  snapshotPersistent: false,
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

  if (rows.length > 0 && knownTop1UserId === null) {
    knownTop1UserId = rows[0].user_id;
  }

  emit({
    status: 'connected',
    error: null,
    entries: rows,
    myRank: computeRank(rows, snapshot.userId),
  });
}

function normalizeChatMessage(raw: Record<string, unknown>): ChatMessage | null {
  const text = String(raw.message ?? '').trim();
  if (!text) return null;
  const kind = raw.kind === 'news' ? 'news' : 'chat';
  const created = String(raw.created_at ?? new Date().toISOString());
  const id = String(raw.id ?? `${raw.user_id ?? 'sys'}-${created}-${text.slice(0, 16)}`);
  return {
    id,
    user_id: raw.user_id ? String(raw.user_id) : null,
    player_name: String(raw.player_name ?? 'Hệ thống BDSNH').slice(0, 24),
    kind,
    message: text.slice(0, 180),
    created_at: created,
  };
}

function appendChatMessage(msg: ChatMessage, isHistory = false): void {
  const existing = snapshot.messages;
  const msgTime = new Date(msg.created_at).getTime();
  // Deduplicate by id or near-identical message from same sender within 4s (DB + Broadcast double delivery)
  const dup = existing.some(
    (m) =>
      m.id === msg.id ||
      (m.user_id === msg.user_id &&
        m.kind === msg.kind &&
        m.message === msg.message &&
        Math.abs(new Date(m.created_at).getTime() - msgTime) < 4000)
  );
  if (dup) return;

  const next = [...existing, msg]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-80);

  const patch: Partial<LeaderboardSnapshot> = { messages: next };
  if (!isHistory && !snapshot.chatOpen && msg.user_id !== snapshot.userId) {
    patch.unreadChat = Math.min(99, snapshot.unreadChat + 1);
  }
  if (!isHistory && msg.kind === 'news') {
    patch.latestNews = msg;
    if (newsTimer) clearTimeout(newsTimer);
    newsTimer = setTimeout(() => {
      emit({ latestNews: null });
    }, 6500);
  }
  emit(patch);
}

async function loadChatHistory(): Promise<void> {
  if (!supabase || !chatTableAvailable) return;
  const { data, error } = await supabase
    .from('bdsnh_chat')
    .select('id, user_id, player_name, kind, message, created_at')
    .order('created_at', { ascending: false })
    .limit(45);

  if (error) {
    if (error.message.includes('bdsnh_chat') || error.code === '42P01' || error.code === 'PGRST205') {
      chatTableAvailable = false;
      emit({ chatPersistent: false });
    }
    return;
  }

  emit({ chatPersistent: true });
  const rows = (data ?? [])
    .map((r) => normalizeChatMessage(r as Record<string, unknown>))
    .filter((m): m is ChatMessage => Boolean(m))
    .reverse();

  if (rows.length) {
    const merged = [...rows];
    for (const cur of snapshot.messages) {
      if (!merged.some((m) => m.id === cur.id)) merged.push(cur);
    }
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    emit({ messages: merged.slice(-80) });
  }
}

export function registerLiveStateGetter(fn: () => GameState | null): void {
  liveStateGetter = fn;
}

export function setChatOpen(open: boolean): void {
  emit({ chatOpen: open, ...(open ? { unreadChat: 0 } : {}) });
}

export function dismissLatestNews(): void {
  if (newsTimer) {
    clearTimeout(newsTimer);
    newsTimer = null;
  }
  emit({ latestNews: null });
}

export async function sendChatMessage(rawText: string): Promise<string | null> {
  const clean = rawText.trim().slice(0, 140);
  if (!clean) return 'Hãy nhập nội dung tin nhắn.';
  if (!supabase || !snapshot.userId) return 'Chưa kết nối máy chủ Realtime.';

  const now = Date.now();
  if (now - lastChatSentMs < 1800) {
    return 'Nhắn chậm lại chút nhé (2 giây/tin)!';
  }
  lastChatSentMs = now;

  const createdAt = new Date(now).toISOString();
  const localMsg: ChatMessage = {
    id: `local-${snapshot.userId}-${now}`,
    user_id: snapshot.userId,
    player_name: snapshot.playerName,
    kind: 'chat',
    message: clean,
    created_at: createdAt,
  };
  appendChatMessage(localMsg);

  // Instant Realtime Broadcast to all online players (works even before social.sql is run)
  if (realtimeChannel) {
    realtimeChannel
      .send({
        type: 'broadcast',
        event: 'chat_msg',
        payload: localMsg,
      })
      .catch(() => {});
  }

  // Persist to bdsnh_chat table if available
  if (chatTableAvailable) {
    const { error } = await supabase.from('bdsnh_chat').insert({
      user_id: snapshot.userId,
      player_name: snapshot.playerName,
      kind: 'chat',
      message: clean,
    });
    if (error && (error.message.includes('bdsnh_chat') || error.code === '42P01' || error.code === 'PGRST205')) {
      chatTableAvailable = false;
      emit({ chatPersistent: false });
    }
  }

  return null;
}

export async function broadcastServerNews(message: string): Promise<void> {
  const clean = message.replace(/\{player\}/g, snapshot.playerName).trim().slice(0, 180);
  if (!clean || !supabase || !snapshot.userId) return;

  const createdAt = new Date().toISOString();
  const newsMsg: ChatMessage = {
    id: `news-${snapshot.userId}-${Date.now()}`,
    user_id: snapshot.userId,
    player_name: snapshot.playerName,
    kind: 'news',
    message: clean,
    created_at: createdAt,
  };
  appendChatMessage(newsMsg);

  if (realtimeChannel) {
    realtimeChannel
      .send({
        type: 'broadcast',
        event: 'chat_msg',
        payload: newsMsg,
      })
      .catch(() => {});
  }

  if (chatTableAvailable) {
    const { error } = await supabase.from('bdsnh_chat').insert({
      user_id: snapshot.userId,
      player_name: snapshot.playerName,
      kind: 'news',
      message: clean,
    });
    if (error && (error.message.includes('bdsnh_chat') || error.code === '42P01' || error.code === 'PGRST205')) {
      chatTableAvailable = false;
      emit({ chatPersistent: false });
    }
  }
}

export async function syncCitySnapshot(state: GameState, force = false): Promise<void> {
  if (!supabase || !snapshot.userId || !snapshotTableAvailable) return;
  const owned = getOwnedPlots(state);
  const bSig = owned.map((p) => `${p.id}:${p.b?.type ?? ''}:${p.b?.level ?? 0}:${p.b?.paint?.wall ?? ''}:${p.b?.paint?.roof ?? ''}`).join(',');
  const hash = `${snapshot.playerName}|${state.plots.length}|${bSig}`;
  const now = Date.now();
  if (!force && (hash === lastSnapshotHash || now - lastSnapshotMs < 35000)) return;

  const citySnap = extractCitySnapshot(state);
  const { error } = await supabase.from('bdsnh_city_snapshots').upsert(
    {
      user_id: snapshot.userId,
      player_name: snapshot.playerName,
      snapshot: citySnap,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    if (error.message.includes('bdsnh_city_snapshots') || error.code === '42P01' || error.code === 'PGRST205') {
      snapshotTableAvailable = false;
      emit({ snapshotPersistent: false });
    }
    return;
  }

  lastSnapshotHash = hash;
  lastSnapshotMs = now;
  if (!snapshot.snapshotPersistent) emit({ snapshotPersistent: true });
}

export async function fetchCitySnapshot(
  targetUserId: string
): Promise<{ snapshot: CitySnapshot | null; error?: string }> {
  if (!supabase) return { snapshot: null, error: 'Chưa kết nối Supabase.' };

  // 1. Try persistent DB snapshot first (works for both online & offline players!)
  if (snapshotTableAvailable) {
    const { data, error } = await supabase
      .from('bdsnh_city_snapshots')
      .select('snapshot')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) {
      if (error.message.includes('bdsnh_city_snapshots') || error.code === '42P01' || error.code === 'PGRST205') {
        snapshotTableAvailable = false;
        emit({ snapshotPersistent: false });
      }
    } else {
      if (!snapshot.snapshotPersistent) emit({ snapshotPersistent: true });
      if (data?.snapshot && typeof data.snapshot === 'object') {
        return { snapshot: data.snapshot as CitySnapshot };
      }
    }
  }

  // 2. Fallback: Live P2P Broadcast request if the target player is currently online!
  const isOnline = snapshot.onlineUserIds.includes(targetUserId);
  if (realtimeChannel && isOnline) {
    const reqId = `${snapshot.userId ?? 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const p2pSnap = await new Promise<CitySnapshot | null>((resolve) => {
      const timer = setTimeout(() => {
        pendingCityReqs.delete(reqId);
        resolve(null);
      }, 2600);
      pendingCityReqs.set(reqId, (snap) => {
        clearTimeout(timer);
        pendingCityReqs.delete(reqId);
        resolve(snap);
      });
      realtimeChannel
        ?.send({
          type: 'broadcast',
          event: 'city_req',
          payload: { reqId, targetUserId },
        })
        .catch(() => {
          clearTimeout(timer);
          pendingCityReqs.delete(reqId);
          resolve(null);
        });
    });

    if (p2pSnap) return { snapshot: p2pSnap };
  }

  return {
    snapshot: null,
    error: snapshotTableAvailable
      ? 'Đại gia này chưa cập nhật bản đồ mới nhất (họ cần vào game lại 1 lần để đồng bộ thành phố).'
      : 'Đại gia này đang offline. Hãy chạy file supabase/social.sql trong Supabase để xem được cả người offline!',
  };
}

function mergeRealtimeEntry(row: LeaderboardEntry): void {
  const prevTop1 = knownTop1UserId;
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
  const newTop1 = top50[0] ?? null;

  if (newTop1) {
    knownTop1UserId = newTop1.user_id;
    // If I just overtook someone else to become the new #1, broadcast a server-wide announcement!
    if (
      prevTop1 &&
      prevTop1 !== newTop1.user_id &&
      newTop1.user_id === snapshot.userId &&
      top50.length >= 2
    ) {
      broadcastServerNews(
        `👑 ${newTop1.player_name} vừa soán ngôi TOP 1 BXH BDSNH với tài sản ${formatMoney(newTop1.net_worth)}!`
      ).catch(() => {});
    }
  }

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
        broadcast: { self: false },
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
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'bdsnh_chat' },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const msg = normalizeChatMessage(payload.new as Record<string, unknown>);
          if (msg) appendChatMessage(msg);
        }
      }
    )
    .on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        const msg = normalizeChatMessage(payload as Record<string, unknown>);
        if (msg) appendChatMessage(msg);
      }
    })
    .on('broadcast', { event: 'city_req' }, ({ payload }) => {
      const p = payload as { reqId?: string; targetUserId?: string } | null;
      if (!p?.reqId || !p.targetUserId || p.targetUserId !== snapshot.userId) return;
      const curState = liveStateGetter?.();
      if (!curState || !realtimeChannel) return;
      realtimeChannel
        .send({
          type: 'broadcast',
          event: 'city_res',
          payload: {
            reqId: p.reqId,
            targetUserId: snapshot.userId,
            snapshot: extractCitySnapshot(curState),
          },
        })
        .catch(() => {});
    })
    .on('broadcast', { event: 'city_res' }, ({ payload }) => {
      const p = payload as { reqId?: string; snapshot?: CitySnapshot } | null;
      if (!p?.reqId) return;
      const resolver = pendingCityReqs.get(p.reqId);
      if (resolver) resolver(p.snapshot ?? null);
    })
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
    await loadChatHistory();
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
      syncCitySnapshot(initialState, true).catch(() => {});
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
    syncCitySnapshot(state, force).catch(() => {});
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
