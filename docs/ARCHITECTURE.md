# EntraSave Architecture

This document describes the implemented EntraSave system. EntraSave is a
responsive personal-finance web application with a React SPA, an Express API,
and SQL Server persistence through Prisma.

## 1. System context

```text
Browser
  React 19 + React Router + Tailwind
        |
        | HTTPS JSON, /api, credentials: include
        v
Node.js / Express
  authentication, RBAC, validation, business rules,
  rate limiting, audit, DTO mapping
        |
        | Prisma
        v
SQL Server
```

The client and server are separate packages and separate trust zones. The
browser is untrusted. Every protected operation is authenticated and authorized
again by the API regardless of client routing state.

## 2. Repository structure

```text
EntraSave/
  client/
    public/brand/        logo assets
    src/
      auth/              session bootstrap and auth context
      components/        shared layout, modal, theme, summary UI
      lib/               API transport, endpoints, DTO mirrors, formatting
      pages/             route-level screens
      App.tsx            route table
      index.css          Tailwind and global responsive/dark-theme rules
  server/
    prisma/              schema, migrations, seed
    src/
      config/            validated environment and Prisma client
      controllers/       endpoint policy declarations
      dto/               public response contracts
      middleware/        Express request/security/error middleware
      repositories/      persistence interfaces and Prisma adapters
      routes/             URL wiring
      schemas/            Zod request schemas
      services/           business use cases
      utils/              auth, JWT, money, errors, rate limits, logging
      app.ts              Express assembly
      server.ts           process entrypoint
  docs/
  AGENTS.md
  CODING_STANDARDS.md
  SECURITY.md
```

Both packages define `@/*` as their local `src/*` alias. They do not import
source code from each other.

## 3. Client architecture

### Routing

`client/src/App.tsx` owns the route table.

Public routes:

- `/`
- `/sign-in`
- `/sign-up`
- `/privacy`
- `/terms`
- `/cookies`
- `/data-deletion`

Authenticated routes are nested under `AppLayout`:

- `/dashboard`
- `/accounts`
- `/transactions`
- `/settings`
- `/manage-account`

`AppLayout` redirects signed-out users for navigation UX, renders the desktop
header/profile menu, and renders the mobile bottom bar. This redirect is not a
security control; the server remains authoritative.

### Authentication state

`AuthContext` bootstraps the current session through the API and exposes the
current user and sign-out operation. The browser never receives the JWT. The
session cookie is attached automatically by `credentials: 'include'`.

### API access

`client/src/lib/api.ts` is the only raw transport layer. It:

- prefixes requests with `/api`;
- sends cookies;
- parses the `ActionResult<T>` envelope;
- returns successful data;
- throws `ApiError` for safe server errors and network failures.

`client/src/lib/endpoints.ts` declares typed feature operations. Pages call
these operations and mirror response contracts from `client/src/lib/types.ts`.

### State model

The client uses:

- auth context for session-wide identity;
- React Router for navigation and shareable filters;
- local component state for forms, dialogs, filters, and loaded page data.

There is no global finance-data cache. Mutations explicitly reload the affected
view. This is intentional for the current application size.

### Responsive shell

Desktop navigation appears at the `sm` breakpoint. Below it, a fixed bottom
navigation provides Home, Accounts, Add transaction, Activity, and Settings.
The central add button routes to `/transactions?add=1`, which opens the Add
Transaction dialog. Main content and the bottom bar include safe-area spacing.

Dialogs are portaled to `document.body`, lock background scrolling, support
Escape/backdrop close, and become scrollable bottom sheets on small screens.

## 4. Server architecture

### Express pipeline

`createApp()` assembles middleware in this order:

1. trusted proxy configuration;
2. request/correlation context;
3. security headers;
4. allowlisted credentialed CORS;
5. 1 MB JSON parsing;
6. cookie parsing;
7. `/health`;
8. `/api` routes;
9. not-found and final error handling.

The API router mounts auth/OAuth, accounts, transactions, categories, budgets,
monthly balances, dashboard, and users.

### Layering

```text
route
  -> controller
    -> defineRoute pipeline
      -> service
        -> repository interface
          -> Prisma repository
```

Routes contain no domain logic. Controllers declare endpoint policy. Services
own use cases. Repository interfaces isolate persistence. Prisma adapters are
the normal database boundary.

### defineRoute

`server/src/utils/define-route.ts` standardizes protected requests:

1. establish request ID;
2. verify the session cookie and load `AuthContext`;
3. require the declared database-backed permission;
4. apply the declared rate limit;
5. parse the request body with Zod;
6. run an optional ownership hook;
7. call the service;
8. append a redacted audit entry when enabled;
9. return `ActionResult<T>`.

Public credential endpoints use the explicit public mode: required IP rate
limit, Zod parsing, no authenticated policy, and no authenticated audit entry.

OAuth start/callback endpoints are protocol boundaries rather than ordinary
JSON actions. They validate signed state and provider responses before
delegating identity creation/linking and session issuance to the auth service.

### API response envelope

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        requestId?: string;
        fieldErrors?: Record<string, string[]>;
        retryAfter?: number;
      };
    };
