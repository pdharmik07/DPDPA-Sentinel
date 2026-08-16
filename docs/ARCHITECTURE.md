# Architecture

## Services

| Service | Stack | Port | Required |
|---|---|---|---|
| Frontend | React 18, TypeScript, Vite 6, Tailwind v4, Framer Motion, Recharts | 5173 | yes |
| Backend | Node 20+, Express 5, TypeScript (NodeNext, strict) | 4000 | yes |
| Database | PostgreSQL 16 + Prisma 6 | 5432 | yes |
| NLP | Python 3.11+, FastAPI, spaCy, sentence-transformers | 8000 | **no** |

## Analysis flow

```
POST /api/scans (multipart)
  → magic-byte validation → extraction (pdfjs / mammoth / utf8)
  → prepareDocument (normalise, paragraphs, sentences)
  → persist scan, return 202 QUEUED
  → in-process queue picks it up
      → stage ANALYZING        : NLP service (optional, advisory)
      → stage EVALUATING_RULES : applicability + detection + status per rule
      → stage SCORING          : category scores → weighted overall → risk → recommendations
      → persist findings + score + risk in one transaction
  → status COMPLETED
Frontend polls /api/scans/:id/status to drive the seven-step progress display.
```

## Key decisions

**Each service owns its own package.** The frontend lives in `frontend/`, the backend in
`backend/`, the NLP service in `nlp-service/`. The root `package.json` holds no dependencies — only
delegating scripts (`npm run dev:backend`, `npm run build`, `npm test`), so the three services install
and version independently. The move was done with `git mv`, so file history is preserved.

`vercel.json` pins `installCommand`, `buildCommand` and `outputDirectory` to `frontend/`, which keeps
the existing deployment working without changing the project's Vercel settings.

**An adapter preserves the existing UI.** `frontend/src/lib/api/adapt.ts` maps backend responses onto the
frontend's original `ScanResult` shape, so `Results.tsx`, `charts.tsx`, `ScoreMeter.tsx` and the
report views required no changes at all. Every value it produces comes from the backend.

**The engine is pure.** Everything in `backend/src/engine/` is a pure function — no database, no
filesystem, no network. That is what makes the assessment deterministic and lets the whole engine
be unit-tested without infrastructure.

**The frontend carries no engine.** When analysis moved server-side, the browser copies of the rule
ontology, the analyzer, the document parsers (pdf.js, mammoth) and the client PDF exporter (jsPDF)
became dead weight — and worse, a second source of truth that had already drifted (the UI still
claimed "26 clause categories" after the rule set grew to 41). They were deleted, along with the
demo-data seeder. Headline figures now come from `GET /api/framework`, so the UI cannot go stale
against the rule pack. Bundle: 2,650 kB → 864 kB.

Retained in the browser: `concepts.ts` + `conceptScan.ts` (the privacy-concept panel, computed from
the extracted text the backend returns) and `text.ts` (sentence splitting for that panel).

**In-process queue, not a broker.** Analysis takes a few hundred milliseconds. What is actually
needed is: don't block the HTTP response, bound concurrency, let the client poll. Redis/BullMQ
would be over-engineering here. Trade-off: jobs live in memory, so a restart loses in-flight work —
`recoverStuckScans()` sweeps those to FAILED at boot so nothing hangs in the UI.

**NLP is structurally advisory.** The service's response model has no status field, and
`decideStatus` gates PASS on deterministic structure. Neither can be bypassed by configuration.

## Database

`User → Scan → { Finding[], Report[], ScanScore, RiskAssessment }`, plus a standalone `Rule` table
seeded from the rule pack. `Finding.ruleId` references `Rule.ruleId` with `onDelete: Restrict`, so a
rule that has been used in a historical assessment cannot be deleted out from under it.

`ScanScore` and `RiskAssessment` are separate tables rather than columns on `Scan` because both
store the *reasoning* — `categoryScores` and the full risk `factors` array — not just the outcome.

`Scan.extractedText` is the one privacy-sensitive column; it is retained because evidence must be
re-renderable when a stored report is reopened. It is excluded from list responses and from logs.
