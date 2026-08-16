# DPDPA Sentinel

**Automated preliminary DPDPA compliance assessment platform** — Minor Project `CSE_CS_32`, B.Tech CSE (Cyber Security), Silver Oak University. Guide: Mr. Sunny Mesuriya.

Upload a privacy policy. The platform extracts its text, detects clauses, evaluates them against a versioned rule set derived from the **DPDP Act 2023** and the **DPDP Rules 2025**, and produces a weighted score, a risk assessment, source-linked evidence and prioritised remediation guidance.

> This tool provides an automated preliminary assessment based on configured DPDPA 2023 and DPDP Rules 2025 requirements. It is **not a legal opinion, certification or substitute for review by a qualified legal/privacy professional.**

---

## Architecture

```
React + TypeScript + Vite  (frontend/)
            │  HTTPS REST
            ▼
Node.js + Express + TypeScript  (backend/)
     ├── PostgreSQL + Prisma
     ├── Deterministic rule engine  (backend/src/engine)
     └── Python NLP service  (nlp-service/)  ← advisory only, optional
```

The analysis chain is: **extract → preprocess → NLP (advisory) → applicability → rule engine → scoring → risk → recommendations → report**. All of it runs server-side.

The frontend is a thin client: it validates the upload (size/extension) for immediate feedback, then uploads, polls status and renders results. It carries no rule set, no analysis engine and no document parsers — removing those cut the bundle from **2,650 kB to 864 kB** (gzip 372 → 251 kB).

**The NLP service never decides compliance.** Its response type has no status field. Semantic similarity feeds `confidence` only; a `PASS` additionally requires a non-negated anchor match *and* at least half of a rule's specific sub-elements. If the NLP service is down, scans still succeed on the deterministic engine and are flagged `nlpAvailable: false`.

---

## Quick start

> Commands are listed one per block so they work in **Windows PowerShell** (which has no `&&`),
> cmd and POSIX shells alike. Run them in order.

```bash
npm run install:all
```

Then start everything with one command, from the project root:

```bash
npm run dev
```

There is no separate configuration step: `npm run dev` creates `backend/.env` and
`frontend/.env.local` from their examples and generates a `JWT_SECRET` if one is missing. It never
overwrites a file that already exists, so re-running it is always safe. To do just that part,
`npm run setup`.

That single command starts **the database, the backend API and the frontend** together, waits for
the API and then prints the URL. Leave it running and open <http://localhost:5173>. Ctrl+C stops all
three.

The frontend on its own cannot do anything — every screen (register, login, upload, results) is an
API call, so a frontend without a backend only ever shows *"Cannot reach the DPDPA Sentinel
backend"*. That is why `npm run dev` starts the whole stack rather than just Vite.

> **Use the local URL, not the deployed one.** A hosted build (Vercel and the like) cannot talk to a
> backend running on your machine — `localhost` there means the *visitor's* computer, and browsers
> block an HTTPS page from calling `http://localhost` outright. To make the public URL work for
> anyone, the backend has to be hosted too: `render.yaml` at the repository root deploys the API and
> its database in one step, and
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#making-the-public-url-work-vercel--render) has the
> click-by-click guide.

The database is an **embedded PostgreSQL** on port **55432** — no Docker, no admin rights, no global
install. Its data lives in `backend/.pgdata` and persists between runs; migrations and the rule-pack
seed are applied automatically on every start. Because the harness sets `DATABASE_URL` for the
processes it wraps, the `DATABASE_URL` in `backend/.env` is not used on this path.

The first start takes a minute or two while PostgreSQL initialises. Later starts take seconds.

### Running the parts separately

Useful when debugging one half, or when you prefer Docker for the database.

| Command (project root) | What it runs |
| --- | --- |
| `npm run dev` | database + backend + frontend (the normal one) |
| `npm run db:local` | embedded PostgreSQL + backend API only |
| `npm run dev:frontend` | frontend only |
| `npm run dev:backend` | backend only, against the `DATABASE_URL` in `backend/.env` |
| `npm run db:up` / `db:down` | PostgreSQL 16 in Docker, on the standard port 5432 |

