import { useId } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  compactMobile?: boolean;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  showSubtitle = false,
  compactMobile = false,
  className = '',
}: BrandLogoProps) {
  const uid = useId();
  const goldId = `${uid}-gold`;
  const bgId = `${uid}-bg`;
  const iconPx = size === 'sm' ? 24 : size === 'lg' ? 42 : 30;
  const titleCls =
    size === 'sm'
      ? 'text-xs sm:text-sm tracking-[0.12em] sm:tracking-[0.14em]'
      : size === 'lg'
        ? 'text-2xl tracking-[0.16em]'
        : 'text-base tracking-[0.14em]';

  return (
    <div className={`inline-flex shrink-0 items-center gap-1.5 sm:gap-2 ${className}`}>
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_2px_8px_rgba(234,179,8,0.35)]"
      >
        <defs>
          <linearGradient id={goldId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id={bgId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#263038" />
            <stop offset="100%" stopColor="#14191f" />
          </linearGradient>
        </defs>

        {/* Rounded hexagonal crest */}
        <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${bgId})`} stroke={`url(#${goldId})`} strokeWidth="2.5" />

        {/* Architectural roof chevron */}
        <path
          d="M14 27L32 13L50 27"
          stroke={`url(#${goldId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Three geometric towers */}
        <rect x="18" y="31" width="7" height="19" rx="1.5" fill={`url(#${goldId})`} opacity="0.75" />
        <rect x="28" y="22" width="8.5" height="28" rx="1.5" fill={`url(#${goldId})`} />
        <rect x="39.5" y="28" width="7" height="22" rx="1.5" fill={`url(#${goldId})`} opacity="0.88" />

        {/* Tower window accents */}
        <rect x="30.5" y="26" width="3.5" height="2.4" rx="0.6" fill="#182026" />
        <rect x="30.5" y="31.5" width="3.5" height="2.4" rx="0.6" fill="#182026" />
        <rect x="30.5" y="37" width="3.5" height="2.4" rx="0.6" fill="#182026" />
        <rect x="30.5" y="42.5" width="3.5" height="5.5" rx="0.8" fill="#182026" />

        {/* Foundation line */}
        <path d="M13 51H51" stroke={`url(#${goldId})`} strokeWidth="2.4" strokeLinecap="round" />
      </svg>

      <div className={`leading-none ${compactMobile ? 'hidden min-[380px]:block' : ''}`}>
        <div className={`text-gold font-black ${titleCls}`}>BDSNH</div>
        {showSubtitle && (
          <div className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
            Bất Động Sản Đế Chế
          </div>
        )}
      </div>
    </div>
  );
}
