import { useApp } from '@/store/AppContext';

/**
 * Fixed backdrop: digital grid + drifting data-stream columns + a slow scan line.
 * Purely decorative, pointer-events disabled, and disabled entirely when the
 * user turns animations off in Settings.
 */
export function Background() {
  const { settings } = useApp();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* corner glows */}
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-electric/10 blur-[120px]" />
      <div className="absolute -right-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-neon/8 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-violet/6 blur-[130px]" />

      {/* vignette keeps text legible over the grid */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_25%,rgba(4,6,13,0.85)_100%)]" />

      {settings.animations ? (
        <>
          <div className="absolute inset-0 opacity-[0.18] animate-drift bg-[repeating-linear-gradient(90deg,transparent_0_78px,color-mix(in_oklab,var(--color-neon)_35%,transparent)_78px_79px)]" />
          <div className="absolute inset-x-0 top-0 h-32 animate-scanline bg-gradient-to-b from-transparent via-neon/6 to-transparent" />
        </>
      ) : null}
    </div>
  );
}
