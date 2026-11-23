import { useEffect, useRef, useState } from 'react';
import { Crown, Eye, Megaphone, MessageCircle, Send, Users, X } from 'lucide-react';
import {
  sendChatMessage,
  setChatOpen,
  useLeaderboard,
  type LeaderboardEntry,
} from '../game/leaderboard';

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function ChatWidget({
  onToast,
  onVisitUser,
  hidden,
}: {
  onToast: (msg: string) => void;
  onVisitUser: (entry: LeaderboardEntry, rank: number) => void;
  hidden?: boolean;
}) {
  const lb = useLeaderboard();
  const [tab, setTab] = useState<'all' | 'news'>('all');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = tab === 'news' ? lb.messages.filter((m) => m.kind === 'news') : lb.messages;
  const top1UserId = lb.entries[0]?.user_id ?? null;

  useEffect(() => {
    if (lb.chatOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [lb.chatOpen, visibleMessages.length]);

  if (!lb.configured || hidden) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      const err = await sendChatMessage(text);
      if (err) onToast('⚠ ' + err);
      else setInput('');
    } finally {
      setSending(false);
    }
  };

  const lastMsg = lb.messages[lb.messages.length - 1] ?? null;

  if (!lb.chatOpen) {
    return (
      <div className="pointer-events-none absolute bottom-[max(4.75rem,calc(4.1rem+env(safe-area-inset-bottom)))] left-2.5 z-20 flex max-w-[calc(100vw-6.5rem)] items-center gap-1.5 sm:bottom-[5.25rem] sm:left-3 [@media(max-height:520px)]:bottom-[max(3.5rem,calc(3rem+env(safe-area-inset-bottom)))] [@media(max-height:520px)]:left-[max(0.625rem,env(safe-area-inset-left))]">
        <button
          type="button"
          aria-label="Mở Chat Đại Gia"
          onClick={() => setChatOpen(true)}
          className="panel pointer-events-auto relative flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold shadow-lg transition hover:brightness-110 active:scale-95 [@media(max-height:520px)]:h-8 [@media(max-height:520px)]:px-2.5 [@media(max-height:520px)]:py-0 [@media(max-height:520px)]:text-[11px]"
        >
          <MessageCircle size={15} className="shrink-0 text-primary" />
          <span className="whitespace-nowrap">Chat</span>
          <span className="hidden items-center gap-1 text-[10px] font-medium text-emerald-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {Math.max(1, lb.onlineCount)}
          </span>
          {lb.unreadChat > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-destructive-foreground">
              {lb.unreadChat}
            </span>
          )}
        </button>

        {lastMsg && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="panel pointer-events-auto hidden max-w-[230px] items-center gap-1.5 truncate rounded-full px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground sm:flex [@media(max-height:520px)]:hidden"
          >
            {lastMsg.kind === 'news' ? (
              <Megaphone size={12} className="shrink-0 text-primary" />
            ) : (
              <span className="shrink-0 font-bold text-primary">{lastMsg.player_name}:</span>
            )}
            <span className="truncate text-foreground/90">{lastMsg.message}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="Chat Đại Gia"
      className="panel animate-pop absolute bottom-[max(4.75rem,calc(4.1rem+env(safe-area-inset-bottom)))] left-2.5 z-30 flex h-[min(340px,50dvh)] w-[min(330px,calc(100vw-1.25rem))] flex-col overflow-hidden rounded-2xl shadow-2xl sm:bottom-[5.25rem] sm:left-3 [@media(max-height:520px)]:bottom-[max(3.35rem,calc(2.9rem+env(safe-area-inset-bottom)))] [@media(max-height:520px)]:left-[max(0.625rem,env(safe-area-inset-left))] [@media(max-height:520px)]:h-[min(235px,64dvh)]"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <MessageCircle size={15} className="shrink-0 text-primary" />
          <span className="truncate text-xs font-black text-primary">Chat Đại Gia</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            <Users size={10} /> {Math.max(1, lb.onlineCount)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              tab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setTab('news')}
            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              tab === 'news' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Megaphone size={10} /> Tin nóng
          </button>
          <button
            type="button"
            aria-label="Đóng chat"
            onClick={() => setChatOpen(false)}
            className="ml-0.5 rounded-full bg-background/60 p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2.5 py-2 text-xs">
        {visibleMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-muted-foreground">
            {tab === 'news' ? (
              <>
                <Megaphone size={18} className="text-primary/70" />
                <span>Tin nóng toàn server (soán ngôi Top 1, xây xong Tháp Việt 81...) sẽ hiện tại đây!</span>
              </>
            ) : (
              <>
                <MessageCircle size={18} className="text-primary/70" />
                <span>Chưa có tin nhắn nào. Hãy gửi lời chào tới các đại gia BDSNH nhé!</span>
              </>
            )}
          </div>
        ) : (
          visibleMessages.map((msg) => {
            if (msg.kind === 'news') {
              return (
                <div
                  key={msg.id}
                  className="rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent px-2.5 py-1.5 text-[11px] leading-snug"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-primary">
                    <span className="inline-flex items-center gap-1">
                      <Megaphone size={11} /> TIN NÓNG SERVER
                    </span>
                    <span className="font-normal text-muted-foreground">{formatShortTime(msg.created_at)}</span>
                  </div>
                  <div className="mt-0.5 font-semibold text-foreground">{msg.message}</div>
                </div>
              );
            }

            const isMe = msg.user_id === lb.userId;
            const isTop1 = Boolean(msg.user_id && msg.user_id === top1UserId);
            const entryIdx = msg.user_id ? lb.entries.findIndex((e) => e.user_id === msg.user_id) : -1;
            const entry = entryIdx >= 0 ? lb.entries[entryIdx] : null;

            return (
              <div
                key={msg.id}
                className={`rounded-xl px-2.5 py-1.5 leading-snug ${
                  isMe ? 'ml-4 border border-primary/35 bg-primary/15' : 'mr-3 bg-secondary/75'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    {isTop1 && <Crown size={11} className="shrink-0 text-primary" />}
                    <span className={`truncate text-[11px] font-bold ${isMe ? 'text-primary' : 'text-foreground'}`}>
                      {msg.player_name}
                    </span>
                    {entry && !isMe && (
                      <button
                        type="button"
                        title={`Ghé thăm thành phố của ${entry.player_name}`}
                        onClick={() => onVisitUser(entry, entryIdx + 1)}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded bg-background/60 px-1 py-0.2 text-[9px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Eye size={9} /> Thăm
                      </button>
                    )}
                  </div>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{formatShortTime(msg.created_at)}</span>
                </div>
                <p className="mt-0.5 break-words text-[11.5px] text-foreground/95">{msg.message}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-1.5 border-t border-border bg-secondary/50 p-2"
      >
        <input
          type="text"
          maxLength={140}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhắn với các đại gia..."
          className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Gửi tin nhắn"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-45"
        >
          <Send size={15} />
        </button>
      </form>
    </aside>
  );
}
