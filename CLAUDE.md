# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Cross-repository integration testing and orchestration for the fledger project. This repo coordinates the three sibling packages that live alongside it under `../`:

- **fledger-api/** — Scala 3 backend (GraphQL API on port 8080)
- **fledger-web/** — React frontend (Vite on port 5173)
- **fledger-chrome/** — Chrome extension for bank transaction imports

## Sibling Repo Context

Each sibling repo is independent (no shared workspace). They connect via:

- **GraphQL schema** — API defines it, web and chrome consume it
- **Contract sync** — `npm run bindings:refresh:from-api` (from fledger-web) regenerates TS types from the running API
- **Auth** — API issues JWT tokens; web stores them in localStorage; chrome stores them via options page
- **WebSocket subscriptions** — API pushes real-time updates to web

## Running the Full Stack Locally

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
