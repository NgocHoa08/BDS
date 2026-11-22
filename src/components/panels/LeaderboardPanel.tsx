import { useState } from 'react';
import { Crown, Radio, RefreshCw, Save, Users, WifiOff } from 'lucide-react';
import { formatMoney, getNetWorth, getOwnedPlots, getPlayerTitle } from '../../game/engine';
import {
  refreshLeaderboard,
  setPlayerDisplayName,
  syncPlayerScore,
  useLeaderboard,
} from '../../game/leaderboard';
import type { GameState } from '../../game/types';
import { Button } from '../ui';

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 15) return 'Vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  return `${Math.floor(hr / 24)} ngày trước`;
}

export function LeaderboardPanel({
  s,
  onToast,
}: {
  s: GameState;
  onToast: (msg: string) => void;
}) {
  const lb = useLeaderboard();
  const [nameInput, setNameInput] = useState(lb.playerName);

  const myWorth = getNetWorth(s);
  const myPlots = getOwnedPlots(s).length;
  const myTitle = getPlayerTitle(s);

  const handleSaveName = () => {
    const err = setPlayerDisplayName(nameInput, s);
    if (err) {
      onToast('⚠ ' + err);
    } else {
      onToast('✅ Đã cập nhật tên đại gia!');
    }
  };

  const handleManualSync = async () => {
    const err = await syncPlayerScore(s, true);
    if (err) onToast('⚠ ' + err);
    else {
      await refreshLeaderboard();
      onToast('🔄 Đã đồng bộ bảng xếp hạng!');
    }
  };

  const myIndex = lb.entries.findIndex((e) => e.user_id === lb.userId);
  const playerAbove = myIndex > 0 ? lb.entries[myIndex - 1] : null;
  const gapToAbove = playerAbove ? Math.max(0, playerAbove.net_worth - myWorth) : 0;

  return (
    <div className="space-y-4">
      {/* Live status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-secondary/70 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          {lb.status === 'connected' ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-success">Trực tuyến (Realtime)</span>
            </>
          ) : lb.status === 'connecting' ? (
            <>
              <Radio size={14} className="animate-pulse text-primary" />
              <span className="text-muted-foreground">Đang kết nối Supabase...</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {lb.configured ? 'Lỗi kết nối máy chủ' : 'Chế độ cục bộ (chưa gắn Supabase)'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lb.status === 'connected' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[11px]">
              <Users size={12} className="text-success" /> {Math.max(1, lb.onlineCount)} online
            </span>
          )}
          {lb.configured && (
            <button
              onClick={handleManualSync}
              disabled={lb.syncing}
              className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-semibold hover:brightness-110 disabled:opacity-50"
            >
              <RefreshCw size={11} className={lb.syncing ? 'animate-spin' : ''} /> Đồng bộ
            </button>
          )}
        </div>
      </div>

      {/* Player identity & quick profile */}
      <section className="space-y-2.5 rounded-2xl bg-secondary p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-primary" />
            <div>
              <div className="text-sm font-bold">{lb.playerName}</div>
              <div className="text-[11px] text-muted-foreground">
                {myTitle} · {myPlots} lô · Ngày {s.day}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {lb.myRank ? `Hạng #${lb.myRank}` : 'Tài sản ròng'}
            </div>
            <div className="text-sm font-black text-primary">{formatMoney(myWorth)}</div>
          </div>
        </div>

        {playerAbove && gapToAbove > 0 && (
          <p className="rounded-lg bg-background/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Cần thêm <b className="text-primary">{formatMoney(gapToAbove)}</b> để vượt qua{' '}
            <b>{playerAbove.player_name}</b> (Hạng #{myIndex}).
          </p>
        )}

        <div className="flex gap-1.5">
          <input
            type="text"
            maxLength={24}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            placeholder="Nhập biệt danh đại gia..."
            className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" onClick={handleSaveName}>
            <Save size={13} /> Đổi tên
          </Button>
        </div>
      </section>

      {lb.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/15 p-2.5 text-xs text-destructive-foreground">
          ⚠ {lb.error}
        </div>
      )}

      {/* Unconfigured setup guide */}
      {!lb.configured ? (
        <section className="space-y-2.5 rounded-2xl border border-border bg-secondary/50 p-3 text-xs leading-relaxed">
          <h3 className="text-sm font-bold text-primary">🚀 Bật Bảng xếp hạng thời gian thật (3 bước)</h3>
          <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
            <li>
              Tạo dự án miễn phí tại <b>supabase.com</b>, vào <b>SQL Editor</b> và chạy file{' '}
              <code className="rounded bg-background/70 px-1 py-0.5 text-foreground">supabase/leaderboard.sql</code>.
            </li>
            <li>
              Vào <b>Authentication → Providers</b> bật <b>Anonymous Sign-Ins</b>.
            </li>
            <li>
              Copy <code className="rounded bg-background/70 px-1 py-0.5 text-foreground">.env.example</code> thành{' '}
              <code className="rounded bg-background/70 px-1 py-0.5 text-foreground">.env</code> (hoặc thêm biến môi
              trường <code className="rounded bg-background/70 px-1 py-0.5 text-foreground">VITE_SUPABASE_URL</code> &amp;{' '}
              <code className="rounded bg-background/70 px-1 py-0.5 text-foreground">VITE_SUPABASE_ANON_KEY</code> trên
              Vercel / Netlify).
            </li>
          </ol>

          {/* Local preview with current player + AI rivals */}
          <div className="pt-2">
            <div className="mb-1.5 text-[11px] font-bold text-foreground">Xem trước thứ hạng cục bộ</div>
            <div className="space-y-1.5">
              {[
                { name: lb.playerName, worth: myWorth, sub: `${myTitle} · Bạn`, me: true },
                ...s.npcs
                  .filter((n) => n.rival)
                  .map((r) => ({
                    name: r.name,
                    worth: r.cash,
                    sub: `${s.plots.filter((p) => p.owner === r.id).length} lô · Đối thủ AI`,
                    me: false,
                  })),
              ]
                .sort((a, b) => b.worth - a.worth)
                .map((item, idx) => (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 ${
                      item.me ? 'border border-primary/50 bg-primary/15' : 'bg-background/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-black">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </span>
                      <div>
                        <div className="font-bold">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.sub}</div>
                      </div>
                    </div>
                    <span className="font-bold text-primary">{formatMoney(item.worth)}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      ) : (
        /* Live Top 50 Supabase Realtime Leaderboard */
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Top 50 Đại Gia BDSNH</h3>
            <span className="text-[11px] text-muted-foreground">Tự cập nhật tức thì</span>
          </div>

          {lb.entries.length === 0 ? (
            <p className="rounded-xl bg-secondary p-4 text-center text-xs text-muted-foreground">
              Chưa có đại gia nào trên bảng xếp hạng. Bấm <b>Đồng bộ</b> để ghi tên đầu tiên!
            </p>
          ) : (
            <div className="space-y-1.5">
              {lb.entries.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = entry.user_id === lb.userId;
                const isOnline = lb.onlineUserIds.includes(entry.user_id);
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                return (
                  <article
                    key={entry.user_id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
                      isMe
                        ? 'border border-primary/60 bg-primary/15'
                        : rank <= 3
                          ? 'border border-border bg-secondary/90'
                          : 'bg-secondary/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-7 shrink-0 text-center text-sm font-black text-primary">{medal}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-bold">
                          <span className="truncate">{entry.player_name}</span>
                          {isMe && (
                            <span className="shrink-0 rounded bg-primary px-1.5 py-0.2 text-[9px] font-black text-primary-foreground">
                              BẠN
                            </span>
                          )}
                          {isOnline && (
                            <span
                              title="Đang online"
                              className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                            />
                          )}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {entry.title} · {entry.plots_count} lô · N{entry.day} · {formatRelativeTime(entry.updated_at)}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-black text-primary">{formatMoney(entry.net_worth)}</div>
                      <div className="text-[10px] text-muted-foreground">{entry.missions_done}/9 NV</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
