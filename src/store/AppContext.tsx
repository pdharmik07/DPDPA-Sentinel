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
import { ExtractionError } from '@/lib/dpdpa/extract';
import type { ScanHistoryEntry, ScanResult } from '@/lib/dpdpa/types';
import { PIPELINE_STEPS, runScanPipeline, type LogTone, type PipelineStep, type StepStatus } from '@/lib/pipeline';
import { buildDemoHistory } from '@/lib/demoData';
import {
  appendHistory,
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
  loadSettings,
  replaceHistory,
  saveSettings,
  type AppSettings,
} from '@/lib/storage';

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
  removeHistoryEntry: (id: string) => void;
  resetHistory: () => void;
  restoreDemoHistory: () => void;
  getResult: (id: string) => ScanResult | undefined;

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => loadHistory());

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [steps, setSteps] = useState<PipelineStep[]>(freshSteps);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);

  const logSeq = useRef(0);
  /** Full results for this session, so History → View can reopen them. */
  const resultCache = useRef(new Map<string, ScanResult>());

  // Seed sample analytics on first run so the dashboard charts are not empty.
  useEffect(() => {
    if (history.length === 0 && settings.seedDemoData) {
      setHistory(replaceHistory(buildDemoHistory()));
    }
    // Intentionally first-run only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const scan = await runScanPipeline(
        file,
        {
          onStep: setStepStatus,
          onProgress: setProgress,
          onLog: (line, tone) => pushLog(line, tone),
        },
        { pace: settings.animations ? 1 : 0.15 },
      );

      resultCache.current.set(scan.id, scan);
      setResult(scan);
      setHistory(appendHistory(scan));
      setPhase('complete');
    } catch (error) {
      const isKnown = error instanceof ExtractionError;
      setFailure({
        title: isKnown ? error.message : 'Analysis failed unexpectedly.',
        hint: isKnown
          ? error.hint
          : error instanceof Error
            ? error.message
            : 'Try a different file, or reload the page and scan again.',
        code: isKnown ? error.code : 'analysis_failed',
      });
      setPhase('error');
    }
  }, [file, pushLog, settings.animations]);

  const removeHistoryEntry = useCallback((id: string) => {
    setHistory(deleteHistoryEntry(id));
    resultCache.current.delete(id);
  }, []);

  const resetHistory = useCallback(() => {
    setHistory(clearHistory());
    resultCache.current.clear();
  }, []);

  const restoreDemoHistory = useCallback(() => {
    setHistory(replaceHistory(buildDemoHistory()));
  }, []);

  const getResult = useCallback((id: string) => resultCache.current.get(id), []);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      updateSettings,
      history,
      removeHistoryEntry,
      resetHistory,
      restoreDemoHistory,
      getResult,
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
      removeHistoryEntry,
      resetHistory,
      restoreDemoHistory,
      getResult,
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
