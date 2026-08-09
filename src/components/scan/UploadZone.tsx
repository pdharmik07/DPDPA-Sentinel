import { useCallback, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, FileText, Radar, Trash2, UploadCloud } from 'lucide-react';
import { Badge, Button, Card, Progress } from '@/components/ui/primitives';
import { ACCEPTED_EXTENSIONS, ExtractionError, MAX_FILE_BYTES, validateFile } from '@/lib/dpdpa/extract';
import { cn, formatBytes } from '@/lib/utils';
import { useApp } from '@/store/AppContext';
import { SAMPLE_POLICY_FILENAME, buildSamplePolicyFile } from '@/lib/samplePolicy';

export function UploadZone() {
  const { file, selectFile, clearFile, startScan, phase } = useApp();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((next: File) => {
    try {
      validateFile(next);
      setError(null);
      selectFile(next);
    } catch (err) {
      setError(
        err instanceof ExtractionError
          ? { title: err.message, hint: err.hint }
          : { title: 'This file could not be read.', hint: 'Try a PDF, DOCX or TXT file.' },
      );
    }
  }, [selectFile]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) accept(dropped);
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-hairline/70 px-4 py-3 sm:px-5">
        <h3 className="font-mono text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink">
          Upload Privacy Policy
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          Upload your organisation&apos;s Privacy Policy to begin automated DPDPA compliance analysis.
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {!file ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Drag and drop a privacy policy, or browse files"
              className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-5 py-10 text-center transition-all sm:py-14',
                dragging
                  ? 'border-neon bg-neon/8 shadow-[0_0_40px_-14px_var(--color-neon)]'
                  : 'border-hairline bg-white/2 hover:border-neon/45 hover:bg-neon/4',
              )}
            >
              <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-neon/30 bg-neon/8 text-neon">
                <UploadCloud size={26} />
                <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-neon/40" />
              </span>

              <div>
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-ink">
                  Drag &amp; drop your policy here
                </p>
                <p className="mt-1.5 text-xs text-ink-faint">or click to browse from your device</p>
              </div>

              <Button variant="primary" size="sm" type="button" tabIndex={-1}>
                Browse Files
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {ACCEPTED_EXTENSIONS.map((ext) => (
                  <Badge key={ext} tone="neutral">
                    {ext.replace('.', '').toUpperCase()}
                  </Badge>
                ))}
                <Badge tone="neutral">Max {formatBytes(MAX_FILE_BYTES, 0)}</Badge>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) accept(picked);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.68rem] text-ink-faint">
                Files never leave your browser — extraction and analysis run locally.
              </p>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => accept(buildSamplePolicyFile())}
              >
                <FileText size={13} /> Load sample policy
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neon/25 bg-neon/5 p-3 sm:p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-neon/35 bg-neon/10 text-neon">
                <FileText size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-ink" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-faint">
                  {formatBytes(file.size)} · {file.type || 'document'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                aria-label="Remove file"
                title="Remove file"
                disabled={phase === 'scanning'}
              >
                <Trash2 size={15} />
              </Button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">Upload</span>
                <span className="font-mono text-[0.66rem] text-matrix">100%</span>
              </div>
              <Progress value={100} tone="green" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-white/3 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-matrix" />
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-matrix">
                  File Detected
                </span>
              </div>
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-dim">
                Status: Ready for Analysis
              </span>
            </div>

            <Button
              variant="solid"
              size="lg"
              className="w-full"
              onClick={startScan}
              disabled={phase === 'scanning'}
            >
              <Radar size={16} />
              {phase === 'scanning' ? 'Scan in progress…' : 'Start Analysis'}
            </Button>
          </div>
        )}

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-alert/35 bg-alert/8 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-alert" />
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-alert">
                {error.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{error.hint}</p>
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-[0.66rem] leading-relaxed text-ink-faint">
          Tip: no policy handy? Load <span className="font-mono text-ink-dim">{SAMPLE_POLICY_FILENAME}</span>{' '}
          to see a full scan end to end.
        </p>
      </div>
    </Card>
  );
}
