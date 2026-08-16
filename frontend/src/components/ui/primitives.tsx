import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ComplianceStatus, RiskLevel, WeightClass } from '@/lib/dpdpa/types';

/* ----------------------------------- Button ---------------------------------- */

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-neon/15 text-neon border border-neon/45 hover:bg-neon/25 hover:border-neon/80 hover:shadow-[0_0_28px_-6px_var(--color-neon)]',
        solid:
          'bg-neon text-void border border-neon hover:bg-neon/85 hover:shadow-[0_0_32px_-8px_var(--color-neon)]',
        outline:
          'bg-transparent text-ink-dim border border-hairline hover:text-ink hover:border-neon/50 hover:bg-neon/5',
        ghost: 'bg-transparent text-ink-dim border border-transparent hover:text-neon hover:bg-neon/8',
        danger:
          'bg-alert/12 text-alert border border-alert/40 hover:bg-alert/22 hover:border-alert/70',
        success:
          'bg-matrix/12 text-matrix border border-matrix/40 hover:bg-matrix/22 hover:border-matrix/70',
      },
      size: {
        sm: 'h-8 px-3 text-[0.65rem]',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-[0.78rem]',
        icon: 'h-9 w-9 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

/* ------------------------------------ Card ----------------------------------- */

export function Card({
  className,
  hover = false,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn('glass rounded-card', hover && 'glass-hover', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-hairline/70 px-4 py-3 sm:px-5 sm:py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-neon/25 bg-neon/8 text-neon">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate font-mono text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink">
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-xs leading-relaxed text-ink-faint">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ----------------------------------- Badges ---------------------------------- */

const badgeStyles = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-hairline bg-white/4 text-ink-dim',
        cyan: 'border-neon/40 bg-neon/10 text-neon',
        green: 'border-matrix/40 bg-matrix/10 text-matrix',
        amber: 'border-signal/40 bg-signal/10 text-signal',
        red: 'border-alert/40 bg-alert/10 text-alert',
        violet: 'border-violet/40 bg-violet/10 text-violet',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) {
  return (
    <span className={cn(badgeStyles({ tone }), className)} {...props}>
      {children}
    </span>
  );
}

export const STATUS_META: Record<
  ComplianceStatus,
  { label: string; tone: 'green' | 'amber' | 'red' | 'neutral'; dot: string }
> = {
  compliant: { label: 'Compliant', tone: 'green', dot: 'bg-matrix' },
  partial: { label: 'Partial', tone: 'amber', dot: 'bg-signal' },
  non_compliant: { label: 'Non-Compliant', tone: 'red', dot: 'bg-alert' },
  not_detected: { label: 'Not Detected', tone: 'neutral', dot: 'bg-ink-faint' },
  not_applicable: { label: 'Not Applicable', tone: 'neutral', dot: 'bg-ink-faint/50' },
};

export function StatusBadge({ status, className }: { status: ComplianceStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}

export const RISK_META: Record<
  RiskLevel,
  { label: string; tone: 'red' | 'amber' | 'cyan' | 'green' | 'neutral'; color: string }
> = {
  critical: { label: 'Critical', tone: 'red', color: 'var(--color-alert)' },
  high: { label: 'High', tone: 'amber', color: '#fb923c' },
  medium: { label: 'Medium', tone: 'cyan', color: 'var(--color-signal)' },
  low: { label: 'Low', tone: 'green', color: 'var(--color-neon)' },
  none: { label: 'None', tone: 'neutral', color: 'var(--color-matrix)' },
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const meta = RISK_META[level];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export const WEIGHT_META: Record<WeightClass, { label: string; tone: 'red' | 'amber' | 'cyan'; weight: number }> = {
  mandatory: { label: 'Mandatory · w3', tone: 'red', weight: 3 },
  conditional: { label: 'Conditional · w2', tone: 'amber', weight: 2 },
  recommended: { label: 'Recommended · w1', tone: 'cyan', weight: 1 },
};

/* ---------------------------------- Progress --------------------------------- */

export function Progress({
  value,
  className,
  tone = 'cyan',
  showSweep = false,
}: {
  value: number;
  className?: string;
  tone?: 'cyan' | 'green' | 'amber' | 'red';
  showSweep?: boolean;
}) {
  const fill = {
    cyan: 'from-electric to-neon',
    green: 'from-matrix/70 to-matrix',
    amber: 'from-signal/70 to-signal',
    red: 'from-alert/70 to-alert',
  }[tone];

  return (
    <div
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-white/6', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out', fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
      {showSweep ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-sweep bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      ) : null}
    </div>
  );
}

/* --------------------------------- Utilities --------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label mb-2">{eyebrow}</p> : null}
        <h2 className="text-balance text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'cyan',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'cyan' | 'green' | 'amber' | 'red' | 'violet';
}) {
  const accent = {
    cyan: 'text-neon border-neon/25 bg-neon/8',
    green: 'text-matrix border-matrix/25 bg-matrix/8',
    amber: 'text-signal border-signal/25 bg-signal/8',
    red: 'text-alert border-alert/25 bg-alert/8',
    violet: 'text-violet border-violet/25 bg-violet/8',
  }[tone];

  return (
    <Card hover className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {icon ? (
          <span className={cn('grid h-8 w-8 place-items-center rounded-md border', accent)}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-hairline bg-white/4 text-ink-faint">
          {icon}
        </span>
      ) : null}
      <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-ink">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-ink-faint">{description}</p>
      {action}
    </div>
  );
}
