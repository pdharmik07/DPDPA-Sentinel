import { cn } from '@/lib/utils';

/**
 * Brand mark: shield (protection) + circuit traces (automation) + check (compliance).
 */
export function Logo({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-9 w-9', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id="sentinel-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-neon)" />
          <stop offset="55%" stopColor="var(--color-electric)" />
          <stop offset="100%" stopColor="var(--color-violet)" />
        </linearGradient>
        <linearGradient id="sentinel-check" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-matrix)" />
          <stop offset="100%" stopColor="var(--color-neon)" />
        </linearGradient>
      </defs>

      <path
        d="M24 3.5 7 10.2v11.5c0 10.6 7.1 18 17 20.8 9.9-2.8 17-10.2 17-20.8V10.2L24 3.5Z"
        fill="rgba(8,14,26,0.9)"
        stroke="url(#sentinel-shield)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* circuit traces */}
      <g stroke="var(--color-neon)" strokeWidth="1.1" opacity="0.55" strokeLinecap="round">
        <path d="M12 17h5.5l2.5-2.5" fill="none" />
        <path d="M36 17h-5.5L28 14.5" fill="none" />
        <path d="M12 27h4l2 2" fill="none" />
        <path d="M36 27h-4l-2 2" fill="none" />
      </g>
      <g fill="var(--color-neon)" opacity="0.85">
        <circle cx="11.6" cy="17" r="1.35" />
        <circle cx="36.4" cy="17" r="1.35" />
        <circle cx="11.6" cy="27" r="1.15" />
        <circle cx="36.4" cy="27" r="1.15" />
      </g>

      <path
        d="m16.5 24.4 5.2 5.3 10-11"
        fill="none"
        stroke="url(#sentinel-check)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {animated ? (
        <circle cx="24" cy="24" r="16" fill="none" stroke="var(--color-neon)" strokeWidth="0.8" opacity="0.25">
          <animate attributeName="r" values="14;20;14" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="4s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </svg>
  );
}
