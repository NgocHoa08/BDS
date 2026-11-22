import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { MILLION } from '../game/constants';

export interface ActionRunner {
  (fn: () => string | null | void, okToast?: string, fxPlot?: { x: number; y: number }): void;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
}

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const variantCls = {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    outline: 'border border-border bg-background/60 shadow-sm hover:bg-secondary',
    ghost: 'hover:bg-secondary/70 text-foreground',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
  }[variant];

  const sizeCls = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    icon: 'h-9 w-9 p-0',
  }[size];

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${variantCls} ${sizeCls} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatRow({ k, v, c }: { k: string; v: ReactNode; c?: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={`text-right font-semibold ${c ?? ''}`}>{v}</span>
    </div>
  );
}

export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="panel pointer-events-auto flex max-h-[68dvh] w-full max-w-2xl animate-pop flex-col rounded-t-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-gold text-lg font-black">{title}</h2>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-full bg-secondary p-1.5 text-foreground hover:brightness-110"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function ModalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-background/60 p-3 backdrop-blur-[2px] sm:items-center">
      <div className="panel w-full max-w-md animate-pop rounded-3xl p-4">{children}</div>
    </div>
  );
}

export function MillionInput({
  max,
  onPick,
  label,
}: {
  max: number;
  onPick: (amount: number) => void;
  label: string;
}) {
  const [raw, setRaw] = useState('');
  const val = Number(raw) * MILLION;

  return (
    <div className="flex gap-1.5">
      <input
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/\D/g, ''))}
        placeholder="Số triệu"
        className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="button"
        className="btn-ghost px-2.5 text-xs"
        onClick={() => setRaw(String(Math.max(0, Math.floor(max / MILLION))))}
      >
        Tối đa
      </button>
      <button
        type="button"
        className="btn-gold px-3 text-xs"
        disabled={!val}
        onClick={() => {
          onPick(val);
          setRaw('');
        }}
      >
        {label}
      </button>
    </div>
  );
}
