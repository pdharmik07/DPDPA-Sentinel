# Running DPDPA Sentinel locally

A step-by-step guide from a fresh clone to a working scan in the browser.

Commands are given **one per block** so they work in Windows PowerShell (which has no `&&`), cmd and
POSIX shells alike.

---

## 0. Prerequisites

| Need | Version | Check with |
|---|---|---|
| Node.js | 20 or newer | `node -v` |
| npm | 10 or newer | `npm -v` |
| Python *(optional — NLP only)* | 3.11+ | `python --version` |

PostgreSQL is **not** required as a separate install — see step 3.

---

## 1. Install dependencies

From the repository root:

```bash
npm run install:all
```

This installs `frontend/` and `backend/` (about 500 packages, one to two minutes).

---

## 2. Configure the backend

```bash
cd backend
```

```bash
cp .env.example .env
```

> PowerShell users: `cp` is an alias for `Copy-Item`, so this works as-is.

Generate a JWT signing secret:

```bash
openssl rand -base64 48
```

Open `backend/.env` and paste the output as `JWT_SECRET`. **The server refuses to start without a
secret of at least 32 characters** — that is deliberate, so a misconfigured deployment fails loudly
rather than silently signing tokens with a weak key.

Nothing else in `.env` needs changing for local development.

---

## 3. Start PostgreSQL

Pick **one** path.

### Path A — no Docker (recommended on Windows)

The backend ships an embedded PostgreSQL that needs no Docker and no admin rights. It runs on port
**55432** and supplies its own `DATABASE_URL`, so it ignores the one in `.env`.

Create the schema and load the 41-rule pack (once):

```bash
npm run db:local:setup
```

Expect:

```
All migrations have been successfully applied.
Seeding rule pack dpdpa-sentinel-core v1.0.0 — 41 rules
  created 41, updated 0
```

### Path B — Docker

```bash
docker compose up -d
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

> Docker Desktop on Windows Home requires WSL2. If `docker info` errors, use Path A.

---

## 4. Start the backend

**Path A:**

```bash
npm run db:local
```

This starts PostgreSQL *and* the API together. Leave it running.

**Path B:**

```bash
npm run dev
```

Either way you should see:

```
INFO: rule pack loaded  rules: 41
INFO: database connection ok
INFO: DPDPA Sentinel backend listening  port: 4000
```

Confirm in a browser or another terminal — <http://localhost:4000/api/health>:

```json
{ "status": "ok", "database": "up", "databaseLatencyMs": 39, "rules": 41, "nlp": "unavailable" }
```

`"nlp": "unavailable"` is expected unless you did step 7. Scans still run.

---

## 5. Start the frontend

Open a **second terminal**. From the repository root:

```bash
cd frontend
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Vite prints the URL — normally <http://localhost:5173>.

> If 5173 is taken, Vite falls back to 5174. That origin is already in the backend's CORS allowlist,
> but any other port will be blocked. Free 5173 or add the port to `FRONTEND_URL` in `backend/.env`
> and restart the backend.

---

## 6. Run a scan

1. Open <http://localhost:5173>. You will land on **Secure Sign-In**.
2. Click **Create one** and register. The password must be at least 10 characters.
3. You arrive at the **Dashboard** (empty on a new account — that is correct, there is no sample data).
4. Go to **Compliance Scan**.
5. Either drop in a policy, or click **Load sample policy** for a built-in one. `samples/` also holds
   five real policies covering the range:

   | File | Score | Risk |
   |---|---|---|
   | `01-strong-fintech-policy.txt` | ~95 | LOW |
   | `03-medium-edtech-policy.md` | ~36 | CRITICAL |
   | `02-weak-startup-notice.txt` | ~7 | CRITICAL |

6. Click **Start Analysis** and watch the seven stages advance — these track the server's real
   pipeline stage, not a timer.
7. Read the results: overall score, risk level with its contributing factors, per-category scores,
   and all 41 findings. Expand any finding for its **evidence sentences**, **legal basis** and
   whether that provision is in force yet.
8. **Reports** → download the assessment as **PDF** or **JSON**.

---

## 7. Optional — the NLP service

Entirely optional. Without it, scans use the deterministic rule engine and are flagged
`nlpAvailable: false`. With it, semantic similarity contributes to *confidence* only — it can never
decide a pass, partial or fail.

```bash
cd nlp-service
```

```bash
python -m venv .venv
```

**Now activate it.** This step is not optional and is the most common thing to miss:

```bash
.venv\Scripts\Activate.ps1
```

> PowerShell may refuse with *"running scripts is disabled on this system"*. Either allow it for your
> user with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use the .bat instead:
> `.venv\Scripts\activate.bat`. In bash/Git Bash: `source .venv/Scripts/activate`.

Confirm it worked — your prompt should now start with `(.venv)`, and this must print a path inside
`nlp-service\.venv`:

```bash
python -c "import sys; print(sys.prefix)"
```

**If `pip install` prints "Defaulting to user installation because normal site-packages is not
writeable", the venv is NOT active** — everything will land in your global Python and `uvicorn` will
not be on your PATH. Stop and activate first.

```bash
pip install -r requirements.txt
```

```bash
python -m spacy download en_core_web_sm
```

```bash
uvicorn app.main:app --port 8000
```

First run downloads roughly 90 MB of models, plus PyTorch, which is a further ~2 GB.

Verify at <http://localhost:8000/health>, and the backend's own health will flip to
`"nlp": "available"` on its next check.

Run the NLP tests (these pass with or without the models installed):

```bash
python -m pytest tests -q
```

---

## Stopping

`Ctrl+C` in each terminal. The database harness waits for PostgreSQL to release its port, so you can
immediately run `npm run db:local` again.

Your data persists in `backend/.pgdata`. You only need `db:local:setup` again after changing the
Prisma schema or the rule pack.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5.1. Run each command separately, as written above. |
| `Missing script: "db:local:setup"` | Run it from the repository root or from `backend/` — both work. |
| `port 55432 is still in use after 15s` | You already have `npm run db:local` running in another terminal. Switch to it and press Ctrl+C, then retry. This guard is what stops two servers fighting over one database. |
| `embedded postgres harness failed` | Delete `backend/.pgdata` and re-run `npm run db:local:setup`. |
| Health returns 503 `"database":"down"` | PostgreSQL is not running. Start step 3/4 again. |
| API calls fail with a CORS error | The frontend is on a port not in `FRONTEND_URL`. Add it in `backend/.env` and restart the backend. |
| `JWT_SECRET must be at least 32 characters` | Step 2 was skipped. |
| Blank page after sign-in | Hard-reload (`Ctrl+Shift+R`) to clear a stale bundle. |
| pip: `Defaulting to user installation` | The virtualenv is not activated. Activate it, then reinstall. |
| pip: `No matching distribution found for spacy` | An exact pin with no wheel for your Python. `requirements.txt` now uses ranges — pull the latest and retry. |
| `uvicorn: The term is not recognized` | Installed outside the venv, or the venv is not activated. |
| `No module named spacy` | Same cause — activate the venv before `python -m spacy download`. |
| PowerShell: `running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use `.venv\Scripts\activate.bat`. |

---

## Verifying the installation

All 64 backend tests (spins up its own throwaway PostgreSQL):

```bash
npm test
```

Engine only, no database required:

```bash
npm run test:engine
```

Typecheck everything and build the frontend:

```bash
npm run verify
```

Full stack over real HTTP — boots the server, registers, uploads, scores, downloads a PDF, checks
the authorization boundary, then tears everything down:

```bash
cd backend
```

```bash
npx tsx scripts/verifyStack.ts
```
