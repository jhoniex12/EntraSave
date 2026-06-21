# EntraSave Coding Standards

These standards describe the codebase as it exists today. Architecture rules are
in [AGENTS.md](AGENTS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md);
security rules are in [SECURITY.md](SECURITY.md).

## TypeScript

- Keep strict TypeScript enabled in both packages.
- Do not introduce `any`. Use `unknown` at boundaries and narrow it.
- Do not use casts to bypass validation. Parse untrusted values with Zod.
- Handle indexed values that may be `undefined`; avoid non-null assertions.
- Use `import type` for type-only imports.
- Use the `@/*` alias inside each package.
- Type exported functions, DTOs, service methods, and repository contracts.
  Allow inference for straightforward local values.
- Prefer discriminated unions for finite state and error/result variants.

## Naming and files

| Item | Convention | Example |
|---|---|---|
| Server module | `<feature>.<layer>.ts` | `transaction.service.ts` |
| Prisma adapter | `<feature>.prisma.ts` | `account.prisma.ts` |
| Repository interface | `XRepository` | `BudgetRepository` |
| Service class/singleton | `XService` / lower camel export | `DashboardService`, `dashboardService` |
| DTO | `XDTO` | `TransactionDTO` |
| Zod schema | `XSchema` | `CreateAccountSchema` |
| React component | PascalCase symbol | `CategorySummary` |
| Client page file | lowercase kebab case | `manage-account.tsx` |
| Permission | `resource.verb` | `transactions.write` |
| Constants | `SCREAMING_SNAKE_CASE` | `ACCOUNT_TYPES` |

Keep one feature per server file and keep page-only components near their page
until they are reused. Move genuinely shared UI to `client/src/components/`.

## Server boundaries

Dependency direction is:

```text
routes -> controllers -> services -> repository interfaces -> Prisma adapters
```

- A route file contains Express router wiring only.
- A controller is a `defineRoute()` declaration: schema, permission,
  rate-limit key, ownership hook, audit policy, and service call.
- A service owns domain decisions and coordinates repositories/services.
- A repository interface accepts scoped identifiers and returns minimal records.
- A Prisma adapter owns Prisma queries and entity-to-record mapping.
- Inner layers never import routes or controllers.
- Cross-feature calls use public services, not foreign repositories.

## API contracts and errors

- Standard API responses are `ActionResult<T>`:

  ```ts
  { ok: true, data: T }
  { ok: false, error: { code, message, requestId?, fieldErrors?, retryAfter? } }
  ```

- Throw typed `AppError` subclasses from services. Let `defineRoute()` map
  them to safe responses.
- Do not return ad-hoc error objects or expose stack traces.
- Use generic authentication failures; do not reveal whether an account exists.
- Unknown failures are logged server-side with a request ID and become a generic
  client message.
- Never silently swallow errors unless the operation is explicitly best-effort
  and the failure is safely logged (audit writing is the established example).

## Validation

- Treat all request, provider, cookie, and environment data as untrusted.
- Bound strings and arrays in Zod.
- Validate money as a decimal string.
- Keep database-dependent rules in services, not schemas.
- Use `.strict()` for request objects unless unknown keys are intentionally
  supported.
- Client validation improves UX only; server validation is authoritative.

## Money, dates, and pagination

- Database money is Prisma `Decimal` backed by SQL
  `Decimal(19,4)`.
- DTO and client money values are strings.
- Use decimal helpers or Prisma Decimal for arithmetic. Do not use
  `parseFloat`, binary floating point, or formatted currency strings in
  calculations.
- Persist timestamps in UTC and serialize them as ISO 8601 strings.
- The monthly-balance API and model use zero-based months.
- Format dates/currency only at the presentation boundary.
- Transaction lists use bounded keyset pagination where applicable.

## Persistence

- Every owned query includes `userId` in its database predicate.
- Include `deletedAt: null` for active soft-deletable records.
- Prefer ownership-safe `updateMany`/`deleteMany` operations over an ID-only
  update followed by an ownership check.