```

Expected `AppError` values map to stable HTTP statuses. Unexpected errors are
logged with a request ID and returned as generic internal failures.

## 5. Authentication and authorization

EntraSave supports credentials, Google OAuth, and Facebook OAuth.

- Password hashing and verification are isolated in `utils/password.ts`.
- JWT signing and strict verification are isolated in `utils/jwt.ts`.
- The JWT contains identity/session claims, not roles or permissions.
- The JWT is stored only in the `entrasave_session` HttpOnly cookie.
- `sessionVersion` provides server-side session invalidation.
- OAuth flows validate signed state; Google uses provider token validation and
  Facebook uses provider token debugging/identity checks.
- Provider IDs have SQL Server filtered unique indexes when non-null.

`requireAuth()` builds an `AuthContext` with the current user and
database-loaded roles/permissions. `requirePermission()` is deny-by-default.
Row ownership is enforced independently in repository predicates using
`userId`.

## 6. Domain model

### User and RBAC

- `User`: credentials/provider identities, profile, avatar, base currency,
  status, session version, soft deletion.
- `Role`, `Permission`, `UserRole`, `RolePermission`: database-backed
  authorization.
- `AuditLog`: append-only redacted security/business event record.

### Finance

- `Account`: user-owned account, type, currency, opening balance, archive and
  soft-delete state.
- `Category`: ordered user-owned income/expense category.
- `Transaction`: income or expense activity associated with an
  account and optional category.
- `Budget`: reusable monthly limit for an expense category.
- `MonthlyBalance`: optional user-set starting balance for a zero-based
  year/month pair.

Money columns use `Decimal(19,4)`. DTOs serialize money as strings. Timestamps
are UTC. Account/category relations use `NoAction` where required to avoid SQL
Server multiple-cascade-path conflicts.

## 7. Feature behavior

### Accounts

Accounts support creation, renaming, type changes, opening-balance changes,
archive/unarchive, deletion, active summaries, and per-account balance totals.
All account and transaction effects remain owner-scoped.

### Transactions and monthly balances

Transactions support creation, editing, deletion, income/expense categories,
monthly navigation, category filtering, and budget alerts. Monthly summaries
include starting balance, current balance, income, expense, net, manual-start
state, and category aggregation.

The mobile center button and dashboard Add Transaction entry use the same
`add=1` route trigger for the Add Transaction dialog.

### Categories and budgets

Categories are ordered per user and may be sorted or dragged. Expense categories
may have a monthly budget. Budget status is SAFE, NEAR, or OVER based on monthly
expense aggregation. Changing a budgeted category to income clears the
incompatible budget.

### Dashboard

The dashboard loads accounts, categories, recent transactions, budget status,
and an aggregate dashboard response.

It has two presentation modes:

- Month: current balance/account count, current-month income/expense/net,
  current-month category summary, and monthly budget status.
- Year: current balance/account count, January-to-present income/expense/net,
  January-to-present category summary, and January-to-present monthly trend.

Recent activity and account balances appear in both modes. The server constructs
trend ranges from January through the current UTC month.

### Preferences and profile

Users can change display name, base currency, and theme. Currency selection
controls summary formatting; it does not perform foreign-exchange conversion.
Theme selection is stored client-side and supports system, light, and dark.

## 8. Data access and ownership

Every user-owned repository method accepts or derives `userId`. Active queries
also include `deletedAt: null` where applicable. Ownership is not established
by fetching an arbitrary row and filtering it afterward.

Important indexes include:

- account owner and soft-delete indexes;
- transaction owner/time, owner/account/time, owner/category;
- category owner/position;
- budget owner/period and owner/category/period uniqueness;
- monthly-balance owner/year/month uniqueness;
- audit actor/target/action with time.

Dashboard and budget reporting use database aggregates/grouping rather than
query-per-category loops.

## 9. Security and operations

- CORS permits the configured client origin with credentials.
- Security middleware sets browser hardening headers.
- JSON bodies are capped at 1 MB.
- Request IDs flow through logs and safe error responses.
- Rate-limit policies are centralized behind a rate-limiter interface. The
  current implementation is in-memory, so production remains single-node until
  a shared limiter is introduced.
- Operational logs and audit metadata exclude sensitive values.
- The health endpoint is `GET /health`.
- Environment configuration is parsed once by
  `server/src/config/env.ts`; invalid configuration prevents startup.

See [../SECURITY.md](../SECURITY.md) for the full security contract.

## 10. Development and verification

Root commands:

```powershell
npm run install:all
npm run dev
npm run typecheck
npm run lint
npm run build
```

Server database commands:

```powershell
npm run prisma:generate --prefix server
npm run prisma:migrate --prefix server
npm run prisma:deploy --prefix server
npm run db:seed --prefix server
```

The Vite client proxies `/api` during development. Production deploys the
compiled client and Express API behind HTTPS/reverse-proxy infrastructure with
the client origin and proxy trust configured explicitly.

## 11. Evolution rules

Add capabilities inside the existing seams:

- new feature: schema, DTO, repository interface/adapter, service, controller,
  route, client endpoint/type/UI;
- new persistence technology: implement repository interfaces;
- multi-node deployment: replace the in-memory limiter before scaling out;
- background processing or object storage: introduce an explicit service
  boundary rather than embedding it in controllers/pages;
- public/mobile API: add a separately versioned surface while reusing services
  and DTO mapping rules.

These are extension rules, not claims that those capabilities currently exist.
