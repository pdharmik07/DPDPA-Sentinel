# Deployment

## Environment variables

### `backend/.env`

| Key | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | **≥ 32 chars.** `openssl rand -base64 48`. Server refuses to start without it |
| `JWT_EXPIRES_IN` | no | default `12h` |
| `BACKEND_PORT` | no | default `4000` |
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `FRONTEND_URL` | yes in prod | comma-separated CORS allowlist |
| `NLP_SERVICE_URL` | no | default `http://localhost:8000` |
| `NLP_ENABLED` | no | `false` disables the NLP call entirely |
| `NLP_TIMEOUT_MS` | no | default `15000` |
| `UPLOAD_MAX_SIZE` | no | bytes, default `10485760` |
| `UPLOAD_TMP_DIR`, `REPORT_DIR` | no | defaults `./uploads`, `./reports` |
| `LOG_LEVEL` | no | default `info` |
| `ANALYSIS_CONCURRENCY` | no | default `2` |

The environment is validated by Zod at boot; a missing or weak value fails fast with a message
naming the key (never the value).

### `frontend/.env.local`

| Key | Notes |
|---|---|
| `VITE_API_URL` | Base URL of the backend, e.g. `https://api.example.com` |

Only `VITE_*` variables are exposed to the browser. Never put a secret in one.

### `nlp-service/.env`

| Key | Notes |
|---|---|
| `ALLOWED_ORIGINS` | should be the backend origin only |
| `NLP_WARM_START` | `true` preloads models at startup |

## Local database without Docker

Docker Desktop on Windows Home requires WSL2, which is not always available. The backend therefore
ships an embedded PostgreSQL harness that needs no Docker and no admin rights:

Migrate and seed a persistent local database:

```bash
cd backend
```

```bash
npm run db:local:setup
```

Then start PostgreSQL and the API together:

```bash
npm run db:local
```

Run a single command against a throwaway database:

```bash
npx tsx scripts/withDb.ts "<any command>"
```

The harness forces `--encoding=UTF8 --locale=C`. Without it, `initdb` inherits the Windows locale
and builds a WIN1252 cluster that cannot store the em-dashes and arrows in the rule pack. The
`postgres:16-alpine` image in `docker-compose.yml` is UTF8, so this keeps local and production
faithful to each other.

**Any production database must be UTF8.**

## Production steps

```bash
cd backend
```

```bash
npm ci
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run build
```

```bash
npm start
```

```bash
cd frontend
```

```bash
npm ci
```

```bash
npm run build
```

Serve the resulting `frontend/dist/` as static files. On Vercel this is already wired up by
`vercel.json` at the repository root. Set `VITE_API_URL` **before** building — Vite inlines it.

## Checklist

- [ ] `JWT_SECRET` is freshly generated per environment and never committed
- [ ] `FRONTEND_URL` lists only real origins (no wildcard)
- [ ] `NODE_ENV=production` — suppresses the `debug` field on 500 responses
- [ ] TLS terminated in front of the backend; `trust proxy` is already set to 1
- [ ] `reports/` and `uploads/` are writable and not publicly served
- [ ] Database backups configured — `Scan.extractedText` holds user-uploaded policy text
- [ ] `npm test` green in CI before deploy
