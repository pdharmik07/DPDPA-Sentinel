import type { ScanHistoryEntry, ScanResult } from './dpdpa/types';

const HISTORY_KEY = 'dpdpa-sentinel:history:v1';
const SETTINGS_KEY = 'dpdpa-sentinel:settings:v1';
const MAX_HISTORY = 60;

export interface AppSettings {
  animations: boolean;
  terminalVerbose: boolean;
  strictMode: boolean;
  organisation: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  animations: true,
  terminalVerbose: true,
  strictMode: false,
  organisation: 'Silver Oak University — CSE (Cyber Security)',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings(): AppSettings {
  return read<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings stay in memory for the session */
  }
}

export function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScanHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: ScanHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* quota exceeded — history is a convenience, never block the scan on it */
  }
}

export function toHistoryEntry(result: ScanResult): ScanHistoryEntry {
  return {
    id: result.id,
    createdAt: result.createdAt,
    fileName: result.stats.fileName,
    fileSize: result.stats.fileSize,
    pages: result.stats.pages,
    words: result.stats.words,
    score: result.score,
    riskLevel: result.riskLevel,
    verdict: result.verdict,
    durationMs: result.durationMs,
    categories: result.categories,
    totals: result.totals,
  };
}

export function appendHistory(result: ScanResult): ScanHistoryEntry[] {
  const entries = [toHistoryEntry(result), ...loadHistory()];
  writeHistory(entries);
  return entries.slice(0, MAX_HISTORY);
}

export function deleteHistoryEntry(id: string): ScanHistoryEntry[] {
  const entries = loadHistory().filter((e) => e.id !== id);
  writeHistory(entries);
  return entries;
}

export function clearHistory(): ScanHistoryEntry[] {
  writeHistory([]);
  return [];
}

export function replaceHistory(entries: ScanHistoryEntry[]): ScanHistoryEntry[] {
  writeHistory(entries);
  return entries.slice(0, MAX_HISTORY);
}
