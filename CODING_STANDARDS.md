# CODING_STANDARDS.md

Conventions for writing code in this repository. Pairs with
[AGENTS.md](AGENTS.md) (architecture rules) and [SECURITY.md](SECURITY.md)
(security rules). These are about *how the code reads*; those are about *what it
must do*.

EntraSave is the React + Express port of the original Next.js app; see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §0a for the framework translation
table. `server/` is the Express API; `client/` is the React SPA.

---

## 1. Language & TypeScript

- **TypeScript strict** is on, including `noUncheckedIndexedAccess`. Handle the
  `T | undefined` you get from indexing/`.at()`; don't `!`-assert it away.
- **No `any`.** Use `unknown` at boundaries and narrow with Zod or type guards.
- **No `as` to launder untrusted data.** Parse it (Zod) instead. `as const` and
  narrowing casts for known-safe values are fine.
- Prefer **`type`** for unions/DTOs, **`interface`** for object contracts that
  may be implemented (e.g. repositories). Match the surrounding file.
- Use the `@/*` path alias for in-app imports (`server/src/*` in the API,
  `client/src/*` in the SPA); no deep relative `../../../`.
- Functions and exported types are explicitly typed at the boundary; rely on
  inference for locals.

---

## 2. File & naming conventions

| Thing | Convention | Example |
|---|---|---|
| Module files | `kebab.purpose.ts` | `transaction.service.ts` |
| Service class | `PascalCase` + singleton export | `class AccountService` → `accountService` |
| Repository interface | `XRepository` | `TransactionRepository` |
| Prisma adapter | `*.prisma.ts`, class `PrismaXRepository` | `account.prisma.ts` |
| DTO type / mapper | `XDTO` / `toXDTO()` | `AccountDTO`, `toAccountDTO()` |
| Zod schema / type | `XSchema` / inferred `XInput` | `CreateAccountSchema`, `CreateAccountInput` |
| Controller | `controllers/<f>.controller.ts`, exported `defineRoute` handlers | `account.controller.ts` → `createAccount` |
| Route module | `routes/<f>.routes.ts`, exports `xRoutes` Router | `account.routes.ts` → `accountRoutes` |
| OAuth provider | lowercase union | `'google' \| 'facebook'` |
| Auth environment key | provider prefix | `GOOGLE_CLIENT_ID` |
| Permission key | `resource.verb` | `transactions.write` |
| React component | `PascalCase.tsx` | `TransactionForm.tsx` |
| Constants | `SCREAMING_SNAKE_CASE` | `RATE_LIMITS`, `MAX_PAGE_SIZE` |

The server is **layer-based**: `routes/ controllers/ services/ repositories/
dto/ schemas/ utils/ config/ middleware/`, one file per feature in each layer.
One service / one repository per feature. Keep files focused; if a service grows
past comfortable reading, split by use-case group, not by arbitrary line count.

---

## 3. Server vs client code

- **The API (`server/`) is the trust boundary.** All auth, authorization,
  validation, and business logic run there. The React client is never trusted.
- **Controllers (`controllers/*.controller.ts`) export thin `defineRoute`
  handlers**; **routes (`routes/*.routes.ts`) only wire URL → controller**. No
  business logic, no Prisma in either.
- The client receives **DTOs** as JSON, never Prisma entities or `ctx`.
- The client never receives JWTs, password hashes, OAuth codes/tokens, provider
  secrets, or signed OAuth-flow cookie values. The session is an `HttpOnly`
  cookie sent automatically with `credentials: 'include'`.
- React components are **presentation + local state**. Data access goes through
  the typed API client ([client/src/lib/api.ts](client/src/lib/api.ts)); no
  component talks to `fetch` directly with ad-hoc URLs.

---

## 4. Functions, errors & control flow

- **Throw typed `AppError`s** from services
  ([app-error.ts](server/src/utils/app-error.ts)); let `defineRoute` map
  them to a safe `ActionResult` + HTTP status. Don't return ad-hoc error objects.
- Guard clauses over nested `if`/`else`. Validate/early-return at the top.
- No silent `catch {}` — handle, rethrow, or log with context. The one exception
  is the audit writer, which intentionally swallows (logging the failure) so it
  never breaks the user operation.
- Keep handlers in `controllers/*.controller.ts` to **one logical statement**:
  declare policy, call the service, return. Logic belongs in the service.
- OAuth handlers orchestrate protocol I/O only: parse provider/callback, enforce
  rate limit, delegate verification/service work, set/clear cookies, and redirect
  to `CLIENT_URL`. Account creation/linking decisions remain in `AuthService`.

---

## 5. Data, money & dates

- Money: `Decimal(19,4)` in Prisma, **`string`** in DTOs/transport, validated by
  a decimal regex in Zod. Never `number`/`Float`/`parseFloat` for money.
- Timestamps are **UTC**; DTOs serialize dates with `.toISOString()`.
- Pagination is **keyset/seek** for owned lists (opaque cursor), not `OFFSET`.
  Page size is clamped via [pagination.ts](server/src/utils/pagination.ts).
