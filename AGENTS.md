# EntraSave Agent Guide

This repository is the authoritative EntraSave application. Treat it as a
standalone product; no other project is a source of truth for its behavior,
design, or architecture.

Read this file before changing code. Detailed design lives in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), implementation conventions in
[CODING_STANDARDS.md](CODING_STANDARDS.md), and security requirements in
[SECURITY.md](SECURITY.md).

## Repository shape

- `client/`: React 19, React Router, Vite, Tailwind CSS.
- `server/`: Node.js, Express, Zod, Prisma, SQL Server.
- `server/prisma/`: schema, migrations, and RBAC seed data.
- `docs/`: architecture and operating documentation.

The browser and API are separate trust zones. The client handles presentation,
navigation, forms, and local interaction state. The server owns authentication,
authorization, validation, business rules, money calculations, persistence,
rate limiting, and audit records.

## Mandatory server flow

Every protected API operation follows this path:

```text
React page/component
  -> client/src/lib/endpoints.ts
  -> POST /api/<resource>/<action>
  -> route
  -> controller using defineRoute()
  -> service
  -> repository interface
  -> Prisma repository
  -> SQL Server
```

Do not skip layers.

- Routes only map URLs to controllers.
- Controllers declare policy and delegate.
- Services contain business rules and compose use cases.
- Repository interfaces define persistence seams.
- `*.prisma.ts` files implement database access.
- DTOs are the only server response shapes exposed to the client.

OAuth protocol handlers are the reviewed exception to `defineRoute()`. They
handle provider redirects and token verification, then delegate account/session
decisions to `authService`.

## Non-negotiable rules

1. Import Prisma only in `repositories/*.prisma.ts`,
   `config/prisma.ts`, `repositories/rbac.repository.ts`,
   `services/audit.service.ts`, and `prisma/seed.ts`.
2. Scope every user-owned database operation by `userId` in the query.
3. Store money as `Decimal(19,4)`; transport money as strings. Never use
   floating-point arithmetic for persisted money.
4. Parse every request body with Zod before it reaches a service.
5. Return DTOs, never Prisma entities or internal ownership fields.
6. Use the `entrasave_session` HttpOnly cookie. Never expose JWTs to browser
   JavaScript or store them in local/session storage.
7. Keep RBAC database-backed. Do not put roles or permissions in JWT claims.
8. Never log or audit passwords, hashes, session tokens, OAuth tokens/codes,
   email addresses, raw request bodies, or money amounts.
9. Read environment variables only through `server/src/config/env.ts`.
10. The client must use `client/src/lib/api.ts` and
    `client/src/lib/endpoints.ts`; do not scatter ad-hoc `fetch` calls.
11. Preserve responsive behavior. Authenticated mobile pages include the fixed
    bottom navigation and safe-area padding; dialogs must remain usable at
    narrow widths and short viewport heights.
12. Preserve user changes in a dirty workspace. Do not reset or overwrite
    unrelated work.

## Current product surface

- Credential, Google, and Facebook authentication.
- Versioned server sessions and profile management.
- Accounts with opening balances, archiving, and deletion.
- Income and expense transactions.
- Monthly starting-balance overrides.
- Transaction editing, deletion, category filtering, and monthly navigation.
- Ordered income/expense categories.
- Monthly category budgets and near/over-budget alerts.
- Base-currency preference and light/dark/system theme.
- Dashboard month/year summaries, category summary, current-year trend,
  recent activity, and account balances.
- Responsive desktop and mobile navigation and dialogs.
- Privacy, terms, cookies, and data-deletion pages.

Do not document unimplemented features as if they exist.

## Where changes belong

| Change | Location |
|---|---|
| Request validation | `server/src/schemas/<feature>.schema.ts` |
| API response contract | `server/src/dto/<feature>.dto.ts` |
| Persistence interface | `server/src/repositories/<feature>.repository.ts` |
| Prisma query | `server/src/repositories/<feature>.prisma.ts` |
| Business rule/use case | `server/src/services/<feature>.service.ts` |
| Endpoint policy | `server/src/controllers/<feature>.controller.ts` |
| URL mapping | `server/src/routes/<feature>.routes.ts` |
| Client transport contract | `client/src/lib/types.ts` and `endpoints.ts` |
| Shared UI | `client/src/components/` |
| Route-level UI | `client/src/pages/` |
| Global responsive/theme CSS | `client/src/index.css` |
| Database change | `server/prisma/schema.prisma` plus a new migration |

Cross-feature server code may call another feature's public service and use its
DTOs. It must not reach into another feature's repository implementation.

## Database changes

- Create a new migration; never edit an applied migration.
- Review generated SQL, especially SQL Server cascade paths and filtered unique
  indexes for nullable OAuth provider IDs.
- Keep month values zero-based where the current API/schema uses zero-based
  months.
- Preserve soft-delete filters and ownership indexes.
- Update DTOs, schemas, repositories, client types, and documentation together.

## UI changes

- Reuse existing visual primitives and utility patterns.
- Keep touch targets at least 44px where practical.
- Test both below and above the `sm` breakpoint.
- Avoid horizontal page overflow. Use `min-w-0`, truncation, or contained
  scrolling at the component that owns wide content.
- Fixed mobile UI must respect `env(safe-area-inset-bottom)`.
- Modal overlays render through a portal, lock body scrolling, close on Escape,
  and remain scrollable on small screens.
- Mutations refresh every affected summary/list after success.

## Completion checks

Run from the repository root:

```powershell
npm run typecheck
npm run lint
npm run build
```

For a database change, also run from `server/`:

```powershell
npx prisma validate
npx prisma generate
```

Report checks that were not run or did not pass. A change is not complete while
known type, build, migration, or security regressions remain.
