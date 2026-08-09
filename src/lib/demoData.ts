import { CATEGORIES } from './dpdpa/categories';
import type { CategoryScore, RiskLevel, ScanHistoryEntry } from './dpdpa/types';

/**
 * Seeds the analytics dashboard with prior scans so trend charts are meaningful
 * on a fresh install. Every seeded row carries `demo: true` and is labelled as
 * sample data in the UI; real scans are always appended above them.
 */
const SEED_FILES: { name: string; score: number; risk: RiskLevel }[] = [
  { name: 'Fintech-App-Privacy-Policy.pdf', score: 88, risk: 'low' },
  { name: 'EdTech-Portal-Privacy-Notice.pdf', score: 74, risk: 'medium' },
  { name: 'HealthCare-Clinic-Policy.docx', score: 46, risk: 'high' },
  { name: 'Ecommerce-Store-Privacy.pdf', score: 81, risk: 'medium' },
  { name: 'Logistics-Partner-Notice.txt', score: 39, risk: 'critical' },
  { name: 'SaaS-CRM-Privacy-Policy.pdf', score: 92, risk: 'low' },
  { name: 'Food-Delivery-App-Policy.pdf', score: 67, risk: 'medium' },
  { name: 'Gaming-Platform-Privacy.docx', score: 52, risk: 'high' },
  { name: 'Banking-Portal-Notice.pdf', score: 85, risk: 'low' },
  { name: 'Travel-Booking-Privacy.pdf', score: 71, risk: 'medium' },
  { name: 'Social-App-Privacy-Policy.pdf', score: 58, risk: 'high' },
  { name: 'Insurance-Aggregator-Notice.docx', score: 79, risk: 'medium' },
];

function seededCategories(score: number, salt: number): CategoryScore[] {
  return CATEGORIES.map((category, i) => {
    // Deterministic spread around the overall score so charts differ per row.
    const wobble = ((salt * 7 + i * 13) % 25) - 12;
    const value = Math.max(0, Math.min(100, score + wobble));
    return {
      id: category.id,
      label: category.label,
      score: value,
      earned: value,
      possible: 100,
      requirements: 3,
    };
  });
}

export function buildDemoHistory(): ScanHistoryEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return SEED_FILES.map((file, index) => {
    const score = file.score;
    const compliant = Math.round((score / 100) * 20);
    const partial = Math.max(0, Math.round((100 - score) / 22));
    const notDetected = Math.max(0, 24 - compliant - partial);

    return {
      id: `DEMO-${(index + 1).toString().padStart(3, '0')}`,
      createdAt: new Date(now - (index + 1) * day * 3 - index * 5_000_000).toISOString(),
      fileName: file.name,
      fileSize: 180_000 + index * 41_000,
      pages: 6 + ((index * 3) % 14),
      words: 2400 + index * 430,
      score,
      riskLevel: file.risk,
      verdict:
        score >= 85
          ? 'COMPLIANT'
          : score >= 60
            ? 'PARTIALLY COMPLIANT'
            : score >= 35
              ? 'NON-COMPLIANT'
              : 'CRITICALLY NON-COMPLIANT',
      durationMs: 2100 + index * 180,
      categories: seededCategories(score, index + 1),
      totals: {
        checked: 24,
        compliant,
        partial,
        nonCompliant: Math.max(0, Math.round(notDetected / 3)),
        notDetected,
        notApplicable: 2,
        earnedWeight: score,
        applicableWeight: 100,
      },
      demo: true,
    };
  });
}