- Repository `where` always includes `userId` (and `deletedAt: null` for
  soft-deletable models). Use `updateMany`/`deleteMany` so ownership lives in the
  WHERE; never `update({ where: { id } })` on owned rows.

---

## 6. Zod schemas

- Bound every string (`.max(...)`) and collection; reject rather than truncate.
- Coerce deliberately (`z.coerce.date()`), not pervasively.
- Export both the schema and the inferred input type; services consume the type.
- Keep schemas free of business rules that need the DB (those go in the service).
- The API parses every request body with Zod inside `defineRoute` before a
  service ever sees it. Because the client and server are separate apps, the
  server schema is the **single authoritative** validation; client-side checks
  are UX only and never relied upon.

---

## 7. Authentication and cryptography

- Normalize emails once at the schema boundary with trim + lowercase; preserve
  the SQL Server unique constraint as the final concurrency guarantee.
- Password inputs are 12–128 characters. Hash and verify only through
  [password.ts](server/src/utils/password.ts); the encoded hash must carry
  its algorithm and work factors so future upgrades are explicit.
- Authentication failures use generic client messages. Logs may contain internal
  user ids and provider names, never email addresses, passwords, hashes, JWTs,
  OAuth codes/tokens, state values, or secrets.
- Sign JWTs and OAuth state with the typed secret from `env.ts`. Pin algorithms
  and claims explicitly; never select a crypto algorithm from untrusted input.
- Cookie mutations stay in `session-cookie.ts` / `oauth.routes.ts`. Production
  session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, bounded by
  the configured TTL, and cleared with the same path/attributes.
- JWT claims are identity/session data only (`sub`, `sv`, issuer, audience,
  timestamps, `jti`). Roles and permissions are loaded from SQL Server on every
  protected server boundary (`requireAuth`).
- OAuth callback URLs are derived from `APP_URL`, not request headers. Post-auth
  redirects target `CLIENT_URL` and accept only local paths beginning with one
  `/`; reject protocol-relative URLs.
- Provider responses are untrusted JSON: check HTTP status, parse with Zod, and
  verify signature/token validity, audience/app id, issuer where applicable,
  expiry, nonce/state, and provider user-id consistency before persistence.
- Email auto-linking requires `emailVerifiedAt`, except for a credential-less
  legacy row where `passwordHash`, `googleId`, and `facebookId` are all null.
- Do not invent password reset, email verification, MFA, token refresh, or account
  linking flows inside unrelated features. Add them as explicit auth use cases
  with schemas, rate limits, audit design, migrations, and threat-model updates.

---

## 8. Imports & dependency direction

Allowed direction only (in `server/`): `routes/` → `controllers/` → `services/`
→ `repositories/` → `config/prisma`. Schemas, DTOs, and `utils/` are leaf layers
imported as needed; inner layers never import from `routes/` or `controllers/`.
A feature imports another feature's **public service + DTO** only — never its
repository or schema internals. Prisma is imported solely in the files listed in
[AGENTS.md](AGENTS.md) §2. The `client/` never imports from `server/`.

---

## 9. Comments & documentation

- Comment the **why**, not the **what**. A short header on each non-trivial file
  stating its role and the relevant `docs/ARCHITECTURE.md` section is expected
  (see existing files for the house style).
- Reference architecture sections (`§N`) where a rule originates, so reviewers
  can trace intent.
- No commented-out code in commits; delete it (git remembers).

---

## 10. React / UI

- Tailwind utility classes; shared primitives under `client/src/components/`
  (no business logic in components).
- Forms call the API client and render the typed `ActionResult` — show
  `error.message` (+ `requestId` for support), never raw errors.
- Auth forms use the sign-in/sign-up endpoints and server-generated OAuth start
  URLs (`/api/auth/oauth/<provider>`). Do not add browser-side provider SDKs or
  store auth state in local/session storage; rely on the HttpOnly cookie + `/me`.
- Keep accessibility basics: labelled inputs, semantic elements, keyboard-usable.
- **Modals / popovers / dropdowns render through a portal to `document.body`**
  (`createPortal`), never as a `position: fixed` child of a card or list item. A
  `transform`, `filter`, or `backdrop-filter` on any ancestor makes `fixed`
  resolve against that ancestor (not the viewport), and `overflow-hidden` then
  clips the overlay. Give overlays backdrop-click + `Escape` to close and
  `role="dialog"` / `aria-modal`.

---

## 11. Tooling & commits

- Before pushing: in `server/` run `npm run typecheck && npm run lint &&
  npm run build`; in `client/` run `npm run typecheck && npm run build`.
- Schema changes ship with a reviewed migration (`prisma migrate dev`); never
  edit a committed migration — add a new one.
- Authentication changes additionally require review of cookie flags, JWT claim
  validation, OAuth redirect URIs, rate limits, account-linking rules, CORS
  origin/credentials config, and secret redaction.
- Small, focused commits with imperative messages describing intent.
- Match the existing code's idiom and comment density when editing a file.
