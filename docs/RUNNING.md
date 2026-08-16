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

## 2. Configuration

None needed. `npm run dev` (step 3) creates `backend/.env` and `frontend/.env.local` from their
examples and generates a `JWT_SECRET` for you. It never overwrites a file that already exists.

To run only that step:

```bash
npm run setup
```

> Older instructions told you to `cp .env.example .env` and generate a secret with
> `openssl rand -base64 48`. Don't. `openssl` is not on a stock Windows install, and re-running the
> `cp` **wipes the secret you already had**, after which the backend refuses to start. `npm run setup`
> replaces both steps and is safe to run any number of times.

The generated `JWT_SECRET` is 48 random bytes from Node's CSPRNG. The server refuses to start on
anything under 32 characters — deliberate, so a misconfigured deployment fails loudly rather than
silently signing tokens with a weak key.

---

## 3. Start everything

From the repository root:

```bash
npm run dev
```

One command, one terminal. It starts **PostgreSQL, the backend API and the frontend** together,
waits for the API and then prints the URL:

```
[backend] postgres ready
[backend] INFO: rule pack loaded  rules: 41
[backend] INFO: database connection ok
[backend] INFO: DPDPA Sentinel backend listening  port: 4000
==> DPDPA Sentinel is ready: http://localhost:5173
```

Leave it running and open <http://localhost:5173>. Ctrl+C stops all three.

The first start takes a minute or two while PostgreSQL initialises its data directory; later starts
take seconds. Migrations and the 41-rule pack are applied automatically on every start, so there is
no separate setup step and no way to end up with an empty database.

The database is an **embedded PostgreSQL** on port **55432** — no Docker, no admin rights, no global
install. Its data lives in `backend/.pgdata` and persists between runs. Because the harness supplies
its own `DATABASE_URL` to the processes it wraps, the `DATABASE_URL` in `backend/.env` is unused on
this path.

Confirm the API separately if you want — <http://localhost:4000/api/health>:

```json
{ "status": "ok", "database": "up", "databaseLatencyMs": 39, "rules": 41, "nlp": "unavailable" }
```

`"nlp": "unavailable"` is expected unless you did step 5. Scans still run.

> If 5173 is taken, Vite falls back to 5174. That origin is already in the backend's CORS allowlist,
> but any other port will be blocked. Free 5173 or add the port to `FRONTEND_URL` in `backend/.env`
> and restart.

### Running the pieces separately

Only needed when working on one half, or when you prefer Docker for the database. Each is a separate
terminal.

| Command (repository root) | Starts |
|---|---|
| `npm run db:local` | embedded PostgreSQL + backend API |
| `npm run dev:frontend` | frontend only |
| `npm run dev:backend` | backend only, against `DATABASE_URL` in `backend/.env` |

With Docker as the database instead — Docker Desktop on Windows Home requires WSL2, so if
`docker info` errors use the default path above:

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

---

## 4. Run a scan

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

## 5. Optional — the NLP service

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

**Cold start.** The first `/analyze` call loads the models from disk and took ~44 seconds when
measured. `NLP_TIMEOUT_MS` is 45s to absorb that, but the cleanest fix is to load them at startup —
copy `nlp-service/.env.example` to `nlp-service/.env` and set `NLP_WARM_START=true` in it.
That is a **line inside a file**, not a shell command — typing it at a PowerShell prompt gives
"the term is not recognized". Without it, the very first
scan may fall back to the deterministic engine and report `nlpAvailable: false`; every scan after
that uses the semantic layer (~1.2s for a typical policy).

**Confirming it is actually in use.** `GET /api/health` showing `"nlp": "available"` only means the
service is reachable. What proves it contributed is a completed scan reporting `nlpAvailable: true`,
and findings carrying `semanticSupport: true`.

Verify at <http://localhost:8000/health>, and the backend's own health will flip to
`"nlp": "available"` on its next check.

Run the NLP tests (these pass with or without the models installed):

```bash
python -m pytest tests -q
```

---

## Stopping

`Ctrl+C` in the terminal running `npm run dev` — it forwards the signal to the backend, the frontend
and PostgreSQL. The database harness waits for PostgreSQL to release its port, so you can start again
immediately.

Your data persists in `backend/.pgdata` and is picked up by the next `npm run dev`.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5.1. Run each command separately, as written above. |
| `openssl : The term 'openssl' is not recognized` | You do not need openssl. `npm run dev` generates the secret itself. |
| `port 55432 is still in use after 15s` | The stack is already running in another terminal. Switch to it and press Ctrl+C, then retry. This guard is what stops two servers fighting over one database. |
| `embedded postgres harness failed` | Delete `backend/.pgdata` and re-run `npm run dev` — the schema and rule pack are rebuilt automatically. |
| Health returns 503 `"database":"down"` | PostgreSQL is not running. Ctrl+C and run `npm run dev` again. |
| API calls fail with a CORS error | The frontend is on a port not in `FRONTEND_URL`. Add it in `backend/.env` and restart the backend. |
| `JWT_SECRET must be at least 32 characters` | `backend/.env` was overwritten by a stray `cp`. Run `npm run setup`, or just `npm run dev`. |
| *Cannot reach the DPDPA Sentinel backend* in the browser | The frontend is running without the backend. Stop it and use `npm run dev` from the repository root, which starts both. |
| *This site is hosted, but it is calling http://localhost:4000* | You are on the deployed URL (e.g. the Vercel one), not the local app. A hosted page cannot reach a backend on your machine. Use <http://localhost:5173> for local work, or set `VITE_API_URL` on the host to a deployed backend and redeploy. |
| Backend log shows `Origin ... is not allowed` with status 403 | The page's origin is not in `FRONTEND_URL` in `backend/.env`. The browser reports the blocked request as a network failure, so the UI says "cannot reach" even though the backend answered. |
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
