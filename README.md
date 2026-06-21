# EntraSave — React + Node/Express edition

EntraSave is the **React (Vite SPA) + Node/Express (API)** port of the original
Next.js personal-finance app, against the **same SQL Server database, schema, and
migrations**. The architecture, security model, RBAC, audit, money handling, and
all `§N` design references are preserved — only the framework mechanics changed.

> Start here: [AGENTS.md](AGENTS.md) · [CODING_STANDARDS.md](CODING_STANDARDS.md)
> · [SECURITY.md](SECURITY.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> (read §0a first — the Next.js → React/Express translation table).

## Layout

```
EntraSave/
  package.json   root runner — `npm run dev` starts API + client together (concurrently)
  server/        Express API — all business logic, persistence, auth, RBAC, audit
    src/
      config/        env, prisma client
      middleware/    request-context, security headers, error handler
      routes/        URL wiring (+ index.ts mounts /api); one file per feature
      controllers/   thin defineRoute handlers (policy + delegate); one per feature
      services/      business logic; audit.service; one per feature
      repositories/  repository interface + Prisma adapter (*.prisma.ts); rbac.repository
      schemas/       Zod input schemas (one per feature)
      dto/           DTO types + entity→DTO mappers (one per feature)
      utils/         define-route (the security pipeline), jwt, password, oauth,
                     session-cookie, require-auth/permission, logger, ratelimit,
                     errors, money, pagination, currencies, result
      app.ts, server.ts
    prisma/      schema.prisma + migrations + seed (copied verbatim from the original)
  client/        React SPA (Vite + Tailwind) — presentation only, calls the API
    src/
      lib/       api client, typed endpoints, DTO types, formatting, theme
      auth/      session context (/me bootstrap; HttpOnly cookie, no token in JS)
      components/ layout, modal (portal), auth form, theme toggle
      pages/     landing, sign-in/up, dashboard, accounts, transactions
  AGENTS.md, CODING_STANDARDS.md, SECURITY.md, docs/ARCHITECTURE.md
```

The server layout follows the same **layer-based** vocabulary as the
BabyranWebsite project (`routes / controllers / services / utils / config /
middleware`), extended with `repositories / dto / schemas` for the typed
Prisma + DTO seams.

## How the request flow maps

```
React component → fetch POST /api/<feature>/<action> (cookie sent automatically)
  → *.routes.ts (thin controller) → defineRoute()  // auth → RBAC → rate limit
      → Zod → ownership → service → repository → Prisma adapter → SQL Server
  → DTO → ActionResult<T> JSON
```

`defineRoute` (`server/src/http/define-route.ts`) is the exact pipeline of the
original `defineAction` — same chain, same order, same guarantees.

## Running locally

Prereqs: Node ≥ 20.11, the existing SQL Server database reachable.

**One-command (from the repo root)** — installs both, then runs API + client together:
```bash
npm run install:all
# create server/.env (see step 1 below), then:
npm run dev                 # API :4000 + client :5173 via concurrently
```

Or run each app on its own:

**1. API** (`server/`)
```bash
cd server
npm install
cp .env.example .env        # set DATABASE_URL, JWT_SECRET (≥32 bytes), APP_URL, CLIENT_URL
npm run prisma:generate     # generate the Prisma client
# the DB already exists; if starting fresh: npm run prisma:deploy && npm run db:seed
npm run dev                 # http://localhost:4000
```

**2. Client** (`client/`, separate terminal)
```bash
cd client
npm install
npm run dev                 # http://localhost:5173  (proxies /api → :4000)
```

Open http://localhost:5173. In dev, the Vite proxy makes the SPA and API
same-origin, so the `entrasave_session` HttpOnly cookie behaves as same-site. In
production the two are served same-site behind IIS/Cloudflare and the API runs
CORS with `credentials: true` against `CLIENT_URL`.

## What was ported verbatim vs. adapted

- **Verbatim** (framework-agnostic): every module's `schema/dto/repository/prisma/
  service`, the auth/crypto primitives (`jwt`, `password`, `oauth`), RBAC, audit,
  rate-limiter, logger, errors, Prisma schema + migrations + seed, the Tailwind
  design system + dark theme.
- **Adapted to Express/React**: `defineAction` → `defineRoute`; Server Actions →
  `controllers/*.controller.ts` + `routes/*.routes.ts`; `next/headers`
  cookies/headers → `req`/`res`; edge middleware → `middleware/` (security
  headers) + per-route `requireAuth`; Server Components → React pages calling the
  typed API client; `revalidatePath` → client re-fetch.

## Verification

```bash
# server/
npm run typecheck && npm run lint && npm run build
# client/
npm run typecheck && npm run build
```

The full stack has been verified end-to-end against the live database: signup →
HttpOnly session cookie → `/me` (DB-resolved RBAC) → account creation (Decimal
money) → lazy default categories → dashboard aggregates, both directly and
through the Vite dev proxy.
