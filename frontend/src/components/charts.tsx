import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryScore, RiskItem, ScanHistoryEntry } from '@/lib/dpdpa/types';
import { RISK_META } from '@/components/ui/primitives';
import { formatDateShort } from '@/lib/utils';

const AXIS = {
  stroke: '#64789a',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
};

const tooltipStyle = {
  contentStyle: {
    background: '#070b16',
    border: '1px solid #1b2942',
    borderRadius: 10,
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: '#e8f2ff',
  },
  labelStyle: { color: '#9fb3ce', fontSize: 11 },
  cursor: { fill: 'rgba(34,211,238,0.06)' },
};

export function RiskDonut({ risks }: { risks: RiskItem[] }) {
  const levels = ['critical', 'high', 'medium', 'low'] as const;
  const data = levels
    .map((level) => ({
      name: RISK_META[level].label,
      value: risks.filter((r) => r.level === level).length,
      colour: RISK_META[level].color,
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="grid h-48 place-items-center rounded-lg border border-matrix/25 bg-matrix/5">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-matrix">No risks</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="58%" outerRadius="86%" paddingAngle={3} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.colour} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} cursor={false} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: d.colour }} aria-hidden />
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-dim">{d.name}</span>
            </span>
            <span className="font-mono text-[0.66rem] tabular-nums text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ScoreTrend({ history }: { history: ScanHistoryEntry[] }) {
  const data = [...history]
    .slice(0, 12)
    .reverse()
    .map((h) => ({ name: formatDateShort(h.createdAt).slice(0, 6), score: h.score }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS} width={40} />
          <Tooltip {...tooltipStyle} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={{ r: 2.5, fill: '#22d3ee', strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ categories }: { categories: CategoryScore[] }) {
  const data = categories.map((c) => ({ name: c.label.split(' ')[0], score: c.score }));
  const colourFor = (v: number) =>
    v >= 80 ? '#34d399' : v >= 55 ? '#22d3ee' : v >= 35 ? '#fbbf24' : '#fb7185';

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS} interval={0} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS} width={40} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={38}>
            {data.map((d) => (
              <Cell key={d.name} fill={colourFor(d.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CoverageRadar({ categories }: { categories: CategoryScore[] }) {
  const data = categories.map((c) => ({ subject: c.label.split(' ')[0], score: c.score }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#1b2942" />
          <PolarAngleAxis dataKey="subject" tick={AXIS} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#4f8cff" fill="#4f8cff" fillOpacity={0.28} strokeWidth={2} />
          <Tooltip {...tooltipStyle} cursor={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskDistributionBars({ history }: { history: ScanHistoryEntry[] }) {
  const levels = ['critical', 'high', 'medium', 'low'] as const;
  const data = levels.map((level) => ({
    name: RISK_META[level].label,
    count: history.filter((h) => h.riskLevel === level).length,
    colour: RISK_META[level].color,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} width={40} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.colour} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
