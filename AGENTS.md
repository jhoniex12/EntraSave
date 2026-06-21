# AGENTS.md

Operating guide for AI agents and contributors working in this repository.
Read this **before** writing code. The authoritative design is
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); this file is the short, enforceable
rule set. When in doubt, prefer the stricter interpretation.

EntraSave is the **React (Vite SPA) + Node/Express (API)** port of the original
Next.js application. The architecture, security model, and all `§N` references
are unchanged — only the framework mechanics differ (see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §0a for the full translation table).
The repository is two folders:

- **`server/`** — the Express API. All business logic, persistence, auth, RBAC,
  audit, and security live here. `@/*` → `server/src/*`.
- **`client/`** — the React SPA. Presentation only; it calls the API over HTTP.
  `@/*` → `client/src/*`.

---

## 1. The one rule that matters most

Every mutation flows through **exactly one path** on the server, and it is never
shortened:

```
React component (client/)
  → fetch POST /api/<feature>/<action>   (cookies: include)
    → routes/<feature>.routes.ts          // URL wiring only
      → controllers/<feature>.controller.ts (thin) | OAuth handler (external only)
        → defineRoute()    // protected: auth → RBAC → rate limit → Zod → ownership → audit
          → services/<feature>.service.ts  // ALL business logic lives here
            → repositories/<feature>.repository.ts  (interface)
              → repositories/<feature>.prisma.ts    // ONLY place Prisma is imported
                → SQL Server
              ← DTO (never an entity)
```

If you are tempted to skip a layer, **stop**. The skip is the bug.

The server uses a **layer-based (horizontal) layout** —
`routes/ controllers/ services/ repositories/ dto/ schemas/ utils/ config/
middleware/` — one file per feature in each layer (e.g. `account.controller.ts`,
`account.service.ts`, `account.repository.ts`). Authentication has two deliberate
entrypoint variants, both preserving the same controller/service/repository
boundaries:

- Credential sign-in/sign-up uses `defineRoute({ authentication: 'public', ... })`
  with a mandatory per-IP auth rate limit and Zod schema. It never accepts RBAC,
  ownership, or authenticated audit configuration.
- Google/Facebook OAuth start/callback handlers are external protocol boundaries
  (`server/src/controllers/oauth.controller.ts`). They validate provider, signed
  state, callback data, and returned tokens before calling `authService`;
  provider tokens never enter the React client or a DTO.

---

## 2. Hard constraints (lint-enforced where marked ⛔)

> ⛔ rules below are enforced by ESLint ([server/.eslintrc.json](server/.eslintrc.json))
> and fail `npm run lint` in `server/`. The rest are review-enforced — keep them anyway.

1. ⛔ **Prisma is imported only in `repositories/*.prisma.ts`,
   `server/src/config/prisma.ts`, `server/src/repositories/rbac.repository.ts`,
   `server/src/services/audit.service.ts`, and `prisma/seed.ts`.** Never in
   controllers/routes, other services, or the client.
   (`@prisma/client` *type* imports via `import type` are allowed everywhere.)
2. **No business logic in controllers (`controllers/*.controller.ts`), routes, or
   React components.** They orchestrate; services decide.
3. **Every mutating/owned endpoint is created with `defineRoute()`** from
   [server/src/utils/define-route.ts](server/src/utils/define-route.ts). No
   hand-rolled handlers that call services directly (the OAuth protocol handlers
   and the session-bootstrap `/me` are the only reviewed exceptions, and they
   still call `requireAuth` / services, never Prisma).
4. **Every user-owned query is scoped by `userId` in the `where` clause** at the
   repository layer — never filter ownership in JS after fetching.
5. **Money is `Decimal(19,4)` in the DB and a `string` in DTOs.** Never `Float`,
   never a JS `number` for money. No `parseFloat` on money anywhere.
6. ⛔ **Read `process.env` only in [server/src/config/env.ts](server/src/config/env.ts).**
   Everywhere else import the typed `env`.
7. **Services return DTOs, not Prisma entities.** Entities never cross the
   service boundary toward the API/client.
8. **The client never imports from `server/`.** The only contract between them is
   the HTTP API + the `ActionResult<T>` JSON shape.
9. **JWTs are accepted only through `verifySessionToken()` and the
   `entrasave_session` HttpOnly cookie.** Never decode-and-trust a JWT, read it in
   client JavaScript, add authorization claims to it, or accept it from query
   parameters/local storage.
10. **Passwords are handled only by `server/src/utils/password.ts`.** Never
    log, return, audit, cache, compare directly, or persist plaintext credentials.
11. **OAuth identities are linked only after backend token verification.** Email
    auto-linking requires an already provider-verified local email. Never link on
    an unverified email or client-supplied provider profile. The sole exception
    is a credential-less legacy row where password and both provider ids are null.
12. **Auth identifiers retain DB guarantees:** `email` is unique; non-null
    `googleId` and `facebookId` are enforced by SQL Server filtered unique indexes.
    Do not replace those with ordinary Prisma nullable `@unique` constraints.

---

## 3. Where things go

