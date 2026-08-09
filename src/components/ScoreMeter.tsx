import { useEffect, useState } from 'react';
import type { RiskLevel } from '@/lib/dpdpa/types';
import { cn } from '@/lib/utils';

function colourFor(score: number): string {
  if (score >= 85) return 'var(--color-matrix)';
  if (score >= 60) return 'var(--color-neon)';
  if (score >= 35) return 'var(--color-signal)';
  return 'var(--color-alert)';
}

/** Animated circular compliance meter. */
export function ScoreMeter({
  score,
  verdict,
  riskLevel,
  size = 200,
  animate = true,
}: {
  score: number;
  verdict: string;
  riskLevel?: RiskLevel;
  size?: number;
  animate?: boolean;
}) {
  const [shown, setShown] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setShown(score);
      return;
    }
    let frame = 0;
    const total = 48;
    const id = window.setInterval(() => {
      frame += 1;
      // ease-out so the needle decelerates into its final value
      const t = 1 - Math.pow(1 - frame / total, 3);
      setShown(Math.round(score * t));
      if (frame >= total) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [score, animate]);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (shown / 100) * circumference;
  const colour = colourFor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 10px ${colour})`, transition: 'stroke-dasharray 60ms linear' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold tabular-nums leading-none"
            style={{ color: colour, fontSize: size * 0.28 }}
          >
            {shown}
          </span>
          <span className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">
            / 100
          </span>
        </div>
      </div>

      <div className="text-center">
        <p
          className="font-mono text-sm font-bold uppercase tracking-[0.14em]"
          style={{ color: colour }}
        >
          {verdict}
        </p>
        {riskLevel ? (
          <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
            Risk level: <span className={cn('text-ink-dim')}>{riskLevel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
