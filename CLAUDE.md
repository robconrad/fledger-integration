# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also the parent [../CLAUDE.md](../CLAUDE.md) for monorepo-wide commands and architecture overview.

## Purpose

Cross-repository integration testing and orchestration for the fledger project. This repo coordinates the three sibling packages that live alongside it under `../`:

- **fledger-api/** — Scala 3 backend (GraphQL API on port 8080)
- **fledger-web/** — React frontend (Vite on port 5173)
- **fledger-chrome/** — Chrome extension for bank transaction imports

## Commands

Run all commands from `fledger-integration/`.

| Task | Command |
|------|---------|
| Run integration tests | `npm test` (Playwright) |
| Run tests headed | `npm run test:headed` |
| Run single test | `npx playwright test tests/<file>.spec.ts` |
| Start docker stack | `docker compose up -d --wait` |
| Tear down stack | `docker compose down -v` |
| Install browsers | `npx playwright install chromium` |

## Validation Gate

Run `npm test` as the required check for this repo. Tests run Playwright against the full Docker Compose stack (API + Web + PostgreSQL). A change is not considered good until tests pass against the running stack.

## Tech Stack

TypeScript, Playwright, Docker Compose, PostgreSQL 18 (Alpine).

## Docker Compose Architecture

`docker-compose.yml` defines three services:

| Service | Image | Host port (default) | Container port | Health check |
|---------|-------|---------------------|----------------|-------------|
| `postgres` | `postgres:18-alpine` | `${PG_PORT:-25432}` | 5432 | `pg_isready` |
| `api` | `${API_IMAGE:-fledger-api:candidate}` | `${API_PORT:-28080}` | 8080 | `curl /openapi.yaml` |
| `web` | `${WEB_IMAGE:-fledger-web:candidate}` | `${WEB_PORT:-23200}` | 80 | depends on api |

Override images with env vars: `API_IMAGE=... WEB_IMAGE=... docker compose up -d --wait`

Host port defaults (25432, 28080, 23200) are offset from standard dev ports to avoid collisions with local `sbt run` (8080) or `npm start` (5173). CI allocates unique ports per run for parallel execution.

Default DB credentials: user `fledger`, password `fledger-db`, database `fledger`.

## Test Structure

Tests live in `tests/` — all are Playwright specs running against the Docker stack (web on `WEB_PORT`, default 23200; API on `API_PORT`, default 28080):

- `health.spec.ts` — Basic stack health checks
- `auth.spec.ts` — JWT auth flow
- `api-accounts-crud.spec.ts` — Account CRUD via GraphQL
- `api-categories-crud.spec.ts` — Category CRUD via GraphQL
- `api-items-crud.spec.ts` — Item CRUD via GraphQL

Tests run sequentially (`fullyParallel: false`) since they share a live database. CI retries once on failure.

## CI Workflow

The GitHub Actions workflow (`.github/workflows/integration.yml`) runs in three modes:

| Mode | Trigger | What it does |
|------|---------|-------------|
| `pr-gate` | `workflow_dispatch` from per-repo CI | Builds candidate image from PR merge ref, runs tests, reports status back to source PR |
| `post-deploy` | `repository_dispatch` or `workflow_dispatch` | Pulls latest GHCR images, runs tests against deployed versions |
| `scheduled` | Weekly Monday 6am UTC | Same as post-deploy — catches drift |

Image resolution: PR-gate builds from source; other modes pull from `ghcr.io/robconrad/fledger-{api,web}:latest` with fallback to building from source. Web images use runtime API URL injection (entrypoint sed) so GHCR images work with any API port.

## Sibling Repo Context

Each sibling repo is independent (no shared workspace). They connect via:

- **GraphQL schema** — API defines it, web and chrome consume it
- **Contract sync** — `npm run bindings:refresh:from-api` (from fledger-web) regenerates TS types from the running API
- **Auth** — API issues JWT tokens; web stores them in localStorage; chrome stores them via options page
- **WebSocket subscriptions** — API pushes real-time updates to web

## Running the Full Stack Locally

### Via Docker Compose (recommended for integration tests)

```bash
# Build images first (from sibling repos)
cd ../fledger-api && sbt assembly && docker build -t fledger-api:candidate .
cd ../fledger-web && npm ci && npm run build && docker build -t fledger-web:candidate .

# Start stack
cd ../fledger-integration && docker compose up -d --wait

# Run tests
npm test

# Tear down
docker compose down -v
```

### Without Docker (individual services)

PostgreSQL must be running on localhost:5432.

```bash
# 1. API (port 8080) — runs Flyway migrations on startup
cd ../fledger-api && sbt run

# 2. Web (port 5173) — connects to API via .env.development
cd ../fledger-web && npm start

# 3. Chrome extension (watch mode)
cd ../fledger-chrome && npm run dev:extension
```

Verify with:
```bash
# Get auth token
curl -s -X POST http://localhost:8080/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"fledger","password":"fledger-local"}'

# Test GraphQL
curl -s -X POST http://localhost:8080/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ accounts(inactive: false, size: 5) { id name } }"}'
```

GraphiQL is available at http://localhost:8080/graphiql.

## API Endpoints

- `POST /graphql` — GraphQL queries/mutations (accepts single or array for batching)
- `GET /graphql` (WebSocket) — GraphQL subscriptions
- `POST /auth/token` — JWT issuance (`{"username":"fledger","password":"fledger-local"}` for dev)
- `GET /graphiql` — GraphQL IDE
- `GET /openapi.yaml` — OpenAPI spec

## Quality Gates (per-repo)

| Repo | Command | What it checks |
|------|---------|---------------|
| fledger-api | `sbt qualityGate` | format check + -Werror + coverage ≥96% stmt / 90% branch |
| fledger-web | `npm run test:coverage:strict:full` | lint + typecheck + bindings + coverage |
| fledger-chrome | `npm run test:coverage:strict:full` | ts-only check + lint + format + typecheck + tests + coverage |

## Domain Entities

Accounts, Account Groups, Account Types, Categories, Category Groups, Items (transactions), Transfer Items, Provisional Items, External Net Worth Records, Slices (time-aggregated reports), Normalization (projected category-group breakdowns).

## Sibling Repo Details

Each sibling has its own `CLAUDE.md` and `.claude/` directory with path-scoped rules, reference docs, and review agents. Consult those for repo-specific guidance.

**Default branches differ:** fledger-api and fledger-web use `master`; fledger-chrome and fledger-integration use `main`.

## Git Workflow

- Before starting new work, always reset to the latest origin/main: `git fetch origin && git checkout main && git reset --hard origin/main`
- Always create a new branch before making changes: `git checkout -b claude/<descriptive-slug>`
- Never commit directly to main
- Commit incrementally after each logical change with descriptive conventional commit messages
- Use descriptive branch names (e.g. `claude/add-integration-test`, `claude/fix-stack-setup`)
- **Before pushing, run `npm test`** against the Docker stack and fix any failures
- After all work is complete and verified, push the branch: `git push -u origin HEAD`
- **Before opening a PR, merge latest main**: `git fetch origin && git merge origin/main` — resolve conflicts locally before pushing
- Then open a PR: `gh pr create --base main --title "<conventional-commit-style title>" --body "<summary of changes, motivation, and anything the reviewer should know>"`
- **After opening a PR, watch CI** (`gh pr checks <number> --watch`) — if it fails, fix the issue, push again, and re-check until CI passes. You are not done until CI is green.
- If this is part of a cross-repo change, include links to related PRs in the body
- Do NOT merge PRs. Leave them for human review