| You are adding… | Put it in |
|---|---|
| Input validation | `server/src/schemas/<feature>.schema.ts` (Zod) |
| An API response shape | `server/src/dto/<feature>.dto.ts` (+ `toXDTO` mapper) |
| A repository seam | `server/src/repositories/<feature>.repository.ts` (interface) |
| A DB query | `server/src/repositories/<feature>.prisma.ts` (implements the interface) |
| Business logic | `server/src/services/<feature>.service.ts` |
| A controller (policy + handler) | `server/src/controllers/<feature>.controller.ts` (via `defineRoute`) |
| URL wiring | `server/src/routes/<feature>.routes.ts` (+ mount in `routes/index.ts`) |
| Credential/session/OAuth controllers | `server/src/controllers/{auth,oauth}.controller.ts` |
| JWT, cookies, password, OAuth protocol, crypto | `server/src/utils/` |
| Cross-cutting infra (logger, ratelimit, errors) | `server/src/utils/` |
| Boot/config (env, prisma client) | `server/src/config/` |
| Express middleware | `server/src/middleware/` |
| A page/screen/component | `client/src/...` (presentation only) |

### Feature file pattern (server/, one file per feature per layer)
```
schemas/<feature>.schema.ts          Zod input schemas + inferred types
dto/<feature>.dto.ts                 DTO types + entity→DTO mappers
repositories/<feature>.repository.ts interface (the stable seam)
repositories/<feature>.prisma.ts     Prisma adapter (only Prisma import)
services/<feature>.service.ts        business logic; depends on the interface
controllers/<feature>.controller.ts  thin defineRoute handlers (policy + delegate)
routes/<feature>.routes.ts           URL → controller wiring; mounted in routes/index.ts
```

### Cross-feature rule
A feature may import **another feature's public service + DTOs only** — never its
repository, schema internals, or Prisma adapter. Example: transactions call
`accountService.assertOwned(...)`, not the account repository.

---

## 4. Adding a feature — checklist

- [ ] Schema: every string length-bounded; money as a regex-validated string.
- [ ] DTO: no `userId`/`deletedAt`/internal fields; money serialized to string.
- [ ] Repository interface: every owned-domain method takes `userId`; authentication
      lookups instead take normalized email/provider ids and return minimal records.
- [ ] Prisma adapter: `where` always includes `userId` (+ `deletedAt: null`);
      use `updateMany`/`deleteMany`-style ownership in the WHERE, not `update(byId)`.
- [ ] Service: receives `ctx` + validated input; returns DTOs; no request reads.
- [ ] Controller: `defineRoute({ name, permission, rateLimit, schema, ownership?, handler, audit })`.
- [ ] Route file wires URL → controller and is mounted in
      [server/src/routes/index.ts](server/src/routes/index.ts).
- [ ] Permission key seeded in [prisma/seed.ts](server/prisma/seed.ts) and granted
      to the right roles.
- [ ] Rate-limit policy added to `RATE_LIMITS` in
      [server/src/utils/ratelimit/index.ts](server/src/utils/ratelimit/index.ts).
- [ ] Audit metadata is **redacted** (ids/types only, never money/PII).
- [ ] Client re-fetches affected views after a successful mutation.

### Authentication change checklist

- [ ] Credential routes use public `defineRoute()` mode and `auth.signin`/
      `auth.signup` per-IP rate limits; protected session routes use normal mode.
- [ ] Session cookies remain `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure`
      outside local development; logout increments `sessionVersion` and expires it.
- [ ] JWT verification pins `HS256`, issuer, audience, expiry, maximum lifetime,
      and session version; RBAC remains database-backed and is never copied into JWTs.
- [ ] Google flow retains state + PKCE + nonce and verifies the returned ID token.
- [ ] Facebook flow retains state, `debug_token`, app-id/expiry checks, identity
      matching, and `appsecret_proof` for profile retrieval.
- [ ] OAuth state cookies remain signed, HttpOnly, short-lived, provider/path
      scoped, and are cleared on callback success or failure.
- [ ] Post-OAuth redirects target `CLIENT_URL` and accept only local return paths.
- [ ] No password, JWT, OAuth code/token, client secret, or email is written to
      operational logs or audit metadata.
- [ ] Auth schema changes preserve filtered unique provider indexes and include a
      reviewed migration. Never edit an already-applied migration.

---

## 5. Things that are NOT in the foundation yet

Do not invent these ad hoc — follow the architecture when the time comes:
Redis cache/limiter, email delivery/password reset/email-password verification,
MFA/recovery codes, background worker/queue, file storage (S3/R2), OCR/AI,
public/mobile API, read replicas, remaining domain models (SavingsGoal,
RecurringTransaction, Attachment, Setting, Notification, Currency, ExchangeRate).
Each already has a documented seam in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 6. Verification before you call it done

In `server/`:
```
npm run typecheck
npm run lint
npm run build        # includes prisma generate
```
In `client/`:
```
npm run typecheck
npm run build
```
For schema changes: `npx prisma migrate dev --name <change>` (in `server/`) and
confirm the generated SQL only does what you intended. Never edit a committed
migration.

See [SECURITY.md](SECURITY.md) for the security rules and
[CODING_STANDARDS.md](CODING_STANDARDS.md) for style and conventions.
