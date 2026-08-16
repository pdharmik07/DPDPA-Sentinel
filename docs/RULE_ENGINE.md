# Rule Engine

## Sources and precedence

1. DPDP Act 2023 (`legal/DPDPA_2023_official.pdf`)
2. DPDP Rules 2025 (`legal/DPDP_Rules_2025_English.pdf`)
3. DPDPA Sentinel Rule Engine Design Document (`docs/DPDPA_Rule_Engine_Design_Document.docx`)
4. The pre-existing frontend requirement ontology
5. https://www.dpdpa.com/

Nothing in the rule pack is invented. Where a field could not be established from these sources it is either `null` or explicitly marked **"Requires verification."**

## Rule set composition

**41 rules across 16 categories.**

- **37 rules / 15 categories** — exactly the set enumerated in section 4 of the design document (`N1`–`N5`, `C1`–`C5`, `K1`–`K3`, `G1`–`G2`, `Q1`, `S1`–`S2`, `B1`–`B2`, `R1`–`R3`, `GR1`–`GR2`, `D1`, `A1`–`A3`, `NM1`, `X1`–`X2`, `SDF1`–`SDF3`, `BC1`–`BC2`).
- **4 supplementary rules** — `AX1`–`AX4`, Act-grounded obligations the design document does not enumerate but which the original frontend ontology covered. Kept so the migration lost no coverage; grouped in category `additional` and identifiable as such.

Rules live as versioned JSON in `backend/rules/dpdpa-v1.0.0/`:

- `rules.json` — the rule definitions
- `manifest.json` — pack metadata, category weights, totals, provenance

Detection regex was **ported mechanically** from `frontend/src/lib/dpdpa/requirements.part{1,2,3}.ts` rather than retyped, and each detection payload records `portedFrom` naming its source requirement.

## Rule fields

| Field | Notes |
|---|---|
| `ruleId`, `category`, `categoryLabel`, `title` | identity |
| `description`, `requirement` | what the law says / what the policy must contain |
| `sourceType` | `ACT` · `RULES_2025` · `PROJECT_SPECIFIC` · `BEST_PRACTICE` |
| `actSection`, `ruleReference`, `scheduleReference` | citations; `null` when not established |
| `ruleVersion`, `legalVersion`, `effectiveFrom`, `effectiveTo`, `effectiveNote` | versioning |
| `weightClass`, `weight`, `severity`, `applicability` | evaluation |
| `detection` | anchors, supporting, specifics, applicabilityTriggers, negativeIndicators, semanticConcepts |
| `recommendation`, `remediation`, `suggestedLanguage` | output |

`sourceType` is a database enum, which is how the system structurally prevents a recommended practice from being rendered as a statutory requirement. A test asserts that no `PROJECT_SPECIFIC` or `BEST_PRACTICE` rule carries an Act section.

## Evaluation order

```
1. Applicability   → NOT_APPLICABLE short-circuits, excluded from scoring entirely
2. Detection       → anchors / supporting / specifics over a ±1/+2 sentence context window
3. NLP enrichment  → semantic similarity raises confidence only (capped at +0.12)
4. Negation gate   → a denied obligation cannot pass, whatever the similarity
5. Status          → PASS | PARTIAL | FAIL
6. Evidence        → the sentences that justify the decision
```

### The central invariant

`PASS` requires **all** of: confidence ≥ 0.7, at least one **non-negated anchor** match, and specificRatio ≥ 0.5. Semantic similarity only ever feeds `confidence`. A maximum-strength similarity signal on a document with no real clauses produces zero passes — asserted directly in the test suite.

### Negation

A cue list detects denials, with a carve-out for *positive prohibitions*: "we do not sell your data", "we do not undertake any tracking of children", "we do not bundle unrelated purposes" are the **strongest** possible clauses for prohibition-shaped rules and must not be read as denials. An under-inclusive verb list here caused the engine to fail exactly the best-drafted policies during development.

Hedging distinguishes the fiduciary's discretion ("we may retain") from a right granted to the user ("you may withdraw") — only the former caps credit.

### Self-contradiction

A policy that both grants and denies the same obligation in anchor sentences is capped at `PARTIAL`, never `PASS`. Ambiguity is flagged for human review rather than resolved in the organisation's favour.

### Negative indicators

Rule-specific violation patterns (e.g. pre-ticked boxes for `C2`) force a `FAIL`. They are checked for *negative polarity in the 60 characters preceding the match*, so "Nothing is pre-selected" is correctly read as a commitment rather than an admission.

## Applicability

- `ALWAYS` — always evaluated.
- `CONDITIONAL` — evaluated only when the document triggers it. Ambiguous categories (`cross_border`, `children`, `sdf`) require **two** independent signals, so a single stray "global" or "parent" cannot switch on a whole category.
- `REQUIRES_LIVE_SCAN` — `BC1`/`BC2` only. Always `NOT_APPLICABLE` in the document-upload workflow, with the reason stated. See *Known limitations*.

`NOT_APPLICABLE` rules are excluded from **both** numerator and denominator, and a category in which nothing applies is dropped from the overall average entirely.

## Scoring

Point table taken verbatim from section 5 of the design document:

| Weight class | PASS | PARTIAL | FAIL | N/A |
|---|---|---|---|---|
| Mandatory | 3 | **1** | 0 | — |
| Conditional | 2 | 1 | 0 | excluded |
| Recommended | 1 | 0.5 | 0 | — |

```
category score = (points earned in category / max points for APPLICABLE rules in category) × 100
overall score  = Σ(category score × category weight) / Σ(category weight)
```

