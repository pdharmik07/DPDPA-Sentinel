import { Button, Card, CardHeader, SectionHeading } from '@/components/ui/primitives';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-neon/60 bg-neon/25' : 'border-hairline bg-white/6',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all',
            checked ? 'left-[1.4rem] bg-neon' : 'left-0.5 bg-ink-faint',
          )}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, history, resetHistory, refreshHistory } = useApp();

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Configuration"
        title="Settings"
        description="Display preferences are stored in this browser. Scans are stored against your account."
      />

      <Card>
        <CardHeader title="Interface" />
        <div className="divide-y divide-hairline/50">
          <Toggle
            label="Background & scan animations"
            hint="Turn off for a static interface, or on low-powered demo machines. Also speeds up the scan pacing."
            checked={settings.animations}
            onChange={(v) => updateSettings({ animations: v })}
          />
          <Toggle
            label="Verbose engine log"
            hint="Show per-requirement mapping lines in the terminal during a scan."
            checked={settings.terminalVerbose}
            onChange={(v) => updateSettings({ terminalVerbose: v })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Organisation" />
        <div className="p-4 sm:p-5">
          <label htmlFor="org" className="label mb-2 block">
            Name shown on reports
          </label>
          <input
            id="org"
            type="text"
            value={settings.organisation}
            onChange={(e) => updateSettings({ organisation: e.target.value })}
            className="h-10 w-full rounded-lg border border-hairline bg-black/30 px-3 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-neon/50 focus:outline-none"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scan Data"
          subtitle={`${history.length} scan record${history.length === 1 ? '' : 's'} stored in your account.`}
        />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          <Button variant="outline" size="sm" onClick={() => void refreshHistory()}>
            Refresh from server
          </Button>
          <Button variant="danger" size="sm" onClick={() => void resetHistory()}>
            Clear all scan history
          </Button>
        </div>
        <p className="px-4 pb-4 text-[0.68rem] leading-relaxed text-ink-faint sm:px-5 sm:pb-5">
          Each scan stores the extracted text of the document so evidence can be re-shown when you reopen a
          report. Scans are private to your account. Clearing history permanently deletes them, along with
          their findings and reports, and cannot be undone.
        </p>
      </Card>
    </div>
  );
}
