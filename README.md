# EntraSave

EntraSave is a responsive personal-finance application built with a React/Vite
client, a Node/Express API, Prisma, and SQL Server.

Project guidance:

- [AGENTS.md](AGENTS.md)
- [CODING_STANDARDS.md](CODING_STANDARDS.md)
- [SECURITY.md](SECURITY.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Features

- Credential, Google, and Facebook sign-in
- Account creation, editing, opening balances, archiving, and deletion
- Income, expense, and transfer transactions
- Transaction editing, deletion, monthly navigation, and category filtering
- Manual monthly starting balances
- Ordered categories and monthly category budgets
- Near/over-budget alerts
- Dashboard month/year summaries and current-year trend
- Profile, currency, and theme preferences
- Responsive desktop and mobile navigation and dialogs

## Structure

```text
client/   React 19, React Router, Vite, Tailwind CSS
server/   Express, Zod, Prisma, SQL Server
docs/     Architecture documentation
```

The API is the trust boundary. The client never receives the session JWT and
does not make authorization decisions.

## Requirements

- Node.js 20.11 or newer
- SQL Server reachable through `DATABASE_URL`
- A configured `server/.env` based on `server/.env.example`

## Install and run

From the repository root:

```powershell
npm run install:all
npm run prisma:generate --prefix server
npm run dev
```

Default development addresses:

- Client: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/health

The Vite development server proxies `/api` to the Express server.

For a new database:

```powershell
npm run prisma:deploy --prefix server
npm run db:seed --prefix server
```

## Verification

```powershell
npm run typecheck
npm run lint
npm run build
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for request flow, domain
boundaries, and deployment constraints.