### Derived category weights — *Requires verification*

The design document states mandatory categories must count for more than recommended ones, but **does not give explicit category weights**. This implementation derives each category's weight as the **sum of the weights of its applicable member rules** (mandatory 3, conditional 2, recommended 1) — the only non-arbitrary reading of the requirement. This derivation is flagged in `manifest.json` and in the `/api/framework` response. If the project owner supplies explicit weights, only `scoring.ts` changes.

### Divergence from the previous browser engine

| | Design document (implemented) | Previous frontend engine |
|---|---|---|
| Mandatory PARTIAL | **1 point** | 1.5 (half of 3) |
| Overall formula | weighted average of category scores | single global weighted ratio |

The design document is the specified source of truth for scoring, so scores differ from the pre-migration app. `ScanScore.scoringModel` records `design-doc-1.0` so historical results stay interpretable.

### Verdicts

`STRONG ALIGNMENT` ≥ 85 · `PARTIAL ALIGNMENT` ≥ 60 · `SIGNIFICANT GAPS` ≥ 35 · `CRITICAL GAPS` below.

The word "compliant" was deliberately removed from verdict wording — the tool must never assert that an organisation is legally compliant. A test enforces this.

## Risk

Risk is **not** a function of the score alone. Thirteen weighted factors are evaluated (score bands, mandatory failure count, critical-severity failures, and per-category failures for security, breach, children, SDF, consent, rights, grievance), summed, and mapped to a level. Hard floors apply: a failed children's-data, breach-notification or security-safeguards obligation forces at least `HIGH` regardless of the score elsewhere.

Every factor is persisted with its trigger state, detail and weight, so an assigned level can be audited rather than merely asserted.

## Commencement / versioning

DPDP Rules 2025 (G.S.R. 846(E), notified 13 Nov 2025), Rule 1(2)–(4):

| Tranche | Rules | In force from |
|---|---|---|
| On publication | 1, 2, 17–21 | 2025-11-13 |
| +1 year | 4 | **2026-11-13** |
| +18 months | 3, 5–16, 22, 23 | **2027-05-13** |

`effectiveFrom` records **the date from which the cited requirement, as detailed by the DPDP Rules 2025, is in force.** It is keyed off the rule's `ruleReference`, not off `sourceType`: almost every rule in the pack is sourced from the Act (which creates the duty) while the Rules supply the operative detail, so keying it off `sourceType === 'RULES_2025'` left the field null on all 41 rules and made the Framework page's commencement counters read `0 / 0 / 41`.

Current distribution: **27 rules → 2027-05-13**, **1 rule → 2026-11-13** (`C5`, Consent Manager registration under Rule 4), **13 rules → `null`**.

The 13 nulls are rules with no Rules-2025 provision cited. For those, **the Act's own commencement under section 1(2) is by Government notification and the supplied sources do not establish the notified date** — marked *"Requires verification."* in `effectiveNote`. Supply the commencement notification and those become real dates too.

## Legal citation audit

Every citation in both supplied sources was checked line-by-line against the Act and Rules PDFs.

**Verified correct:** s.5(1)(i)–(iii) · s.6(1) · s.6(4)–(9) · s.7 · s.8(2) · s.8(3) · s.8(4) · s.8(5) · s.8(6) · s.8(7)–(8) · s.8(9) · s.8(10) · s.9(1) · s.9(3) · s.10 · s.11 · s.12(1)–(3) · s.13 · s.14 · s.15 · s.16 · Rules 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15 and the First/Third/Fourth/Seventh Schedules.

**Corrections applied** (recorded in `manifest.json` under `provenance.citationCorrections`):

| Rule | Issue | Correction |
|---|---|---|
| `N5` | The design document cites *"Sec 5(3), DPDP Rule 5"*. Rule 5 governs **State processing for subsidies and benefits** and is unrelated to notice language. | Plain-language duty is **Rule 3(b)**; s.5(3) carries the Eighth Schedule language option and s.6(3) the plain-language duty for consent requests. |
| `D1` | The frontend ontology cited *"Sections 2(i), 5, 13"*. s.2(i) is a **definition**, not an obligation. | **s.8(9) read with Rule 9.** |
| `AX2` | The frontend ontology coded general data sharing as `DPDPA-8.2`. s.8(2) governs **engaging a Data Processor under a valid contract**. | Disclosure duty is **s.11(1)(b)**; s.8(2) retained separately as `AX1`. |

**Flagged, not corrected:**

- `C3` — the design document cites *"Sec 6(1)(a)"*. Section 6(1) in the supplied Act text is **not sub-divided into clauses**; the anti-bundling duty rests on the "limited to such personal data as is necessary for such specified purpose" wording of s.6(1). Marked *Requires verification*.
- `X2` — the supplied sources contain **no list of restricted territories** under s.16. The specific country list is marked *Requires verification*.

## Known limitations

- **`BC1`/`BC2` (Cookie & Tracker Cross-Check) are never evaluated.** They require a live website behaviour scan, which the document-upload workflow does not perform. They are seeded, shown on the Framework page, and returned as `NOT_APPLICABLE` with a stated reason — a declared gap rather than a silent one. Implementing them needs a headless-browser scanner and a URL input, neither of which is in the current architecture.
- Detection is pattern- and structure-based. Absence of evidence in a document is not proof that a control does not exist in the organisation, and reports say so.
- Rule `C3` and `X2` citations require verification as noted above.
- The Act's commencement dates require verification.