- Select only fields needed by the service.
- Avoid query-per-row loops. Use aggregates, grouping, or relation loading.
- Do not interpolate raw SQL. If raw SQL is unavoidable, use Prisma's tagged
  parameterized APIs and document why.
- Never edit a committed migration.

## React and client data access

- Route definitions live in `client/src/App.tsx`.
- Protected page chrome and mobile navigation live in
  `client/src/components/app-layout.tsx`.
- Authentication state is accessed through `useAuth()`.
- All HTTP calls go through `client/src/lib/api.ts`; feature calls are declared
  in `client/src/lib/endpoints.ts`.
- Mirror server DTO contracts in `client/src/lib/types.ts`.
- Keep server state reloading explicit after mutations.
- Use `ApiError` for server errors and show its safe message.
- Do not put authorization decisions in React. Route guards are navigation UX;
  the API remains the enforcement boundary.

## React component style

- Use function components and hooks.
- Keep hooks unconditional and before early returns.
- Derive maps/filtered collections with `useMemo` only when it improves
  stability or avoids meaningful repeated work.
- Use `useCallback` when a function is an effect dependency or passed through
  a stability-sensitive boundary.
- Forms use semantic labels, native controls, and explicit submit handlers.
- Interactive icons require accessible labels.
- Dialogs use `role="dialog"`, `aria-modal`, Escape handling, backdrop close,
  focus-visible styles, and scroll containment.
- Avoid introducing a state library until shared state exceeds the current auth,
  route, and local-page model.

## Responsive UI

- Mobile is a supported primary layout, not a desktop fallback.
- Default Tailwind classes target mobile; add `sm:`, `lg:`, etc. for larger
  layouts.
- Maintain the fixed mobile bottom navigation and safe-area padding.
- Use 44px touch targets for primary mobile controls.
- Use compact mobile tables/cards when repeated labels would make rows tall.
- Prevent page-level horizontal overflow. Wide tables may scroll inside their
  own bounded container.
- Use `min-w-0` on flex/grid children containing truncatable content.
- Keep desktop sizing and mobile sizing independently intentional.

## Styling

- Use Tailwind utilities for component styling and `client/src/index.css` for
  global theme/safe-area rules.
- Reuse the established palette: emerald for brand/income, rose for expenses or
  destructive states, amber for warnings/manual values, neutral for structure.
- Preserve dark-theme overrides when adding new surface/text/accent utilities.
- Reuse existing rounded-card, hero, summary-card, modal, and navigation
  patterns instead of creating near-duplicates.
- Keep user-provided text escaped by React; do not use
  `dangerouslySetInnerHTML`.

## Authentication and sensitive data

- Session cookies are HttpOnly, SameSite=Lax, Secure outside local development,
  and set/cleared only through the server session helpers.
- Password hashing/verification stays in `utils/password.ts`.
- JWT creation/verification stays in `utils/jwt.ts`.
- OAuth state and provider verification stay in `utils/oauth.ts` and the OAuth
  controller.
- Provider tokens, authorization codes, password values, and session tokens
  never enter DTOs, audit metadata, or operational logs.
- Roles and permissions are loaded from the database on protected requests.

## Comments and documentation

- Comment why a constraint exists, not what obvious code does.
- Keep architecture references accurate after structural changes.
- Delete obsolete comments and commented-out code.
- Update AGENTS, coding standards, architecture, README, and SECURITY when a
  change alters their documented contract.
- Do not describe planned functionality as implemented.

## Verification

From the repository root:

```powershell
npm run typecheck
npm run lint
npm run build
```

For Prisma work:

```powershell
Set-Location server
npx prisma validate
npx prisma generate
```

Review UI changes at mobile and desktop widths. Review auth, ownership, money,
and migration changes against [SECURITY.md](SECURITY.md) before completion.
