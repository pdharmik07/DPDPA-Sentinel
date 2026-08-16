import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Clock, Loader2, ScrollText } from 'lucide-react';
import { Badge, Card, CardHeader, SectionHeading, StatTile, WEIGHT_META } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api/client';
import * as api from '@/lib/api/endpoints';
import type { ApiFramework, ApiRule, ApiWeightClass } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const WEIGHT_KEY: Record<ApiWeightClass, keyof typeof WEIGHT_META> = {
  MANDATORY: 'mandatory',
  CONDITIONAL: 'conditional',
  RECOMMENDED: 'recommended',
};

const SOURCE_LABEL: Record<string, string> = {
  ACT: 'DPDP Act 2023',
  RULES_2025: 'DPDP Rules 2025',
  PROJECT_SPECIFIC: 'Project-specific check',
  BEST_PRACTICE: 'Best practice',
};

const SOURCE_TONE: Record<string, 'cyan' | 'green' | 'amber' | 'red' | 'violet'> = {
  ACT: 'cyan',
  RULES_2025: 'violet',
  PROJECT_SPECIFIC: 'amber',
  BEST_PRACTICE: 'green',
};

function EffectiveBadge({ rule }: { rule: ApiRule }) {
  if (rule.effectiveStatus === 'NOT_YET_IN_FORCE') {
    return (
      <Badge tone="amber">
        <Clock size={10} /> In force {rule.effectiveFrom}
      </Badge>
    );
  }
  if (rule.effectiveStatus === 'IN_FORCE') return <Badge tone="green">In force</Badge>;
  return <Badge tone="cyan">Commencement to verify</Badge>;
}

