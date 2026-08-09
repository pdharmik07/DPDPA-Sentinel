# DPDPA Sentinel

**AI-Powered Privacy & DPDPA Compliance Analyzer** — Minor Project `CSE_CS_32`, B.Tech CSE (Cyber Security), Silver Oak University. Guide: Mr. Sunny Mesuriya.

Upload a privacy policy; the app extracts its text, detects privacy clauses, compares them against a 26-category DPDPA rule ontology, and produces a weighted compliance score with source-linked findings, risk ranking and remediation guidance.

**100% frontend — no backend, no database.** Files never leave the browser.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

`dist/index.html` also opens directly from the file system (uses hash routing and relative asset paths).

## Stack

React 18 · TypeScript · Vite 6 · Tailwind CSS v4 · Framer Motion · Recharts · Lucide · PDF.js · Mammoth.js · jsPDF

## Scoring

```
Score = (Σ weight[matched] / Σ weight[applicable]) × 100
```

- **Mandatory** clauses (consent, breach notification, security safeguards) — weight **3**
- **Conditional** clauses (children's data, cross-border transfer, Significant Data Fiduciary) — weight **2**
- **Recommended** best-practice clauses — weight **1**

Full match earns full weight, partial match earns half, missing or contradicted earns none. Conditional requirements that nothing in the document triggers are dropped from the denominator rather than scored as failures.

**Conservative bias:** negation cues (“we do not provide”) and fiduciary hedging (“we may”, “where feasible”) reduce confidence, so ambiguous clauses are flagged rather than passed. Note that `you may …` is treated as a granted right, not a hedge.

**Human in the loop:** every finding shows the matched source sentences so a reviewer can verify it.

## Pipeline

`01` Document Ingestion → `02` Text Extraction → `03` Preprocessing → `04` NLP Analysis → `05` DPDPA Rule Mapping → `06` Compliance Scoring → `07` Report Generation

## Layout

```
src/
  lib/dpdpa/     requirements ontology (26 categories), analyzer, extraction, text utils
  lib/           pipeline runner, scoring exports (PDF/JSON), storage, sample policy
  components/    UI primitives, layout, scan panels, charts
  pages/         Dashboard, Scan, Reports, Framework, About, Settings
  store/         app state + scan state machine
```

## Demo

On the Scan page use **Load sample policy** to run a full scan without a file. The sample scores ~51/100 with deliberate gaps (no breach clause, no grievance officer, no nomination right) so the findings are meaningful.

The dashboard seeds sample analytics on first run so charts are not empty; clear it from **Settings → Local Data**.

## Disclaimer

Automated preliminary assessment using rule-based clause matching and keyword/NLP analysis. Not a legal opinion; does not replace review by a qualified legal professional.
