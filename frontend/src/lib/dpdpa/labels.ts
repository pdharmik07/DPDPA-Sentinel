import type { ComplianceStatus } from './types';

export const STATUS_TEXT: Record<ComplianceStatus, string> = {
  compliant: 'COMPLIANT',
  partial: 'PARTIALLY COMPLIANT',
  non_compliant: 'NON-COMPLIANT',
  not_detected: 'NOT DETECTED',
  not_applicable: 'NOT APPLICABLE',
};
