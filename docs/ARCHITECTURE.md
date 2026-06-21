# EntraSave — Production Architecture & Security Design

> Personal finance tracker built as a **layered client/server application**.
> Stack: **React 19 + Vite (SPA)** · **Node.js + Express (API)** · TypeScript · Tailwind · self-managed JWT/OAuth · Prisma · SQL Server 2017 · Zod.
> Deployment: Windows Server + IIS reverse proxy + Cloudflare.
> Guiding principle: **Start simple. Stable seams. Split into services later without changing public interfaces.**

---

## 0a. React + Express port — read this first

This document is the authoritative design. It was originally written for a
Next.js App Router monolith; **EntraSave is the React + Node/Express port of that
same design**. The layering, security model, and every `§N` section reference
used throughout the code comments are unchanged — only the framework mechanics
differ. Translate as you read:

| Original (Next.js) | EntraSave (React + Express) |
|---|---|
| One Next.js app (`src/`) | Two folders: **`server/`** (Express API) + **`client/`** (React SPA) |
| Server Action (`'use server'`, `*.actions.ts`) | controller (`controllers/*.controller.ts`) via `defineRoute` + route (`routes/*.routes.ts`) |
| `defineAction()` pipeline | `defineRoute()` pipeline — **same chain, same order** (`server/src/utils/define-route.ts`) |
| Server Components reading services directly | React components calling the API over `fetch` (credentials: include) |
| `revalidatePath()` after a mutation | client re-fetches the affected view after a successful mutation |
| `next/headers` `cookies()` / `headers()` | Express `req`/`res` (`session-cookie.ts`, `request-context.ts`) |
| Edge `middleware.ts` (JWT gate + CSP + nonce) | `server/src/middleware/` (security headers) + per-route `requireAuth` |
| Route Handlers (`app/api/...`) | Express routers under `/api` (`server/src/routes/index.ts`) |
| `import 'server-only'` | not needed — the API is a separate process; the client never imports server code |
| `@/*` → `src/*` | `@/*` → `server/src/*` (API) and `client/src/*` (SPA) |

What is **identical** (ported verbatim, framework-agnostic): every feature's
`schemas/*.schema.ts`, `dto/*.dto.ts`, `repositories/*.repository.ts`,
`repositories/*.prisma.ts`, `services/*.service.ts`; the auth/crypto primitives
(`utils/jwt.ts`, `utils/password.ts`, `utils/oauth.ts`); RBAC, audit,
rate-limiter, logger, errors, and the Prisma schema + migrations + seed.

The server uses a **layer-based** folder layout (Babyran-style):
`config/ middleware/ routes/ controllers/ services/ repositories/ dto/ schemas/
utils/`, one file per feature per layer. Routes wire URLs to controllers;
controllers are thin `defineRoute` handlers; services hold all logic; the
repository interface + Prisma adapter are the persistence seam.

The two apps are **separate origins** in development (API `:4000`, SPA `:5173`),
so the API runs CORS with `credentials: true` against a single allowlisted
origin (`CLIENT_URL`), and the session lives in an `HttpOnly` cookie the browser
JS can never read. In production they are served same-site behind IIS/Cloudflare.

The diagrams and prose below still say "Next.js" / "Server Action" /
"middleware" in places; map each through the table above. Where a section is
purely framework mechanics (§1 diagram, §3 request lifecycle, §7 folder
structure, §8 module example, §11.2 headers), the EntraSave equivalent is noted
inline or is a direct one-to-one substitution from the table.

---

## 0. Design Philosophy

| Principle | What it means here |
|---|---|
| Modular monolith first | One Next.js app, one database, feature modules with hard internal boundaries. No microservices on day one. |
| Stable seams | Every feature exposes a **service interface** and **DTOs**. Internals (Prisma, SQL Server) can change without touching callers. |
| Server-authoritative | All auth, authorization, validation, and business logic run server-side. The client is never trusted. |
| Defense in depth | Cloudflare → IIS → Next.js middleware → Server Action/Route Handler → auth → RBAC → Zod → service → Prisma. Each layer assumes the one before it failed. |
| Portable persistence | Prisma + Decimal money + UTC timestamps + no SQL-Server-only features in hot paths → PostgreSQL migration is a config + migration job, not a rewrite. |

---

## 1. High-Level Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │                  CLIENT                       │
                        │  Browser (React Server + Client Components)   │
                        │  Future: Mobile app, Public API consumers     │
                        └───────────────────────┬─────────────────────-┘
                                                 │ HTTPS
                        ┌────────────────────────▼─────────────────────┐
                        │             CLOUDFLARE (proxy)                │
                        │  TLS, WAF, DDoS, Bot mgmt, Turnstile, caching │
                        └────────────────────────┬─────────────────────┘
                                                 │ Authenticated Origin Pull (mTLS)
                        ┌────────────────────────▼─────────────────────┐
                        │        WINDOWS SERVER · IIS (reverse proxy)   │
                        │  ARR + URL Rewrite, HSTS, request size caps   │
                        └────────────────────────┬─────────────────────┘
                                                 │ http://localhost:3000
        ┌────────────────────────────────────────▼──────────────────────────────────────┐
        │                          NEXT.JS 15 APP (Node runtime)                          │
        │                                                                                 │
        │   middleware.ts ──► JWT session · route protection · security headers · rate    │
        │                     limit gate · request-id                                     │
        │                                                                                 │
        │   ┌─────────────── Presentation ───────────────┐                                │
        │   │ Server Components (read)                    │                                │
        │   │ Client Components (interactivity only)      │                                │
        │   │ Server Actions (C/U/D mutations)            │                                │
        │   │ Route Handlers (webhooks, mobile API,       │                                │
        │   │                 file upload, public API)    │                                │
        │   └──────────────────────┬─────────────────────┘                                │
        │                          │ calls (never the reverse)                             │
        │   ┌──────────────────── Application / Service Layer ───────────────────┐         │
        │   │  Feature modules: auth, accounts, transactions, budgets, goals,    │         │
        │   │  recurring, categories, attachments, reports, admin, audit, ...    │         │
        │   │  • Use-cases / services   • Zod schemas   • DTO mappers            │         │
        │   │  • Authorization policies • Domain rules                          │         │
        │   └──────────────────────┬────────────────────────────────────────────┘         │
        │                          │ repository interfaces                                 │
        │   ┌──────────────────── Infrastructure ────────────────────┐                     │
        │   │ Prisma Client (server-only)  │ Rate limiter  │ Logger   │                     │
        │   │ JWT/OAuth │ Cache (in-mem→Redis) │ Storage (local→S3/R2)│                      │
        │   │ Mailer    │ Queue (inline→worker)│ Crypto/secrets       │                     │
        │   └──────────────────────┬──────────────────────────────────┘                    │
        └──────────────────────────┼──────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────▼─────────┐      ┌──────────────────────────────────────┐
        │   SQL SERVER 2017 · DB "Finance"   │      │  External / Future Services            │
        │   Prisma-managed schema, indexes   │      │  Google/Meta · Cloudflare R2/S3 · Redis│
        │   Decimal money, soft deletes      │      │  Queue/Worker · OCR · AI insights      │
        └────────────────────────────────────┘      └──────────────────────────────────────┘
