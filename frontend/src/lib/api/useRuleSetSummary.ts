import { useEffect, useState } from 'react';
import * as api from './endpoints';

export interface RuleSetSummary {
  ruleCount: number;
  categoryCount: number;
  mandatory: number;
  conditional: number;
  recommended: number;
  ruleVersion: string;
  legalVersion: string;
}

/**
 * Rule-set headline figures, fetched from the backend.
 *
 * The counts used to be imported from a hard-coded local ontology, which meant
 * the UI quietly kept claiming "26 clause categories" after the authoritative
 * rule set moved server-side and grew to 41. Reading them from
 * GET /api/framework keeps every surface honest and in step with the rule pack.
 *
 * Returns null while loading or if the backend is unreachable; callers render a
 * placeholder rather than a wrong number.
 */
export function useRuleSetSummary(): RuleSetSummary | null {
  const [summary, setSummary] = useState<RuleSetSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getFramework()
      .then((framework) => {
        if (cancelled) return;
        setSummary({
          ruleCount: framework.totals.rules ?? 0,
          categoryCount: framework.categories.length,
          mandatory: framework.totals.mandatory ?? 0,
          conditional: framework.totals.conditional ?? 0,
          recommended: framework.totals.recommended ?? 0,
          ruleVersion: framework.ruleVersion,
          legalVersion: framework.legalVersion,
        });
      })
      .catch(() => {
        // Reference data is non-critical; the page still renders without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return summary;
}
