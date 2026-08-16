/** Typed wrappers around the backend REST API. */

import { downloadFile, request, setToken } from './client';
import type {
  ApiFinding,
  ApiFramework,
  ApiRule,
  ApiScanDetail,
  ApiScanStatus,
  ApiScanSummary,
  ApiUser,
  AuthResponse,
} from './types';

// ── Auth ────────────────────────────────────────────────────────────────────

export async function register(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: input,
    anonymous: true,
  });
  setToken(result.token);
  return result;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
    anonymous: true,
  });
  setToken(result.token);
  return result;
}

export async function me(): Promise<ApiUser> {
  const { user } = await request<{ user: ApiUser }>('/api/auth/me');
  return user;
}

export function logout(): void {
  setToken(null);
}

// ── Scans ───────────────────────────────────────────────────────────────────

export async function createScan(file: File): Promise<{ scan: ApiScanSummary }> {
  const form = new FormData();
  form.append('file', file);
  return request<{ scan: ApiScanSummary }>('/api/scans', { method: 'POST', formData: form });
}

export async function listScans(): Promise<ApiScanSummary[]> {
  const { scans } = await request<{ scans: ApiScanSummary[] }>('/api/scans');
  return scans;
}

export async function getScan(id: string): Promise<ApiScanDetail> {
  const { scan } = await request<{ scan: ApiScanDetail }>(`/api/scans/${id}`);
  return scan;
}

export function getScanStatus(id: string, signal?: AbortSignal): Promise<ApiScanStatus> {
  return request<ApiScanStatus>(`/api/scans/${id}/status`, { signal });
}

export async function reanalyze(id: string): Promise<void> {
  await request(`/api/scans/${id}/analyze`, { method: 'POST' });
}

export async function getFindings(id: string): Promise<ApiFinding[]> {
  const { findings } = await request<{ findings: ApiFinding[] }>(`/api/scans/${id}/findings`);
  return findings;
}

export async function deleteScan(id: string): Promise<void> {
  await request(`/api/scans/${id}`, { method: 'DELETE' });
}

// ── Rules / framework ───────────────────────────────────────────────────────

export async function listRules(): Promise<{ rules: ApiRule[]; ruleVersion: string; legalVersion: string }> {
  return request('/api/rules');
}

export function getFramework(): Promise<ApiFramework> {
  return request<ApiFramework>('/api/framework');
}

// ── Reports ─────────────────────────────────────────────────────────────────

export function downloadReportPdf(id: string): Promise<void> {
  return downloadFile(`/api/scans/${id}/report/pdf`, `dpdpa-sentinel-report-${id}.pdf`);
}

export function downloadReportJson(id: string): Promise<void> {
  return downloadFile(`/api/scans/${id}/report/json`, `dpdpa-sentinel-report-${id}.json`);
}

// ── Health ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  service: string;
  ruleVersion: string;
  rules: number;
  nlp: 'available' | 'unavailable';
  queue: { pending: number; running: number };
}

export function health(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health');
}