function RuleRow({ rule }: { rule: ApiRule }) {
  const [open, setOpen] = useState(false);
  const weight = WEIGHT_META[WEIGHT_KEY[rule.weightClass]];

  return (
    <div className="border-b border-hairline/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/3"
      >
        <span className="mt-0.5 shrink-0 font-mono text-[0.62rem] font-bold tracking-[0.1em] text-neon">
          {rule.ruleId}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">{rule.title}</span>
          <span className="mt-0.5 block font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-faint">
            {rule.legalReference || rule.legalBasis || '—'}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge tone={weight.tone}>{weight.label}</Badge>
          <ChevronDown
            size={14}
            className={cn('text-ink-faint transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-hairline/40 bg-void/40 px-4 py-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={SOURCE_TONE[rule.sourceType] ?? 'cyan'}>
              {SOURCE_LABEL[rule.sourceType] ?? rule.sourceType}
            </Badge>
            <Badge tone="cyan">Weight {rule.weight}</Badge>
            <Badge tone={rule.severity === 'CRITICAL' || rule.severity === 'HIGH' ? 'red' : 'amber'}>
              Severity {rule.severity}
            </Badge>
            <Badge tone="cyan">{rule.applicability.replace(/_/g, ' ')}</Badge>
            <EffectiveBadge rule={rule} />
            <Badge tone="cyan">v{rule.ruleVersion}</Badge>
          </div>

          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">Requirement</p>
            <p className="mt-1 text-sm text-ink-dim">{rule.requirement}</p>
          </div>

          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">What the law says</p>
            <p className="mt-1 text-sm text-ink-dim">{rule.description}</p>
          </div>

          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">Recommendation</p>
            <p className="mt-1 text-sm text-ink-dim">{rule.recommendation}</p>
          </div>

          {rule.detectionSummary && rule.detectionSummary.specifics.length > 0 && (
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">
                Elements the clause must spell out
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-ink-dim">
                {rule.detectionSummary.specifics.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {rule.effectiveNote && (
            <p className="rounded-lg border border-hairline/60 bg-void/60 px-3 py-2 text-[0.72rem] leading-relaxed text-ink-faint">
              {rule.effectiveNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Framework() {
  const [framework, setFramework] = useState<ApiFramework | null>(null);
  const [rules, setRules] = useState<ApiRule[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getFramework(), api.listRules()])
      .then(([fw, rulesResponse]) => {
        if (cancelled) return;
        setFramework(fw);
        setRules(rulesResponse.rules);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, 'internal_error', 'Could not load the rule set.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (active === 'all' ? rules : rules.filter((r) => r.category === active)),
    [rules, active],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neon" />
        <span className="ml-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-dim">
          Loading rule set
        </span>
      </div>
    );
  }

  if (error || !framework) {
    return (
      <Card className="p-6">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-alert" />
          <div>
            <p className="text-sm text-ink">{error?.message ?? 'Could not load the rule set.'}</p>
            {error?.hint && <p className="mt-1 text-[0.75rem] text-ink-dim">{error.hint}</p>}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Compliance Framework"
        title="DPDPA 2023 + DPDP Rules 2025"
        description={`${framework.totals.rules} rules across ${framework.categories.length} categories · rule pack v${framework.ruleVersion}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Mandatory" value={String(framework.totals.mandatory)} tone="red" />
        <StatTile label="Conditional" value={String(framework.totals.conditional)} tone="amber" />
        <StatTile label="Recommended" value={String(framework.totals.recommended)} tone="cyan" />
        <StatTile label="Categories" value={String(framework.categories.length)} tone="violet" />
      </div>

      {/* Commencement is load-bearing here: most operative DPDP Rules 2025
          provisions do not come into force until 13 May 2027. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.75rem] text-ink-dim">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-faint">
            Commencement status ({framework.effectiveness.assessedOn})
          </span>
          <span>
            <strong className="text-matrix">{framework.effectiveness.inForce}</strong> in force
          </span>
          <span>
            <strong className="text-amber">{framework.effectiveness.notYetInForce}</strong> not yet in force
          </span>
          <span>
            <strong className="text-ink">{framework.effectiveness.unknown}</strong> commencement to verify
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scoring model"
          subtitle={framework.scoring.model}
          icon={<ScrollText size={15} />}
        />
        <div className="space-y-2 px-4 pb-4 text-[0.78rem] text-ink-dim">
          <p>
            <strong className="text-ink">Mandatory</strong> pass 3 · partial 1 · fail 0 ·
            <strong className="text-ink"> Conditional</strong> pass 2 · partial 1 · fail 0 · N/A excluded ·
            <strong className="text-ink"> Recommended</strong> pass 1 · partial 0.5 · fail 0
          </p>
          <p>Category score = {framework.scoring.categoryFormula}</p>
          <p>Overall score = {framework.scoring.overallFormula}</p>
          <p className="text-[0.72rem] text-ink-faint">{framework.scoring.note}</p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActive('all')}
          className={cn(
            'rounded-lg border px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] transition',
            active === 'all'
              ? 'border-neon/60 bg-neon/12 text-neon'
              : 'border-hairline text-ink-dim hover:border-neon/40 hover:text-ink',
          )}
        >
          All ({rules.length})
        </button>
        {framework.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] transition',
              active === c.id
                ? 'border-neon/60 bg-neon/12 text-neon'
                : 'border-hairline text-ink-dim hover:border-neon/40 hover:text-ink',
            )}
          >
            {c.label} ({c.ruleCount})
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={active === 'all' ? 'All requirements' : (framework.categories.find((c) => c.id === active)?.label ?? '')}
          subtitle={`${visible.length} rule${visible.length === 1 ? '' : 's'} · click a rule to expand`}
        />
        <div>
          {visible.map((rule) => (
            <RuleRow key={rule.ruleId} rule={rule} />
          ))}
        </div>
      </Card>

      <p className="text-[0.72rem] leading-relaxed text-ink-faint">
        Sources: {framework.legalVersion}. Reference text cross-checked against{' '}
        <a href={framework.sourceUrl} target="_blank" rel="noreferrer" className="text-neon underline-offset-4 hover:underline">
          dpdpa.com
        </a>
        . This tool provides an automated preliminary assessment — it is not a legal opinion or certification.
      </p>
    </div>
  );
}
