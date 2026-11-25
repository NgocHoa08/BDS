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
  const imgCls =
    size === 'sm'
      ? compactMobile
        ? 'h-9 sm:h-11 [@media(max-height:520px)]:h-8'
        : 'h-10 sm:h-12'
      : size === 'lg'
        ? 'h-28 sm:h-36'
        : 'h-14 sm:h-16';

  return (
    <div className={`inline-flex shrink-0 flex-col items-center justify-center ${className}`}>
      <img
        src="./logo.png"
        alt="Đại Gia Bất Động Sản"
        draggable={false}
        className={`${imgCls} w-auto select-none object-contain drop-shadow-[0_3px_10px_rgba(245,158,11,0.35)]`}
      />
      {showSubtitle && (
        <div className="mt-1 text-[11px] font-semibold tracking-wider text-gold/90">
          Khởi nghiệp 1 tỷ · Xây đế chế BĐS
        </div>
      )}
    </div>
  );
}
