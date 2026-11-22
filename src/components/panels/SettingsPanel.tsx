import { useState } from 'react';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  Gauge,
  HelpCircle,
  LogIn,
  LogOut,
  Music,
  Sparkles,
  Upload,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  clearGameState,
  createInitialGameState,
  hydrateGameState,
  saveGameState,
} from '../../game/engine';
import {
  linkEmailAccount,
  loadCloudState,
  saveCloudState,
  signInEmailAccount,
  signOutAccount,
  syncPlayerScore,
  useLeaderboard,
} from '../../game/leaderboard';
import {
  GRAPHICS_PRESETS,
  notifyStore,
  saveGfxSettings,
  setMusicEnabled,
  setMusicVolume,
  store,
  type GraphicsQuality,
} from '../../game/store';
import type { GameState } from '../../game/types';
import { BrandLogo } from '../BrandLogo';
import { Button } from '../ui';

const QUALITY_ORDER: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

export function SettingsPanel({
  s,
  onShowTutorial,
  onToast,
}: {
  s: GameState;
  onShowTutorial: () => void;
  onToast: (msg: string) => void;
}) {
  const lb = useLeaderboard();
  const [authTab, setAuthTab] = useState<'link' | 'login'>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (authTab === 'link') {
        const res = await linkEmailAccount(email, password, s);
        onToast((res.ok ? '' : '⚠ ') + res.message);
        if (res.ok) {
          setEmail('');
          setPassword('');
        }
      } else {
        const res = await signInEmailAccount(email, password, s);
        onToast((res.ok ? '' : '⚠ ') + res.message);
        if (res.ok) {
          if (res.loadedState) {
            store.s = res.loadedState;
            store.selected = null;
            notifyStore();
          }
          setEmail('');
          setPassword('');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCloudUpload = async () => {
    setBusy(true);
    try {
      const err = await saveCloudState(s, true);
      await syncPlayerScore(s, true);
      onToast(err ? '⚠ ' + err : '☁️ Đã sao lưu toàn bộ tiến trình lên Cloud!');
    } finally {
      setBusy(false);
    }
  };

  const handleCloudDownload = async () => {
    if (!window.confirm('Tải dữ liệu từ Cloud sẽ ghi đè tiến trình hiện tại trên máy này. Tiếp tục?')) return;
    setBusy(true);
    try {
      const res = await loadCloudState();
      if (res.error) onToast('⚠ ' + res.error);
      else if (!res.state) onToast('⚠ Tài khoản này chưa có dữ liệu lưu trên Cloud.');
      else {
        store.s = res.state;
        store.selected = null;
        notifyStore();
        onToast('☁️ Đã khôi phục tiến trình từ Cloud!');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify({ ...s, nego: null }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bdsnh-save-ngay-${s.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('📥 Đã tải file sao lưu dự phòng!');
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const hydrated = hydrateGameState(JSON.parse(text));
        if (!hydrated) {
          onToast('⚠ File lưu không hợp lệ.');
          return;
        }
        store.s = hydrated;
        store.selected = null;
        saveGameState(hydrated);
        notifyStore();
        if (lb.configured) {
          await saveCloudState(hydrated, true);
          await syncPlayerScore(hydrated, true);
        }
        onToast('✅ Đã khôi phục dữ liệu từ file!');
      } catch {
        onToast('⚠ Không đọc được file lưu.');
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      {/* Brand header */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/70 px-3 py-2.5">
        <BrandLogo size="md" showSubtitle />
        <span className="rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          v1.1 Cloud
        </span>
      </div>

      {/* Cloud Account & Cross-Device Save */}
      {lb.configured && (
        <section className="space-y-2.5 rounded-2xl border border-border bg-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Cloud size={16} className="text-primary" />
              Tài khoản Cloud (Đổi máy giữ dữ liệu)
            </div>
            {!lb.isAnonymous && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-success">
                <UserCheck size={11} /> Đã liên kết
              </span>
            )}
          </div>

          {!lb.isAnonymous && lb.email ? (
            <div className="space-y-2">
              <div className="rounded-xl bg-background/50 px-2.5 py-2 text-xs">
                <div className="font-semibold text-foreground">{lb.email}</div>
                <div className="text-[11px] text-muted-foreground">
                  {lb.cloudSavedAt
                    ? `Đã lưu Cloud lúc ${new Date(lb.cloudSavedAt).toLocaleTimeString('vi-VN')}`
                    : 'Tự động đồng bộ mỗi ngày & khi bấm lưu'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" disabled={busy || lb.cloudSaving} onClick={handleCloudUpload}>
                  <CloudUpload size={14} /> Lưu Cloud
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={handleCloudDownload}>
                  <CloudDownload size={14} /> Tải từ Cloud
                </Button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await signOutAccount();
                  setBusy(false);
                  onToast('Đã đăng xuất sang chế độ khách.');
                }}
                className="btn-ghost flex w-full items-center justify-center gap-1.5 py-1.5 text-xs"
              >
                <LogOut size={13} /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Bạn đang chơi ở chế độ <b>Khách</b> (chỉ lưu trên máy này). Liên kết Email để đồng bộ toàn bộ đất đai,
                tiền và thứ hạng BXH sang điện thoại / máy tính khác.
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAuthTab('link')}
                  className={`rounded-lg py-1.5 text-xs font-bold ${
                    authTab === 'link' ? 'bg-primary text-primary-foreground' : 'bg-background/50 text-muted-foreground'
                  }`}
                >
                  Liên kết tài khoản
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className={`rounded-lg py-1.5 text-xs font-bold ${
                    authTab === 'login' ? 'bg-primary text-primary-foreground' : 'bg-background/50 text-muted-foreground'
                  }`}
                >
                  Đăng nhập máy khác
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email của bạn"
                  className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <Button type="submit" size="sm" className="w-full" disabled={busy}>
                  <LogIn size={14} />
                  {busy
                    ? 'Đang xử lý...'
                    : authTab === 'link'
                      ? 'Liên kết & Lưu lên Cloud'
                      : 'Đăng nhập & Tải dữ liệu'}
                </Button>
              </form>
            </div>
          )}

          {lb.cloudError && (
            <p className="rounded-lg bg-destructive/15 px-2.5 py-1.5 text-[11px] text-destructive-foreground">
              ⚠ {lb.cloudError}
            </p>
          )}
        </section>
      )}

      {/* Graphics Asset Pack Preset */}
      <section className="rounded-2xl bg-secondary p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Sparkles size={16} className="text-primary" />
          Gói đồ hoạ &amp; Hiệu năng
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUALITY_ORDER.map((q) => {
            const cfg = GRAPHICS_PRESETS[q];
            const active = store.graphicsQuality === q;
            return (
              <button
                key={q}
                onClick={() => {
                  store.graphicsQuality = q;
                  saveGfxSettings();
                  notifyStore();
                  onToast(`✨ Đồ hoạ: ${cfg.label}`);
                }}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background/40 text-foreground hover:bg-background/70'
                }`}
              >
                <div className="text-xs font-bold">{cfg.label}</div>
                <div className={`text-[10px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {cfg.desc}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Autumn Chill BGM & Sound */}
      <section className="space-y-2.5 rounded-2xl bg-secondary p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Music size={16} className="text-primary" />
            Nhạc nền Chill Mùa Thu
          </div>
          <button
            type="button"
            onClick={() => setMusicEnabled(!store.musicEnabled)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              store.musicEnabled ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground'
            }`}
          >
            {store.musicEnabled ? 'Đang bật' : 'Đã tắt'}
          </button>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span>Âm lượng</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(store.musicVolume * 100)}
            onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
            className="flex-1 accent-[var(--color-primary)]"
          />
          <span className="w-8 text-right font-semibold text-foreground">{Math.round(store.musicVolume * 100)}%</span>
        </div>
      </section>

      <div className="space-y-2">
        <button
          className="btn-ghost flex w-full items-center justify-center gap-2"
          onClick={() => {
            store.showFps = !store.showFps;
            saveGfxSettings();
            notifyStore();
          }}
        >
          <Gauge size={16} />
          Bộ đếm FPS trực tiếp: {store.showFps ? 'Bật' : 'Tắt'}
        </button>

        <button
          className="btn-ghost w-full"
          onClick={() => {
            s.heatmap = !s.heatmap;
            notifyStore();
          }}
        >
          Bản đồ nhiệt giá đất: {s.heatmap ? 'Bật' : 'Tắt'}
        </button>

        <button
          className="btn-ghost flex w-full items-center justify-center gap-2"
          onClick={() => {
            store.sfxEnabled = !store.sfxEnabled;
            saveGfxSettings();
            notifyStore();
          }}
        >
          {store.sfxEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          Hiệu ứng âm thanh: {store.sfxEnabled ? 'Bật' : 'Tắt'}
        </button>

        <button
          className="btn-ghost w-full"
          onClick={() => {
            saveGameState(s);
            if (lb.configured && !lb.isAnonymous) saveCloudState(s, true).catch(() => {});
            onToast('💾 Đã lưu tiến trình!');
            notifyStore();
          }}
        >
          💾 Lưu game (tự động lưu mỗi ngày)
        </button>

        {/* Manual JSON Backup fallback */}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost flex items-center justify-center gap-1.5 text-xs" onClick={handleExportJson}>
            <Download size={14} /> Xuất file lưu
          </button>
          <button className="btn-ghost flex items-center justify-center gap-1.5 text-xs" onClick={handleImportJson}>
            <Upload size={14} /> Nhập file lưu
          </button>
        </div>

        <button className="btn-ghost flex w-full items-center justify-center gap-2" onClick={onShowTutorial}>
          <HelpCircle size={16} /> Xem hướng dẫn
        </button>

        <button
          className="w-full rounded-lg bg-destructive py-2.5 font-bold text-destructive-foreground hover:brightness-110"
          onClick={() => {
            if (window.confirm('Chơi lại từ đầu? Mọi tiến trình sẽ mất.')) {
              clearGameState();
              store.s = createInitialGameState();
              store.selected = null;
              notifyStore();
            }
          }}
        >
          Chơi lại từ đầu
        </button>
      </div>

      <p className="pt-1 text-center text-[11px] text-muted-foreground">
        Phím tắt: Space (Tạm dừng), 1/2 (Tốc độ), +/- (Thu phóng), H (Bản đồ giá), Esc (Đóng bảng).
      </p>
      <p className="text-center text-[11px] text-muted-foreground">
        Giá đất trong game là dữ liệu mô phỏng, không phải giá thực tế.
      </p>
    </div>
  );
}
