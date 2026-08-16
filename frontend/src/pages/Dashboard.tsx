import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookLock,
  FileStack,
  Gauge,
  Radar,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, SectionHeading, StatTile } from '@/components/ui/primitives';
import { CategoryBars, CoverageRadar, RiskDistributionBars, ScoreTrend } from '@/components/charts';
import { Logo } from '@/components/layout/Logo';
import { useRuleSetSummary } from '@/lib/api/useRuleSetSummary';
import type { CategoryScore } from '@/lib/dpdpa/types';
import { formatDateShort } from '@/lib/utils';
import { useApp } from '@/store/AppContext';

const SYSTEM_INFO = [
  { label: 'System Status', value: 'ONLINE' },
  { label: 'Scanner', value: 'READY' },
  { label: 'Framework', value: 'DPDPA INDIA' },
  { label: 'Engine', value: 'NLP ANALYSIS' },
];

function Hero() {
  const ruleSet = useRuleSetSummary();
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:p-10">
        <div>
          <Badge tone="green" className="mb-4">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-matrix" aria-hidden />
            System Online
          </Badge>

          <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Scan. Analyze. <span className="text-neon text-glow">Comply.</span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-base">
            Analyze your Privacy Policy against DPDPA requirements using automated compliance
            intelligence.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/scan">
              <Button variant="solid" size="lg">
                <Radar size={16} /> Start Compliance Scan
              </Button>
            </Link>
            <Link to="/framework">
              <Button variant="outline" size="lg">
                <BookLock size={16} /> View DPDPA Framework
              </Button>
            </Link>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SYSTEM_INFO.map((item) => (
              <div key={item.label} className="rounded-lg border border-hairline bg-black/25 px-3 py-2">
                <dt className="label">{item.label}</dt>
                <dd className="mt-1 font-mono text-[0.7rem] font-bold tracking-[0.1em] text-neon">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Animated shield visual */}
        <div className="relative mx-auto grid w-full max-w-xs place-items-center lg:max-w-none">
          <div className="absolute h-56 w-56 rounded-full bg-neon/10 blur-3xl" aria-hidden />
          <div className="relative grid h-56 w-56 place-items-center sm:h-64 sm:w-64">
            <div className="absolute inset-0 rounded-full border border-neon/20" />
            <div className="absolute inset-5 rounded-full border border-electric/20" />
            <div className="absolute inset-10 rounded-full border border-violet/15" />
            <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-neon/30" />
            <div className="absolute inset-0 animate-pulse-ring rounded-full border border-neon/40" />
            <Logo className="h-24 w-24 drop-shadow-[0_0_28px_rgba(34,211,238,0.45)] sm:h-28 sm:w-28" />
          </div>
          <p className="mt-3 text-center font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-faint">
            {ruleSet ? `${ruleSet.ruleCount} rules across ${ruleSet.categoryCount} categories` : 'Loading rule set'}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { history } = useApp();

  const metrics = useMemo(() => {
    if (history.length === 0) {
      return { total: 0, average: 0, compliant: 0, highRisk: 0, categories: [] as CategoryScore[] };
    }
    const total = history.length;
    const average = Math.round(history.reduce((sum, h) => sum + h.score, 0) / total);
    const compliant = history.filter((h) => h.score >= 75).length;
    const highRisk = history.filter((h) => h.riskLevel === 'high' || h.riskLevel === 'critical').length;

    // Average each category across all scans for the coverage charts. The
    // category list is derived from the scans themselves — the authoritative
    // set lives in the backend rule pack, not in the client.
    const byCategory = new Map<string, { label: string; scores: number[] }>();
    for (const entry of history) {
      for (const cat of entry.categories) {
        const bucket = byCategory.get(cat.id) ?? { label: cat.label, scores: [] };
        bucket.scores.push(cat.score);
        byCategory.set(cat.id, bucket);
      }
    }
    const categories: CategoryScore[] = [...byCategory.entries()].map(([id, { label, scores }]) => {
      const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { id, label, score, earned: score, possible: 100, requirements: scores.length };
    });

    return { total, average, compliant, highRisk, categories };
  }, [history]);

  const recent = history.slice(0, 6);

  return (
    <div className="space-y-6">
      <Hero />

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Operations Overview"
          title="Dashboard Analytics"
          description="Aggregated across every scan saved to your account."

        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Total Scans"
            value={metrics.total}
            hint="Policies analysed"
            icon={<FileStack size={15} />}
          />
          <StatTile
            label="Average Score"
            value={`${metrics.average}%`}
            hint="Across all scans"
            icon={<Gauge size={15} />}
            tone="violet"
          />
          <StatTile
            label="Compliant Policies"
            value={metrics.compliant}
            hint="Scoring 75 or above"
            icon={<ShieldCheck size={15} />}
            tone="green"
          />
          <StatTile
            label="High-Risk Policies"
            value={metrics.highRisk}
            hint="High or critical risk"
            icon={<ShieldAlert size={15} />}
            tone="red"
          />
        </div>

        {history.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader title="Compliance Score Trend" subtitle="Most recent scans, oldest first." />
              <div className="p-4 sm:p-5">
                <ScoreTrend history={history} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Risk Distribution" subtitle="Overall risk level assigned per scan." />
              <div className="p-4 sm:p-5">
                <RiskDistributionBars history={history} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Category-wise Compliance" subtitle="Mean score per DPDPA category." />
              <div className="p-4 sm:p-5">
                <CategoryBars categories={metrics.categories} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Requirement Coverage" subtitle="How evenly policies cover the framework." />
              <div className="p-4 sm:p-5">
                <CoverageRadar categories={metrics.categories} />
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="font-mono text-sm uppercase tracking-[0.14em] text-ink">No scans yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-faint">
              Run your first compliance scan to populate the analytics dashboard.
            </p>
            <Link to="/scan" className="mt-4 inline-block">
              <Button variant="solid" size="sm">
                <Radar size={13} /> Start Compliance Scan
              </Button>
            </Link>
          </Card>
        )}
      </section>

      {recent.length > 0 ? (
        <Card>
          <CardHeader
            title="Recent Scans"
            subtitle="Latest activity in this workspace."
            action={
              <Link to="/reports">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            }
          />
          <div className="divide-y divide-hairline/50">
            {recent.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink" title={h.fileName}>
                    {h.fileName}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                    {formatDateShort(h.createdAt)} · {h.pages} pages · {h.words.toLocaleString('en-IN')} words
                  </span>
                </span>
                <span className="font-mono text-lg font-bold tabular-nums text-ink">{h.score}</span>
                <Badge
                  tone={
                    h.riskLevel === 'critical'
                      ? 'red'
                      : h.riskLevel === 'high'
                        ? 'amber'
                        : h.riskLevel === 'medium'
                          ? 'cyan'
                          : 'green'
                  }
                >
                  {h.riskLevel}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
