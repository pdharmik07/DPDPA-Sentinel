import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@/lib/api/client';
import * as api from '@/lib/api/endpoints';
import { adaptScan } from '@/lib/api/adapt';
import type { ApiScanSummary } from '@/lib/api/types';
import type { RiskLevel, ScanHistoryEntry, ScanResult } from '@/lib/dpdpa/types';
import { PIPELINE_STEPS, runScanPipeline, type LogTone, type PipelineStep, type StepStatus } from '@/lib/pipeline';
import { loadSettings, saveSettings, type AppSettings } from '@/lib/storage';
import { useAuth } from './AuthContext';

export type ScanPhase = 'idle' | 'ready' | 'scanning' | 'complete' | 'error';

export interface LogLine {
  id: number;
  text: string;
  tone: LogTone;
  at: string;
}

export interface ScanFailure {
  title: string;
  hint: string;
  code: string;
}

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  history: ScanHistoryEntry[];
  historyLoading: boolean;
  refreshHistory: () => Promise<void>;
  removeHistoryEntry: (id: string) => Promise<void>;
  resetHistory: () => Promise<void>;
  getResult: (id: string) => ScanResult | undefined;
  /** Fetches a stored scan from the backend and opens it. */
  openScanById: (id: string) => Promise<void>;

  file: File | null;
  phase: ScanPhase;
  steps: PipelineStep[];
  progress: number;
  logs: LogLine[];
  result: ScanResult | null;
  failure: ScanFailure | null;

  selectFile: (file: File) => void;
  clearFile: () => void;
  startScan: () => Promise<void>;
  resetScan: () => void;
  openResult: (result: ScanResult) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function freshSteps(): PipelineStep[] {
  return PIPELINE_STEPS.map((step) => ({ ...step, status: 'waiting' as StepStatus }));
}

const RISK: Record<string, RiskLevel> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/** Backend scan summary -> the history row shape the existing UI renders. */
function toHistoryEntry(scan: ApiScanSummary): ScanHistoryEntry {
  const score = scan.score;
  return {
    id: scan.id,
    createdAt: scan.createdAt,
    fileName: scan.fileName,
    fileSize: scan.fileSize,
    pages: scan.pages ?? 0,
    words: scan.words ?? 0,
    score: Math.round(score?.overallScore ?? 0),
    riskLevel: scan.risk ? (RISK[scan.risk.level] ?? 'none') : 'none',
    verdict: score?.verdict ?? scan.status,
    durationMs: scan.durationMs ?? 0,
    categories: (score?.categoryScores ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        label: c.label,
        score: c.score,
        earned: c.earned,
        possible: c.possible,
        requirements: c.rules,
      })),
    totals: {
      checked: (score?.passedCount ?? 0) + (score?.partialCount ?? 0) + (score?.failedCount ?? 0),
      compliant: score?.passedCount ?? 0,
      partial: score?.partialCount ?? 0,
      nonCompliant: score?.failedCount ?? 0,
      notDetected: 0,
      notApplicable: score?.notApplicableCount ?? 0,
      earnedWeight: score?.earnedPoints ?? 0,
      applicableWeight: score?.maxPoints ?? 0,
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [steps, setSteps] = useState<PipelineStep[]>(freshSteps);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);

  const logSeq = useRef(0);
  /** Full results fetched this session, so History -> View reopens instantly. */
  const resultCache = useRef(new Map<string, ScanResult>());

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const scans = await api.listScans();
      setHistory(scans.map(toHistoryEntry));
    } catch {
      // A history fetch failure must not break the page; the list simply stays
      // as it was and the user can retry.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // History belongs to the signed-in user, so it is loaded on sign-in and
  // dropped on sign-out rather than persisted in the browser.
  useEffect(() => {
    if (authStatus === 'authenticated') {
      void refreshHistory();
    } else if (authStatus === 'anonymous') {
      setHistory([]);
      resultCache.current.clear();
      setResult(null);
      setPhase('idle');
    }
  }, [authStatus, refreshHistory]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const pushLog = useCallback((text: string, tone: LogTone = 'info') => {
    logSeq.current += 1;
    const at = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs((prev) => [...prev, { id: logSeq.current, text, tone, at }]);
  }, []);

  const selectFile = useCallback((next: File) => {
    setFile(next);
    setPhase('ready');
    setFailure(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setSteps(freshSteps());
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setPhase('idle');
    setFailure(null);
    setLogs([]);
    setProgress(0);
    setSteps(freshSteps());
  }, []);

  const resetScan = useCallback(() => {
    setFile(null);
    setResult(null);
    setPhase('idle');
    setFailure(null);
    setLogs([]);
    setProgress(0);
    setSteps(freshSteps());
  }, []);

  const openResult = useCallback((next: ScanResult) => {
    resultCache.current.set(next.id, next);
    setResult(next);
    setPhase('complete');
    setProgress(100);
    setSteps(PIPELINE_STEPS.map((s) => ({ ...s, status: 'complete' as StepStatus })));
  }, []);

  const openScanById = useCallback(
    async (id: string) => {
      const cached = resultCache.current.get(id);
      if (cached) {
        openResult(cached);
        return;
      }
      const detail = await api.getScan(id);
      openResult(adaptScan(detail));
    },
    [openResult],
  );

  const startScan = useCallback(async () => {
    if (!file) return;

    setPhase('scanning');
    setFailure(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setSteps(freshSteps());

    const setStepStatus = (stepId: string, status: StepStatus) =>
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));

    try {
      const scan = await runScanPipeline(file, {
        onStep: setStepStatus,
        onProgress: setProgress,
        onLog: (line, tone) => pushLog(line, tone),
      });

      resultCache.current.set(scan.id, scan);
      setResult(scan);
      setPhase('complete');
      void refreshHistory();
    } catch (error) {
      const known = error instanceof ApiError;
      setFailure({
        title: known ? error.message : 'Analysis failed unexpectedly.',
        hint: known
          ? (error.hint ??
            'Try a different export of the document, or run the scan again.')
          : error instanceof Error
            ? error.message
            : 'Try a different file, or reload the page and scan again.',
        code: known ? error.code : 'analysis_failed',
      });
      setPhase('error');
    }
  }, [file, pushLog, refreshHistory]);

  const removeHistoryEntry = useCallback(
    async (id: string) => {
      await api.deleteScan(id);
      resultCache.current.delete(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      setResult((prev) => (prev?.id === id ? null : prev));
    },
    [],
  );

  const resetHistory = useCallback(async () => {
    const current = await api.listScans();
    await Promise.allSettled(current.map((s) => api.deleteScan(s.id)));
    resultCache.current.clear();
    setHistory([]);
    setResult(null);
  }, []);

  const getResult = useCallback((id: string) => resultCache.current.get(id), []);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      history,
      historyLoading,
      refreshHistory,
      removeHistoryEntry,
      resetHistory,
      getResult,
      openScanById,
      file,
      phase,
      steps,
      progress,
      logs,
      result,
      failure,
      selectFile,
      clearFile,
      startScan,
      resetScan,
      openResult,
    }),
    [
      settings,
      updateSettings,
      history,
      historyLoading,
      refreshHistory,
      removeHistoryEntry,
      resetHistory,
      getResult,
      openScanById,
      file,
      phase,
      steps,
      progress,
      logs,
      result,
      failure,
      selectFile,
      clearFile,
      startScan,
      resetScan,
      openResult,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
