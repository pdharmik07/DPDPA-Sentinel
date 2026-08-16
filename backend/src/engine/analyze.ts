/**
 * Analysis orchestrator.
 *
 * Pure function: given extracted text and an (optional) NLP analysis, produce
 * the complete assessment. No database, no filesystem, no network — which is
 * what lets the whole engine be unit-tested and asserted for determinism.
 */

import { buildRecommendations } from './recommendation.js';
import { assessRisk } from './risk.js';
import { evaluateAll } from './ruleEngine.js';
import { loadRulePack, DEFAULT_PACK } from './rulePack.js';
import { scoreFindings } from './scoring.js';
import { prepareDocument } from './text.js';
import type { AnalysisResult, NlpAnalysis, PreparedDocument } from './types.js';

export const EMPTY_NLP: NlpAnalysis = { available: false, model: null, byRule: {} };

export interface AnalyzeOptions {
  rulePackVersion?: string;
  nlp?: NlpAnalysis;
}

export function analyzeText(rawText: string, options: AnalyzeOptions = {}): AnalysisResult {
  const doc = prepareDocument(rawText);
  return analyzeDocument(doc, options);
}

export function analyzeDocument(doc: PreparedDocument, options: AnalyzeOptions = {}): AnalysisResult {
  const pack = loadRulePack(options.rulePackVersion ?? DEFAULT_PACK);
  const nlp = options.nlp ?? EMPTY_NLP;

  const findings = evaluateAll(pack.rules, doc, nlp);
  const score = scoreFindings(findings, pack.manifest.categories);
  const risk = assessRisk(findings, score);
  const recommendations = buildRecommendations(findings);

  return {
    findings,
    score,
    risk,
    recommendations,
    document: {
      words: doc.words,
      characters: doc.characters,
      sentences: doc.sentences.length,
      paragraphs: doc.paragraphs.length,
      sections: doc.sections.length,
    },
    ruleVersion: pack.manifest.ruleVersion,
    legalVersion: pack.manifest.legalVersion,
    nlpAvailable: nlp.available,
  };
}
