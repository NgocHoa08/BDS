import { Sparkles } from 'lucide-react';
import { formatMoney, resolveDilemma, saveGameState } from '../../game/engine';
import { notifyStore, playSfx } from '../../game/store';
import type { GameState } from '../../game/types';
import { ModalFrame } from '../ui';

export function DilemmaModal({
  s,
  toast,
}: {
  s: GameState;
  toast: (msg: string) => void;
}) {
  const dil = s.dilemma;
  if (!dil) return null;

  const pick = (choiceId: string) => {
    const res = resolveDilemma(s, choiceId);
    if (res.error) {
      playSfx('error');
      toast('⚠ ' + res.error);
      return;
    }
    playSfx(res.positive === false ? 'error' : 'win');
    if (res.message) toast(res.message);
    saveGameState(s);
    notifyStore();
  };

  return (
    <ModalFrame>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl ring-1 ring-primary/35">
            {dil.icon}
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles size={11} /> Sự kiện thị trường · Ngày {s.day}
            </div>
            <h3 className="text-gold text-base font-black leading-snug">{dil.title}</h3>
          </div>
        </div>

        <p className="rounded-2xl bg-secondary/70 p-3 text-xs leading-relaxed text-foreground/95">
          {dil.body}
        </p>

        <div className="space-y-2">
          {dil.choices.map((ch, idx) => {
            const cantAfford = Boolean(ch.cost && s.cash < ch.cost);
            return (
              <button
                key={ch.id}
                type="button"
                disabled={cantAfford}
                onClick={() => pick(ch.id)}
                className={`w-full rounded-2xl border p-3 text-left transition disabled:opacity-45 ${
                  idx === 0
                    ? 'border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/70 hover:brightness-110'
                    : 'border-border bg-secondary/70 hover:bg-secondary'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-black">
                  <span className={idx === 0 ? 'text-primary' : 'text-foreground'}>{ch.label}</span>
                  {ch.cost && (
                    <span className="shrink-0 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      -{formatMoney(ch.cost)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{ch.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
}