```

**Key seam:** Presentation depends on Services; Services depend on **repository interfaces**, not Prisma directly. Today the interface is implemented by a Prisma adapter; tomorrow it can be an HTTP client to an extracted service — callers don't change.

---

## 2. Deployment Architecture Diagram

```
 Internet
    │
    ▼
┌──────────────────────────────┐
│ Cloudflare                   │  • DNS, TLS termination (edge)
│ • WAF managed rules          │  • Rate limiting rules (L7)
│ • Bot Fight / Turnstile      │  • DDoS L3/4/7
│ • Cache static/_next assets  │  • Authenticated Origin Pull → origin
└──────────────┬───────────────┘
               │ (only Cloudflare IPs allowed at firewall)
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Windows Server (VM / dedicated)                             │
│                                                             │
│  ┌────────────────────────┐    ┌──────────────────────────┐ │
│  │ IIS (ARR reverse proxy)│───►│ Node process: Next.js     │ │
│  │ :443 public            │    │ (standalone) :3000 local  │ │
│  │ HSTS, maxAllowedContent│    │ Run via PM2 / NSSM /       │ │
│  │ Length, X-Forwarded-*  │    │ Windows Service            │ │
│  └────────────────────────┘    └────────────┬─────────────┘ │
│                                              │ TCP 1433 (local)│
│                                 ┌────────────▼──────────────┐ │
│                                 │ SQL Server 2017 "Finance" │ │
│                                 │ TLS in transit, TDE at rest│ │
│                                 └───────────────────────────┘ │
│                                                             │
│  Backups: nightly full + log backups → off-box + offsite    │
└─────────────────────────────────────────────────────────────┘

 Future horizontal scale:
   Cloudflare LB ──► [IIS/Node #1] [IIS/Node #2] ... (stateless app nodes)
                          │              │
                          └──────┬───────┘
                          Redis (sessions cache, rate limit, queue)
                          SQL Server primary ──► read replicas
                          Worker node(s) consuming queue (OCR, reports, recurring)
```

**Hardening notes**
- Origin firewall accepts traffic **only from Cloudflare IP ranges**; enable Authenticated Origin Pulls (mTLS) so requests must come from your Cloudflare account.
- Node binds to `127.0.0.1:3000` only; IIS is the sole public listener.
- Secrets live outside the repo (Windows DPAPI / env file with restricted ACL / future: Key Vault).
- Run the Node app under a **least-privilege service account**, not Administrator.

---

## 3. Request Lifecycle Diagram

```
[1] User action in UI (form submit / navigation / fetch)
      │
[2] Cloudflare      → WAF, bot score, edge rate-limit, TLS
      │
[3] IIS             → size limits, forward to Node, attach X-Forwarded-For
      │
[4] middleware.ts   → request-id, security headers, local JWT verification,
      │                route-level auth gate, coarse rate-limit
      ▼
[5] Server Action  ── or ──  Route Handler        (entrypoint)
      │
[6] authenticate()  → verify signed cookie; load active local user/session version
      │
[7] authorize()     → load roles/permissions; RBAC + owner check (policy)
      │
[8] validate()      → Zod parse of raw input → typed, safe DTO-in
      │
[9] rateLimit()     → per-user/per-action token bucket (in-mem → Redis)
      │
[10] service.useCase(input, ctx)   ← business logic lives ONLY here
      │
[11] repository (Prisma)  → parameterized query (no string SQL)
      │
[12] SQL Server "Finance" → returns rows
      │
[13] toDTO(entity)  → strip internal fields, encode output
      │
[14] auditLog (for mutations / sensitive reads)
      │
[15] return DTO  → Server Component renders / Action returns typed result
      ▼
[16] revalidatePath/Tag for affected views
```

Every step short-circuits with a **safe, typed error** (§15) on failure — no raw exceptions or stack traces leak to the client.

---

## 4. Authentication Flow (Self-managed)

```
Email/password ─► defineAction(authentication: 'public') ─► Zod + per-IP limit ─► scrypt verify
Google/Meta   ─► provider OAuth code flow ─► state (+ Google PKCE/nonce)
              ─► backend code exchange + provider-token verification
              ─► create/link local SQL Server User
              ◄─ signed HS256 JWT in Secure, HttpOnly, SameSite=Lax cookie

Every protected request:
  middleware.ts ─► signature/issuer/audience/expiry check (coarse gate)
  requireAuth() ─► DB user ACTIVE + sessionVersion check + RBAC resolution
```

**Rules**
- Passwords are stored only as versioned, salted, memory-hard scrypt hashes; plaintext is never logged or persisted.
- Email and provider identifiers are unique. Google ID tokens and Facebook access tokens are verified server-side before linking.
- Provider identities auto-link by email only when the local email was already provider-verified; unverified password accounts cannot be pre-claimed and linked.
- A verified provider may claim a credential-less legacy migration row matching
  its verified email, but only when password and both provider ids are null.
  This preserves migrated users without leaving an attacker-held credential.
- JWTs contain only the local user id, session version, standard claims, and a random `jti`; authorization remains DB-backed.
- Logout increments `sessionVersion` (revoking all older JWTs) and expires the cookie.
- OAuth state cookies are HttpOnly, short-lived, provider/path scoped, and signed; Google also uses PKCE and nonce.
- Middleware never treats a decoded payload as authorization. It verifies the
  JWT only as a coarse route gate; `requireAuth()` reloads status, revocation
  state, roles, and permissions from SQL Server at the protected server boundary.
- Password registration does not currently prove mailbox ownership. Consequently,
  password-created emails remain unverified and cannot participate in automatic
  OAuth email linking. Email verification/reset and MFA are explicit future auth
  use cases, not implicit behavior.
- `JWT_SECRET` rotation revokes all sessions and outstanding OAuth flows. Normal
  logout increments only that user's `sessionVersion`, revoking all their JWTs.

---

## 5. Authorization & RBAC Flow

Two independent checks, **both** required:

```
                 ┌──────────────────────────────────────────┐
 Request ──────► │ 1. ROLE / PERMISSION CHECK (what you are) │
                 │    DB-backed: UserRole → Role → Permission│
                 │    e.g. "admin.users.read"                │
                 └───────────────────┬──────────────────────┘
                                     │ pass
                 ┌───────────────────▼──────────────────────┐
                 │ 2. OWNERSHIP CHECK (what is yours)        │
                 │    resource.userId === ctx.userId         │
                 │    (or admin override w/ permission)      │
                 └───────────────────┬──────────────────────┘
                                     │ pass → execute
                                     ▼
                              allow + audit
```

- **Roles/Permissions are database-backed**, not hardcoded in code or JWT claims. The DB is the source of truth and is re-verified server-side.
- **Every data query is scoped by `userId`** at the repository layer (see §9 ownership strategy). Owner-based authorization is enforced in the query `where`, not after fetching.
- **Admin override** is an explicit permission (`admin.*`) and always writes an audit log entry with `actorUserId`, `targetUserId`, action, and before/after where relevant.
- Permission model: `Role` ⇄ `Permission` is many-to-many; `User` ⇄ `Role` is many-to-many via `UserRole`. Checks resolve to a flat permission set, cached per request.

Default roles: `USER` (self-service only), `SUPPORT` (read-only admin), `ADMIN` (full admin), `SUPERADMIN` (role/permission management + settings).

---

## 6. Admin Panel Security Architecture

```
/admin/*  ── middleware: require a valid session
   │         (fine-grained roles are always loaded from SQL Server)
   ▼
 Admin Server Component / Action
   │
   ├─ requirePermission('admin.users.read')   ← fine-grained, DB-verified
   ├─ Zod-validate every input
   ├─ service call (admin module)
   ├─ MANDATORY auditLog(actor, action, target, metadata, ip, requestId)
   └─ DTO response (PII minimized — never dump raw financial rows)
```

Admin modules & required permissions:

| Panel | Permission | Notes |
|---|---|---|
| Dashboard (KPIs) | `admin.dashboard.read` | Aggregates only, no per-user financial detail |
| User management | `admin.users.read` / `.write` | Disable/enable locally and revoke sessions; never edit user financial data |
| Audit log viewer | `admin.audit.read` | Append-only; filter by actor/target/date; export gated |
| System settings | `admin.settings.write` | SUPERADMIN; changes are themselves audited |
| Abuse monitoring | `admin.abuse.read` | Flagged accounts, anomalies, failed-auth spikes |
| Rate-limit monitoring | `admin.ratelimit.read` | Current buckets, top offenders, manual block |
| Role & permission mgmt | `admin.roles.write` | SUPERADMIN only; double audited |

**Rules:** every admin route is server-verified (not just middleware-hidden); every admin mutation is audited; admins **cannot read raw user financial values** beyond what's needed (aggregate/PII-min by default); destructive admin actions require confirmation + reason captured into the audit log.

---

## 7. Folder Structure

```
finance/
├─ src/
│  ├─ app/                              # Next.js App Router (presentation only)
│  │  ├─ (marketing)/                   # public pages
│  │  ├─ (app)/                         # authenticated user area
│  │  │  ├─ dashboard/page.tsx          # Server Component (read via service)
│  │  │  ├─ transactions/
│  │  │  ├─ budgets/
│  │  │  ├─ goals/
│  │  │  └─ settings/
│  │  ├─ (admin)/admin/                 # admin area, role-gated
│  │  ├─ api/                           # Route Handlers ONLY
│  │  │  ├─ auth/oauth/[provider]/route.ts
│  │  │  ├─ auth/oauth/[provider]/callback/route.ts
│  │  │  ├─ webhooks/stripe/route.ts    # future
│  │  │  ├─ v1/                         # future public/mobile API
│  │  │  └─ uploads/route.ts            # file upload
│  │  ├─ layout.tsx
│  │  └─ middleware.ts                  # → src/middleware.ts
│  │
│  ├─ modules/                          # FEATURE MODULES (the heart)
│  │  ├─ transactions/
│  │  │  ├─ transaction.service.ts      # business logic / use-cases
│  │  │  ├─ transaction.repository.ts   # interface
│  │  │  ├─ transaction.prisma.ts       # Prisma impl of repository
│  │  │  ├─ transaction.schema.ts       # Zod input schemas
│  │  │  ├─ transaction.dto.ts          # DTO types + mappers
│  │  │  ├─ transaction.policy.ts       # authorization rules
│  │  │  ├─ transaction.actions.ts      # Server Actions (thin wrappers)
│  │  │  └─ transaction.test.ts
│  │  ├─ accounts/ budgets/ goals/ recurring/ categories/
│  │  ├─ attachments/                   # receipts (storage abstraction)
│  │  ├─ reports/                       # aggregation, caching, jobs
│  │  ├─ admin/                         # admin use-cases
│  │  ├─ auth/                          # schemas/DTO/repository/service/actions/UI
│  │  ├─ rbac/                          # roles, permissions, policy engine
│  │  └─ audit/                         # audit logging service
│  │
│  ├─ server/                           # cross-cutting server infrastructure
│  │  ├─ db/prisma.ts                   # singleton Prisma client (server-only)
│  │  ├─ auth/jwt.ts                    # strict HS256 creation/verification
│  │  ├─ auth/session-cookie.ts         # HttpOnly cookie lifecycle
│  │  ├─ auth/password.ts               # versioned scrypt hashing
│  │  ├─ auth/oauth.ts                  # provider protocol + token verification
│  │  ├─ auth/auth-context.ts           # userId, roles, permissions, request data
│  │  ├─ auth/require-auth.ts           # JWT + DB status/revocation/RBAC gate
│  │  ├─ ratelimit/                     # limiter abstraction (memory→Redis)
│  │  ├─ cache/                         # cache abstraction (memory→Redis)
│  │  ├─ storage/                       # file storage abstraction (local→S3/R2)
│  │  ├─ queue/                         # job queue abstraction (inline→worker)
│  │  ├─ logger/                        # structured logger + redaction
│  │  ├─ errors/                        # AppError hierarchy + result types
│  │  └─ config/env.ts                  # Zod-validated environment
│  │
│  ├─ shared/                           # framework-agnostic shared kit
│  │  ├─ result.ts                      # Result<T,E> type
│  │  ├─ money.ts                       # Decimal helpers
│  │  ├─ pagination.ts
│  │  └─ types.ts
│  │
│  ├─ components/                       # shadcn/ui + shared UI (no business logic)
│  └─ middleware.ts                     # local JWT + headers + route gate
│
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                           # default roles/permissions/currencies
├─ docs/ARCHITECTURE.md                 # this file
├─ scripts/                             # ops scripts (backup verify, etc.)
├─ .env.example
└─ package.json
```

**Dependency rule (Clean Architecture):** `app/` → `modules/` → `server/` & `shared/`. Inner layers never import from `app/`. `modules/*` never import another module's internals — only its **exported service interface + DTOs** (enforced via lint boundaries / index barrels).

---

## 8. Feature Module Structure (example: `transactions`)

```
transaction.actions.ts   ── Server Action: thin. auth→authz→zod→service→revalidate
       │ depends on
transaction.service.ts   ── use-cases: createTransaction, listTransactions(paged),
       │                     updateTransaction, softDeleteTransaction, getSummary
       │ depends on (interface)
transaction.repository.ts (interface) ── find/insert/update scoped by userId
       │ implemented by
transaction.prisma.ts    ── Prisma adapter (the ONLY place Prisma is touched here)

transaction.schema.ts    ── Zod: CreateTransactionInput, ListQuery, ...
transaction.dto.ts       ── TransactionDTO, toDTO(entity): no internal fields
transaction.policy.ts    ── canCreate(ctx), canEdit(ctx, entity) (ownership)
```

Example Server Action (the canonical pattern every mutation follows):

```ts
'use server';
export async function createTransaction(raw: unknown) {
  const ctx = await requireAuth();                       // §4 local JWT + DB status
  await requirePermission(ctx, 'transactions.write');    // §5 RBAC
  await rateLimit(ctx.userId, 'transaction.create');     // §13
  const input = CreateTransactionSchema.parse(raw);      // §8 Zod
  const result = await transactionService.create(ctx, input); // §10 service
  await audit(ctx, 'transaction.create', { id: result.id });   // §14
  revalidatePath('/transactions');
  return toResult(result);                               // typed DTO/error
}
```

The service receives `ctx` (never re-reads request); the repository **always** injects `where: { userId: ctx.userId, deletedAt: null }`.

---

## 9. Prisma Schema Design

> Money = `Decimal @db.Decimal(19,4)` (never Float). Timestamps stored UTC.
> Soft delete via `deletedAt` on user-owned mutable resources.
> `userId` on every user-owned table, always indexed, always FK.

```prisma
// datasource — SQL Server today, swap provider for PostgreSQL later
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
generator client { provider = "prisma-client-js" }

// ─────────────── Identity / RBAC ───────────────
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?
  googleId        String?   @db.NVarChar(255)
  facebookId      String?   @db.NVarChar(255)
  sessionVersion  Int       @default(0)
  emailVerifiedAt DateTime?
  displayName     String?
  avatarUrl       String?   @db.NVarChar(2048)
  status          String    @default("ACTIVE")
  baseCurrency    String    @default("AUD")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  roles        UserRole[]
  accounts     Account[]
  categories   Category[]
  transactions Transaction[]
  budgets      Budget[]
  goals        SavingsGoal[]
  recurring    RecurringTransaction[]
  attachments  Attachment[]
  notifications Notification[]
  settings     Setting[]
  auditLogs    AuditLog[] @relation("ActorAudit")

  @@index([status])
  @@index([deletedAt])
  @@index([googleId])
  @@index([facebookId])
}

model Role {
  id          String @id @default(cuid())
  key         String @unique            // USER, SUPPORT, ADMIN, SUPERADMIN
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       UserRole[]
  permissions RolePermission[]
}

model Permission {
  id        String @id @default(cuid())
  key       String @unique              // e.g. "transactions.write", "admin.users.read"
  name      String
  createdAt DateTime @default(now())
  roles     RolePermission[]
}

model UserRole {
  userId String
  roleId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@id([userId, roleId])
  @@index([roleId])
}

model RolePermission {
  roleId       String
  permissionId String
  role        Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission  Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@index([permissionId])
}

// ─────────────── Finance core ───────────────
model Account {
  id        String   @id @default(cuid())
  userId    String
  name      String
  type      AccountType
  currency  String   @default("USD")
  balance   Decimal  @db.Decimal(19,4) @default(0)
  isArchived Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  @@index([userId])
  @@index([userId, deletedAt])
}
enum AccountType { CHECKING SAVINGS CASH CREDIT_CARD INVESTMENT OTHER }

model Category {
  id        String   @id @default(cuid())
  userId    String
  name      String
  kind      CategoryKind            // INCOME | EXPENSE
  color     String?
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent    Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  transactions Transaction[]
  @@unique([userId, name, kind])
  @@index([userId])
}
enum CategoryKind { INCOME EXPENSE }

model Transaction {
  id          String   @id @default(cuid())
  userId      String
  accountId   String
  categoryId  String?
  type        TransactionType
  amount      Decimal  @db.Decimal(19,4)
  currency    String   @default("USD")
  description String?
  notes       String?
  occurredAt  DateTime                 // when it happened (UTC)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  account     Account  @relation(fields: [accountId], references: [id])
  category    Category? @relation(fields: [categoryId], references: [id])
  attachments Attachment[]
  // hot query paths:
  @@index([userId, occurredAt])              // list/paginate by date
  @@index([userId, accountId, occurredAt])
  @@index([userId, categoryId])
  @@index([userId, deletedAt])
}
enum TransactionType { INCOME EXPENSE TRANSFER }

model Budget {
  id         String   @id @default(cuid())
  userId     String
  categoryId String?
  name       String
  amount     Decimal  @db.Decimal(19,4)
  period     BudgetPeriod
  startsAt   DateTime
  endsAt     DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([userId, period])
}
enum BudgetPeriod { WEEKLY MONTHLY QUARTERLY YEARLY }

model SavingsGoal {
  id           String   @id @default(cuid())
  userId       String
  name         String
  targetAmount Decimal  @db.Decimal(19,4)
  currentAmount Decimal @db.Decimal(19,4) @default(0)
  currency     String   @default("USD")
  targetDate   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?
  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model RecurringTransaction {
  id          String   @id @default(cuid())
  userId      String
  accountId   String
  categoryId  String?
  type        TransactionType
  amount      Decimal  @db.Decimal(19,4)
  currency    String   @default("USD")
  description String?
  frequency   RecurFrequency
  interval    Int      @default(1)
  nextRunAt   DateTime
  lastRunAt   DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([isActive, nextRunAt])             // worker scan
}
enum RecurFrequency { DAILY WEEKLY MONTHLY YEARLY }

model Attachment {
  id            String   @id @default(cuid())
  userId        String
  transactionId String?
  storageKey    String                       // path/key in storage backend
  fileName      String
  contentType   String
  byteSize      Int
  checksum      String?                      // integrity (sha256)
  status        AttachmentStatus @default(PENDING)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  user          User @relation(fields: [userId], references: [id], onDelete: Cascade)
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  @@index([userId])
  @@index([transactionId])
}
enum AttachmentStatus { PENDING SCANNING CLEAN INFECTED FAILED }

// ─────────────── Platform ───────────────
model AuditLog {
  id           String   @id @default(cuid())
  actorUserId  String?                       // null = system
  targetUserId String?
  action       String                        // "transaction.create", "admin.user.suspend"
  resourceType String?
  resourceId   String?
  metadata     String?  @db.NVarChar(Max)    // JSON, redacted (no raw money)
  ip           String?
  userAgent    String?
  requestId    String?
  createdAt    DateTime @default(now())
  actor        User? @relation("ActorAudit", fields: [actorUserId], references: [id])
  @@index([actorUserId, createdAt])
  @@index([targetUserId, createdAt])
  @@index([action, createdAt])
}

model Setting {
  id        String   @id @default(cuid())
  userId    String?                          // null = global system setting
  key       String
  value     String   @db.NVarChar(Max)       // JSON
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, key])
  @@index([userId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String?  @db.NVarChar(Max)
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, readAt])
  @@index([userId, createdAt])
}

model Currency {
  code      String   @id                     // ISO 4217, e.g. "USD"
  name      String
  symbol    String
  decimals  Int      @default(2)
  isActive  Boolean  @default(true)
  ratesFrom ExchangeRate[] @relation("FromCur")
  ratesTo   ExchangeRate[] @relation("ToCur")
}

model ExchangeRate {
  id         String   @id @default(cuid())
  baseCode   String
  quoteCode  String
  rate       Decimal  @db.Decimal(19,8)
  asOf       DateTime
  createdAt  DateTime @default(now())
  base       Currency @relation("FromCur", fields: [baseCode], references: [code])
  quote      Currency @relation("ToCur",  fields: [quoteCode], references: [code])
  @@unique([baseCode, quoteCode, asOf])
  @@index([baseCode, quoteCode, asOf])
}
```

SQL Server's ordinary nullable unique constraint permits only one `NULL`, so
`googleId` and `facebookId` use filtered unique indexes created in the migration
(`WHERE providerId IS NOT NULL`). The Prisma schema also declares ordinary
lookup indexes; do not replace the filtered indexes with nullable `@unique`.

**Portability notes for PostgreSQL:** avoid `@db.NVarChar(Max)`-specific assumptions in app code (treat as text/JSON); `Decimal(19,4)` maps cleanly to `numeric(19,4)`; cuid IDs are DB-agnostic; no T-SQL stored procs in hot paths. Keep all timestamps UTC.

---

## 10. Database Indexing Strategy

| Goal | Index pattern |
|---|---|
| Owner isolation + every list query | Composite leading with `userId` (`@@index([userId, ...])`) |
| Transaction history pagination | `[userId, occurredAt]` — supports keyset/seek pagination |
| Filtered transaction views | `[userId, accountId, occurredAt]`, `[userId, categoryId]` |
| Soft-delete filtering | `[userId, deletedAt]` (most queries filter `deletedAt IS NULL`) |
| Recurring job scan | `[isActive, nextRunAt]` — worker selects due jobs only |
| Audit queries | `[actorUserId, createdAt]`, `[targetUserId, createdAt]`, `[action, createdAt]` |
| Uniqueness/integrity | `User.email`; filtered unique indexes on non-null `googleId`/`facebookId`; `Category(userId,name,kind)` |

**Pagination:** prefer **keyset/seek pagination** (`WHERE (userId, occurredAt, id) < cursor ORDER BY occurredAt DESC, id DESC LIMIT n`) over `OFFSET` for large tables — O(1) per page, stable under inserts. Offset pagination is acceptable only for small admin lists.

**N+1 avoidance:** use Prisma `include`/`select` with explicit relation loading; for dashboards use a single aggregate query (`groupBy`) rather than per-category loops. Never loop a query inside `map`.

---

## 11. Security Architecture

| Control | Implementation |
|---|---|
| **AuthN** | Local versioned scrypt credentials + direct Google/Meta OAuth; strict HS256 HttpOnly JWT; DB session-version revocation. |
| **AuthZ** | DB-backed RBAC + per-row ownership enforced in repository `where`. |
| **Input validation** | Zod at every entrypoint; parse-don't-validate → typed inputs only. |
| **Output encoding** | React auto-escapes; never `dangerouslySetInnerHTML` with user data; DTOs strip internals. |
| **SQL injection** | Prisma parameterizes all queries; **no raw SQL** with interpolation (use `$queryRaw` tagged template only, never string concat). |
| **CSRF** | Server Actions are origin-checked by Next.js; session/OAuth cookies are `SameSite=Lax`; OAuth uses signed state. |
| **XSS** | CSP (below), no inline event handlers, sanitize any rich text, escape on render. |
| **Secure headers** | Set in middleware (below). |
| **Transport** | TLS at Cloudflare + origin; HSTS; Authenticated Origin Pulls. |
| **Secrets** | `.env` outside repo, ACL-restricted; validated at boot (§16); rotate JWT/OAuth/DB secrets; future Key Vault. |
| **At-rest** | SQL Server TDE; encrypt attachment storage; checksum integrity. |
| **Rate/abuse** | §13. |
| **File upload** | §11.1. |
| **Audit/logging** | §14. |
| **Dependencies** | §12 (npm audit, Dependabot, lockfile, CI gate). |
| **SSRF** | No user-supplied URLs fetched server-side; if added (e.g. webhooks/avatars), allowlist + block private IP ranges + no redirects to internal. |

### 11.1 Secure File Upload Design (future receipts)

```
Client ──► request upload (Server Action): validate type/size, create Attachment(PENDING),
           return pre-signed PUT URL (S3/R2) OR accept multipart at /api/uploads
Storage  ◄ direct PUT (preferred) — keeps large bytes off the Node process
Webhook/job ──► virus scan → set status CLEAN/INFECTED; store checksum
Serve   ──► time-limited pre-signed GET, ownership-checked, never public bucket
```
- Allowlist content types (`image/png,image/jpeg,application/pdf`), enforce max size (e.g. 10 MB) at IIS + app + storage policy.
- Generate random `storageKey`; never use user-supplied filenames as paths (path traversal).
- Store outside webroot; serve only via authorized, signed, expiring URLs.
- Mark `INFECTED`/`FAILED` files unservable; quarantine.

### 11.2 Security Headers (middleware)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY            (or CSP frame-ancestors 'none')
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-<per-request>';
  style-src 'self' 'unsafe-inline';        # Tailwind; tighten with nonce where possible
  img-src 'self' data: https:;
  connect-src 'self';
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
  object-src 'none'
```
Use a **per-request nonce** for inline scripts and keep provider traffic server-side.

---

## 12. OWASP Top 10 Mitigation Checklist

| # | Risk | Mitigation |
|---|---|---|
| A01 | Broken Access Control | DB-backed RBAC + ownership in every repository `where`; server-side re-verify; admin audited; no IDOR (all reads scoped by `userId`). |
| A02 | Cryptographic Failures | TLS everywhere + HSTS; SQL Server TDE; httpOnly cookies; no secrets in code; Decimal money; hashed/signed webhook secrets. |
| A03 | Injection | Prisma parameterization; Zod input typing; no string-built SQL; output encoding via React. |
| A04 | Insecure Design | Threat-modeled flows; least privilege; layered defense; safe defaults (deny-by-default authz). |
| A05 | Security Misconfiguration | Hardened headers/CSP; Cloudflare-only origin; least-priv service account; `env.ts` boot validation; no debug in prod. |
| A06 | Vulnerable Components | `npm audit` + Dependabot + lockfile + CI fail-on-high; pin runtime versions. |
| A07 | Auth/Session Failures | Memory-hard hashes; strict JWT claims; DB revocation counter; OAuth state/PKCE/nonce; per-IP sign-in limits. |
| A08 | Integrity Failures | Verified provider tokens; lockfile + SRI where applicable; attachment checksums; signed CI artifacts. |
| A09 | Logging/Monitoring Failures | Structured logs + audit log + alerting on auth spikes/abuse; correlation IDs; no sensitive data in logs. |
| A10 | SSRF | No user-controlled server-side fetches; if needed, allowlist host + block RFC1918/link-local + deny redirects. |

---

## 13. Rate Limiting & Abuse Prevention Design

**Abstraction:** `RateLimiter` interface with two implementations — `MemoryRateLimiter` (single node, today) and `RedisRateLimiter` (distributed, future). Code calls `rateLimit(key, action)`; swapping backends is a config change.

```
Layered limits:
  Edge      → Cloudflare WAF rules + Bot Fight + Turnstile on sign-in/sign-up
  App gate  → middleware coarse per-IP limit (cheap, pre-auth)
  Per-action→ service-level per-user token buckets (below)
```

| Action key | Suggested limit (per user) | Rationale |
|---|---|---|
| `auth.signin` (edge + Turnstile) | 5 / 15 min / IP | Brute-force / credential stuffing |
| `auth.signup` | 5 / hour / IP | Account creation abuse / scrypt resource protection |
| `auth.oauth` | 20 / 15 min / IP | Provider-flow abuse |
| `auth.logout` | 10 / min / user | Session-revocation abuse |
| `transaction.create` | 60 / min | Normal entry, blocks scripts |
| `budget.create` | 20 / min | |
| `report.generate` | 10 / min | Expensive aggregation → also queued |
| `csv.import` | 5 / hour | Heavy; large payload |
| `file.upload` | 20 / hour | Storage abuse |
| `settings.change` | 10 / hour | Account takeover defense |
| `admin.action` | 100 / min + audit | High but tracked |
| `api.v1.*` (future) | per-key quota + burst | Public API fairness |

**Abuse/bot/brute-force:**
- Cloudflare Bot Fight Mode + Turnstile (CAPTCHA) on auth and high-value forms.
- Application per-IP auth limits; Redis is required before horizontal scaling so limits remain global.
- Current code uses the in-memory limiter, so multi-node deployment is forbidden
  until the Redis implementation is installed; otherwise credential limits are
  per-process and can be bypassed across nodes.
- Request size limits at IIS (`maxAllowedContentLength`) + app body cap + Zod max-length on all strings/arrays.
- Anomaly flags (failed-auth spikes, rapid creates) surface in admin Abuse Monitoring; manual block list keyed by user/IP.
- Idempotency keys on mutating Route Handlers (mobile/public API) to prevent replay.

---

## 14. Logging & Audit Logging Design

**Two streams:**

1. **Operational logs** (structured JSON via logger):
   - Always include `requestId`, `userId` (if any), `route`, `latency`, `status`, `outcome`.
   - **Redaction middleware** strips/masks: money amounts, account numbers, emails, tokens, full request bodies. Log *that* a transaction was created, never its amount.
   - Levels: `error` (alerting), `warn` (abuse/authz denials), `info` (lifecycle), `debug` (dev only).
   - Ship to file + future centralized sink (e.g. Loki/ELK/Datadog).

2. **Audit log** (`AuditLog` table — business/security record of truth):
   - Written for: all mutations, all admin actions, role/permission changes, settings changes, auth-sensitive events.
   - Fields: actor, target, action, resourceType/Id, redacted metadata (JSON), ip, userAgent, requestId, timestamp.
   - **Append-only**: no update/delete from app code; admins can read/filter/export (export gated + itself audited).
   - Indexed by actor/target/action + time for the admin viewer.

**Alerting:** thresholds on failed-auth rate, 5xx rate, rate-limit rejections, INFECTED uploads, admin destructive actions → notify ops.

---

## 15. Error Handling Strategy

```
AppError (base)
 ├─ AuthError        → 401   "Not authenticated"
 ├─ ForbiddenError   → 403   "Not allowed"
 ├─ ValidationError  → 422   { fieldErrors }   (from Zod)
 ├─ NotFoundError    → 404   "Not found"
 ├─ RateLimitError   → 429   "Too many requests" (+ retryAfter)
 └─ ConflictError    → 409
```

- Services return a **`Result<T, AppError>`** (or throw typed `AppError`); never leak raw exceptions/stack traces to the client.
- Server Actions return a discriminated union `{ ok: true, data } | { ok: false, error }` for safe client handling.
- Route Handlers map `AppError` → JSON `{ error: { code, message } }` with correct status; unknown errors → generic `500 "Internal error"` + full detail logged server-side with `requestId`.
- The client shows the user the `message` and the `requestId` ("contact support with ID …") — never internals.
- A top-level error boundary + `instrumentation.ts` captures unhandled errors to the logger.

---

## 16. Environment Variable Structure

Validated at boot via `src/server/config/env.ts` (Zod) — app **refuses to start** if invalid. Never import `process.env` directly elsewhere; import the typed `env`.

```ts
// env.ts (shape)
const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),               // sqlserver://...  (later postgres://)
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_GRAPH_VERSION: z.string().optional(),
  // future / optional
  REDIS_URL: z.string().url().optional(),
  STORAGE_DRIVER: z.enum(['local','s3','r2']).default('local'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['error','warn','info','debug']).default('info'),
});
export const env = Env.parse(process.env);
```

`.env.example` documents every key (no values). Secrets remain server-only. Rotate JWT, OAuth, and DB secrets on a schedule and on incident.

---

## 17. Production Deployment Checklist

**Pre-deploy**
- [ ] `npm ci` with committed lockfile; `npm audit` clean of high/critical.
- [ ] `tsc --noEmit`, lint, tests, `prisma validate` pass in CI.
- [ ] `env.ts` validates against production env; no missing secrets.
- [ ] `prisma migrate deploy` run against `Finance` (reviewed migration).
- [ ] Default roles/permissions/currencies seeded.

**Server hardening**
- [ ] Node app runs as least-privilege Windows service account, bound to `127.0.0.1:3000`.
- [ ] IIS ARR reverse proxy: HTTPS only, HSTS, `maxAllowedContentLength` set, X-Forwarded-* configured.
- [ ] Firewall allows inbound 443 **only from Cloudflare IPs**; Authenticated Origin Pulls on.
- [ ] Cloudflare: WAF managed rules, rate-limit rules, Bot Fight, Turnstile, cache rules for `_next/static`.
- [ ] SQL Server: TDE enabled, dedicated DB login with least privilege (no `sa`), TLS forced, not internet-exposed.

**App config**
- [ ] Security headers + CSP active and tested (report-only first).
- [ ] Rate limiter enabled; admin routes role-gated and verified.
- [ ] Logging shipping + redaction verified (grep logs for amounts/emails = none).
- [ ] Error pages show no stack traces; `requestId` surfaced.

**Backup & recovery**
- [ ] Nightly full + frequent transaction-log backups; tested **restore** (not just backup).
- [ ] Backups encrypted, off-box + offsite, retention policy set.
- [ ] Documented RTO/RPO; runbook for restore.

**Observability & IR**
- [ ] Health check endpoint + uptime monitor.
- [ ] Alerts on 5xx, auth-failure spikes, rate-limit surges, infected uploads.
- [ ] Incident response runbook: who, how to rotate JWT/OAuth secrets, increment session versions, isolate, communicate.

---

## 18. Scalability Roadmap

| Stage | Trigger | Change (interfaces unchanged) |
|---|---|---|
| **0 — Monolith** | Launch | Single Node + IIS + SQL Server. In-memory cache/limiter/queue (inline). |
| **1 — Cache/limit** | Multi-instance or load | Introduce **Redis**: swap `MemoryRateLimiter`→`RedisRateLimiter`, `MemoryCache`→`RedisCache`. Cache dashboard summaries. |
| **2 — Background worker** | Slow reports / recurring / OCR | Move `queue` from inline to **real queue (BullMQ/SQS)** + separate worker process. Recurring txns, report generation, virus scans, OCR run async. |
| **3 — Object storage** | Receipts at scale | `StorageDriver` local→**S3/R2** with pre-signed URLs; bytes never touch app node. |
| **4 — Horizontal app** | Traffic | Multiple stateless Node nodes behind Cloudflare LB; signed sessions + Redis for shared limits/cache. |
| **5 — Read replicas** | Read-heavy dashboards | Route read queries to SQL Server replicas via a read/write-split repository; writes to primary. |
| **6 — Service extraction** | A module needs independent scale/team | Extract a module (e.g. `reports`, `ai-insights`) behind its existing **service interface** as an HTTP/gRPC service; the Prisma adapter becomes a client adapter. Public interface unchanged. |
| **7 — Platform services** | Product growth | OCR, AI insights, public API gateway, mobile BFF — added as consumers of the same service layer. |

Because callers depend on **service interfaces + DTOs**, every stage is an *implementation swap behind a stable seam*, never a rewrite.

---

## 19. Future PostgreSQL Migration Strategy

**Why it's low-risk by design:** Prisma abstracts the dialect; money is `Decimal`; IDs are cuid; timestamps are UTC; no T-SQL stored procs or SQL-Server-only types in app logic; raw SQL is avoided.

**Steps**
1. Add a `provider = "postgresql"` datasource variant; point `DATABASE_URL` to Postgres in a staging env.
2. Regenerate migrations for Postgres (fresh baseline) — review `Decimal(19,4)`→`numeric`, `NVarChar(Max)`→`text`/`jsonb` mappings.
3. **Data migration**: ETL job (or `pgloader`-style export/import) copying tables in FK order; verify row counts + checksums; reconcile Decimal precision.
4. Run app test suite + a read/write smoke against Postgres staging.
5. Cutover: freeze writes briefly, final delta sync, flip `DATABASE_URL`, deploy, verify, keep SQL Server as warm rollback.
6. Post-migration: re-tune indexes for Postgres planner; consider `jsonb` for `metadata`/`settings` columns.

**Guardrails to keep portability:** ban raw T-SQL in modules (lint/code-review rule); keep all DB access through repositories; treat JSON columns as opaque strings in app code; CI could run the test suite against both providers before the migration is ever needed.

---

## 20. Final Architecture Critique

**Strengths**
- Clear, enforced layering (app → modules → infra) with service interfaces + DTOs makes future service extraction and the Postgres migration genuinely low-risk.
- Security is layered and server-authoritative; ownership is enforced in queries (kills IDOR), not after the fact.
- Every "future" concern (Redis, queue, storage, replicas) is already an abstraction with a trivial in-process implementation — no premature complexity, no future rewrite.

**Risks / watch-items**
- **SQL Server + Prisma** has sharper edges than Postgres (e.g. some `Decimal`/`NVarChar(Max)` and migration quirks). Validate the schema early and keep raw SQL out — this is the main portability risk.
- **Discipline dependency:** the whole model collapses if a Server Action calls Prisma directly or skips the auth→authz→zod→service chain. Enforce with lint boundary rules, a shared action wrapper, and code review; consider a single `defineAction()` helper that bakes in auth/authz/zod/rate-limit/audit so it can't be forgotten.
- **Audit log growth** will be large; plan partitioning/archival early (it's append-only, so it's archive-friendly).
- **CSP with Tailwind** needs `'unsafe-inline'` for styles initially; tighten with nonces/hashes over time.
- **In-memory rate limiter/cache** are correct only for a single node — moving to multi-node *requires* the Redis swap (Stage 1) before horizontal scaling, or limits become per-node and ineffective.

**Recommended first build order**
1. Env validation + Prisma schema + local credential/OAuth authentication.
2. The `defineAction()` wrapper (auth→authz→zod→rate-limit→audit→service) — get the seam right once.
3. Accounts + Transactions vertical slice end-to-end (proves the whole stack).
4. RBAC + admin shell + audit viewer.
5. Budgets, goals, recurring, reports (with caching), attachments (storage abstraction, local driver).
6. Harden: headers/CSP, rate limits, logging redaction, backups, deployment checklist.

**Bottom line:** This is the right altitude — a disciplined modular monolith with stable seams. The architecture's success depends less on the diagrams and more on *enforcing* the request chain and the module boundaries in code. Bake those into a shared wrapper and lint rules, and "scale later without a rewrite" becomes real rather than aspirational.
```
