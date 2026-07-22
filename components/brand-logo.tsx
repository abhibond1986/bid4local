type Size = 'sm' | 'md' | 'lg' | 'xl';

const LOCKUP_H: Record<Size, string> = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-24',
};

const MARK_H: Record<Size, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

/**
 * Full horizontal wordmark. The artwork carries navy lettering, so it always
 * sits on a light plate — that keeps it razor-sharp on a dark nav rail, a
 * paper sidebar, or a navy hero alike. The plate reads as a deliberate brand
 * tile rather than a fix.
 */
export function BrandLockup({
  size = 'md',
  dark = false,
  className = '',
}: { size?: Size; dark?: boolean; className?: string }) {
  const plate = dark
    ? 'bg-white ring-1 ring-white/40 shadow-[0_18px_44px_-18px_rgba(0,0,0,.6)]'
    : 'bg-white ring-1 ring-[#0f2a55]/10 shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_12px_26px_-18px_rgba(15,42,85,.5)]';
  return (
    <span className={`inline-flex items-center rounded-2xl px-3.5 py-2 ${plate} ${className}`}>
      <img
        src="/logo.png"
        alt="Bid 4 Local — local goods, local people, better together"
        loading="eager"
        className={`logo-img w-auto object-contain ${LOCKUP_H[size]}`}
      />
    </span>
  );
}

/** Compact square mark (green 4 inside the open ring) for tight spots. */
export function BrandMark({ size = 'md', className = '' }: { size?: Size; className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt="Bid 4 Local"
      loading="eager"
      className={`logo-img object-contain ${MARK_H[size]} ${className}`}
    />
  );
}