With Docker as the database, migrate and seed once, then run the backend against it:

```bash
npm run db:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev:backend
```

### Optional NLP service

The first run downloads ~90 MB of models. The backend works without it and flags scans
`nlpAvailable: false`.

```bash
cd nlp-service
```

```bash
python -m venv .venv
```

**Activate it before installing** — PowerShell: `.venv\Scripts\Activate.ps1` · bash:
`source .venv/Scripts/activate`. If pip says "Defaulting to user installation", it is not active and
the packages will go to your global Python. Full walkthrough: [docs/RUNNING.md](docs/RUNNING.md).

```bash
pip install -r requirements.txt
```

```bash
python -m spacy download en_core_web_sm
```

```bash
uvicorn app.main:app --port 8000
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000/api/health |
| NLP | http://localhost:8000/health |

---

## Commands

`npm run dev` from the repository root is the everyday command — it starts the database, the backend
and the frontend together. The rest are for working on one piece at a time.

| | Frontend (`frontend/`) | Backend (`backend/`) |
|---|---|---|
| dev | `npm run dev` | `npm run dev` |
| build | `npm run build` | `npm run build` |
| typecheck | `npm run typecheck` | `npm run typecheck` |
| test | — | `npm test` |

From the repository root: `npm run dev` · `npm run dev:frontend` · `npm run dev:backend` · `npm run db:local` · `npm run build` · `npm test` · `npm run typecheck` · `npm run db:up` · `npm run db:migrate` · `npm run db:seed`

Inside `backend/`: `npx prisma migrate dev` · `npm run db:reset` · `npx prisma studio`

Engine smoke run over the sample policies, no DB required:

```bash
cd backend
```

```bash
npx tsx scripts/smoke.ts
```

---

## The rule set

`backend/rules/dpdpa-v1.0.0/` holds **41 rules across 16 categories** as versioned JSON — the **37 rules across 15 categories** specified by the supplied *DPDPA Sentinel Rule Engine Design Document*, plus **4 supplementary Act-grounded rules** (`AX1`–`AX4`) carried over from the original frontend ontology so no prior coverage was lost.

Rules are data, not code. Adding or amending one is a JSON change plus a re-seed; no engine module contains rule-specific logic. Detection regex was ported mechanically from the original `frontend/src/lib/dpdpa/requirements.part{1,2,3}.ts`, and each payload records its origin in `detection.portedFrom`.

Full detail, including the scoring formula and the legal-citation audit: **[docs/RULE_ENGINE.md](docs/RULE_ENGINE.md)**.

### Scoring

Exactly as specified in section 5 of the design document:

| Weight class | PASS | PARTIAL | FAIL | N/A |
|---|---|---|---|---|
| Mandatory | 3 | **1** | 0 | — |
| Conditional | 2 | 1 | 0 | excluded |
| Recommended | 1 | 0.5 | 0 | — |

```
category score = (points earned / max points for APPLICABLE rules in category) × 100
overall score  = weighted average of category scores
```

Note this differs from the original browser engine, which credited a partial mandatory rule at 1.5 and used a single global ratio. The design document is the specified source of truth.

### Commencement dates matter

The DPDP Rules 2025 (G.S.R. 846(E), notified 13 Nov 2025) commence in **three tranches** under Rule 1(2)–(4):

| Rules | In force from |
|---|---|
| 1, 2, 17–21 | 13 Nov 2025 |
| 4 (Consent Manager registration) | 13 Nov 2026 |
| **3, 5–16, 22, 23** | **13 May 2027** |

Almost every operative compliance rule sits in the third tranche. Each rule therefore carries `effectiveFrom` / `effectiveNote`, and the Framework page and reports show whether a provision is in force, not yet in force, or unverified.

---

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | public |
| GET | `/api/auth/me` | bearer |
| POST | `/api/scans` (multipart, returns `202`) | bearer |
| GET | `/api/scans` · `/api/scans/:id` · `/api/scans/:id/status` | bearer |
| POST | `/api/scans/:id/analyze` | bearer |
| GET | `/api/scans/:id/findings` · `/api/scans/:id/score` | bearer |
| DELETE | `/api/scans/:id` | bearer |
| GET | `/api/scans/:id/report` · `/report/json` · `/report/pdf` | bearer |
| GET | `/api/rules` · `/api/rules/:id` · `/api/framework` | public reference data |
| GET | `/api/health` | public |

Analysis is asynchronous: `POST /api/scans` returns `202` and the frontend polls `/status`, which drives the seven-step progress display from the server's real pipeline stage.

---

## Security

- Argon2id password hashing (`@node-rs/argon2`), JWT bearer auth, uniform login failures with timing equalisation so the endpoint cannot enumerate accounts
- **IDOR prevention**: every scan-scoped operation goes through `assertScanOwned(scanId, userId)`; there is no code path that reads a scan by id alone. Someone else's scan returns `404`, not `403`
- Helmet, strict CORS allowlist, global + per-route rate limits (tighter on auth and upload)
- Uploads: size cap, extension + MIME check, **magic-byte content sniffing**, random stored filenames, path-traversal containment (`resolveWithin`), nothing ever executed
- Zod validation on every body/param/query; Prisma parameterises all SQL
- Errors: `AppError` is user-safe; everything else returns a generic message plus a request id. Stack traces never leave the server
- Structured logging with a redact list covering passwords, tokens, authorization headers, extracted policy text and evidence

Secrets come from environment variables only. `backend/.env.example` and `frontend/.env.example` document every key; real `.env` files are gitignored.

---

## Testing

All 64 backend tests:

```bash
npm test
```

Engine only, no database needed (37 tests):

```bash
npm run test:engine
```

API only, against a real PostgreSQL (27 tests):

```bash
npm run test:api
```

**64 backend tests.** The engine suite covers rule-pack integrity, the scoring model, applicability exclusion, negation and hedging, the "semantic similarity can never produce a PASS" invariant, risk-factor auditability, recommendation priority ordering, output determinism and upload path-traversal hardening. The API suite covers the full user journey, upload validation, error shape, and the authorization boundary (every scan-scoped route returns 404 for a non-owner).

The API suite spins up a real PostgreSQL server via `embedded-postgres`, so it runs anywhere without Docker.

**Full-stack verification over real HTTP** — boots the actual server, binds a port and walks the whole journey with `fetch`:

```bash
cd backend
```

```bash
npx tsx scripts/verifyStack.ts
```

**NLP service — 7 tests:**

```bash
cd nlp-service
```

```bash
.venv/Scripts/python -m pytest tests -q
```

These deliberately run without spaCy/sentence-transformers installed, pinning down what happens when the models are absent: the service returns 503 rather than faking scores, and a structural test fails if anyone ever adds a verdict-like field to its response model.

Test corpus: `samples/` (strong fintech, weak startup, medium edtech, healthcare, SaaS) plus `backend/tests/fixtures/` (children's service, e-commerce, international/SDF).

Current engine calibration on the corpus:

| Policy | Score | Risk |
|---|---|---|
| Strong fintech | 94.9 | LOW |
| Medium edtech | 35.7 | CRITICAL |
| Weak startup | 7.3 | CRITICAL |

---

## Layout

```
├── frontend/             React app (pages, components, store, lib/api)
├── backend/
│   ├── src/engine/       deterministic rule engine (pure, no I/O)
│   ├── src/services/     extraction, NLP client, scans, reports, queue
│   ├── src/controllers/  ├── src/routes/  ├── src/middleware/
│   ├── rules/            versioned rule pack JSON
│   ├── prisma/           schema + seed
│   └── tests/
├── nlp-service/          FastAPI + spaCy + sentence-transformers
├── legal/                DPDP Act 2023, DPDP Rules 2025 (source PDFs)
├── docs/                 architecture, rule engine, API, deployment
└── samples/              example policies
```

## Documentation

- [docs/RUNNING.md](docs/RUNNING.md) — step-by-step local setup, first scan, and troubleshooting
- [docs/RULE_ENGINE.md](docs/RULE_ENGINE.md) — rule model, scoring, applicability, legal citation audit
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — services, data flow, database, decisions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — environment variables and deployment
