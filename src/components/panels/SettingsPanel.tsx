import { Gauge, HelpCircle, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { clearGameState, createInitialGameState, saveGameState } from '../../game/engine';
import {
  GRAPHICS_PRESETS,
  notifyStore,
  saveGfxSettings,
  store,
  type GraphicsQuality,
} from '../../game/store';
import type { GameState } from '../../game/types';
import { BrandLogo } from '../BrandLogo';

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
  return (
    <div className="space-y-3">
      {/* Brand header */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/70 px-3 py-2.5">
        <BrandLogo size="md" showSubtitle />
        <span className="rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          v1.0 HD
        </span>
      </div>

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
            onToast('💾 Đã lưu tiến trình!');
            notifyStore();
          }}
        >
          💾 Lưu game (tự động lưu mỗi ngày)
        </button>

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
