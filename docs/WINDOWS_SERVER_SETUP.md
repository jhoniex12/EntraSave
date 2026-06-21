# Deploying EntraSave on Windows Server

A step‑by‑step guide to run EntraSave on a Windows Server box: the **Node/Express API**
(SQL Server + Prisma) as a Windows service, and the **React (Vite) client** served by
**IIS**, which also reverse‑proxies `/api` to the API. This mirrors the production model in
[ARCHITECTURE.md](ARCHITECTURE.md): the SPA and API are served **same‑site** behind IIS.

> Conventions: commands are PowerShell. This guide assumes the app lives at
> `D:\apps\EntraSave` — adjust paths to taste.

---

## 0. How the pieces fit together

```
Browser ──HTTPS──> IIS (https://finance.example.com)
                     ├── /api/*  ──reverse proxy──> Node API  (http://localhost:4001)
                     └── /*      ──static files───> client\dist (React SPA)
                                                       │
                                              Node API ──> SQL Server (Prisma)
```

- The client calls the API at a **relative** `/api` path, so the browser sees one origin.
  That keeps the `entrasave_session` cookie same‑site and satisfies the server's CSRF
  origin check and CORS allowlist.
- The Node API runs TypeScript directly with `tsx` (no separate compile step) and listens
  on `localhost:4001` — it is **not** exposed to the internet directly; IIS is the front door.

---

## 1. Prerequisites

Install on the server:

1. **Node.js 20.11 LTS or newer** (x64) — https://nodejs.org. Verify:
   ```powershell
   node -v   # >= v20.11.0
   npm -v
   ```
2. **SQL Server** (2019/2022, or Express edition) reachable from this host, plus
   **SQL Server Management Studio (SSMS)** or `sqlcmd` for setup.
3. **Git** (to clone/update the code) — https://git-scm.com.
4. **IIS** with these features (Server Manager → _Add Roles and Features_ → Web Server (IIS)):
   - Web Server → Common HTTP Features (Static Content, Default Document, HTTP Errors)
   - Web Server → Health and Diagnostics (HTTP Logging)
   - Web Server → Security (Request Filtering)
5. **IIS extensions** (download from Microsoft, install with the server **not** in the middle of a request):
   - **URL Rewrite 2.1** — https://www.iis.net/downloads/microsoft/url-rewrite
   - **Application Request Routing (ARR) 3.0** — https://www.iis.net/downloads/microsoft/application-request-routing
6. **NSSM** (to run the API as a service) — https://nssm.cc/download. Unzip and put
   `nssm.exe` somewhere on `PATH` (e.g. `C:\Tools\nssm.exe`).

After installing ARR, enable the proxy once at the server level:

- Open **IIS Manager** → click the **server node** (top of the tree) →
  **Application Request Routing Cache** → _Server Proxy Settings_ (right pane) →
  check **Enable proxy** → **Apply**.

---

## 2. Get the code

```powershell
New-Item -ItemType Directory -Force D:\apps
git clone <YOUR_REPO_URL> D:\apps\EntraSave
cd D:\apps\EntraSave
```

If you copied the folder instead of cloning, make sure `node_modules` is **not** copied —
you'll install fresh in step 5.

---

## 3. Create the SQL Server database and login

Using SSMS (or `sqlcmd`), create a database and a dedicated login. Example:

```sql
CREATE DATABASE Finance;
GO

CREATE LOGIN finance_app WITH PASSWORD = 'a-strong-password-here';
GO

USE Finance;
CREATE USER finance_app FOR LOGIN finance_app;
ALTER ROLE db_owner ADD MEMBER finance_app;   -- needed so Prisma can run migrations
GO
```

Notes:

- Enable **SQL Server Authentication** (Mixed Mode) so the login above works, and make sure
  the **SQL Server** + **SQL Server Browser** services are running and TCP/IP is enabled
  (SQL Server Configuration Manager) if connecting over `localhost:1433`.
- `db_owner` is required for `prisma migrate deploy`. You can downgrade the app's rights
  after the first migration if your security policy requires it (it then only needs
  read/write/exec on the schema).

---

## 4. Configure the API environment

The API reads `server\.env` and **refuses to start** if anything is invalid
([config/env.ts](../server/src/config/env.ts)).

```powershell
Copy-Item D:\apps\EntraSave\server\.env.example D:\apps\EntraSave\server\.env
notepad D:\apps\EntraSave\server\.env
```

Generate a strong `JWT_SECRET` (≥ 32 chars):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Fill in `server\.env` for production. Example (replace the domain, DB password, secret):

```dotenv
NODE_ENV=production
PORT=4000

# Public site origin (same for both because IIS serves them same-site).
APP_URL=https://finance.example.com
CLIENT_URL=https://finance.example.com

# SQL Server. encrypt=true; trustServerCertificate=true is fine for a self-signed/local cert.
DATABASE_URL="sqlserver://localhost:1433;database=Finance;user=finance_app;password=a-strong-password-here;encrypt=true;trustServerCertificate=true"

JWT_SECRET=<paste-the-generated-secret>
JWT_ISSUER=entrasave
JWT_AUDIENCE=entrasave-web
SESSION_TTL_SECONDS=28800

LOG_LEVEL=info

# Optional — leave blank to disable that provider.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_GRAPH_VERSION=
```

Important:

- **`NODE_ENV=production`** makes session cookies `Secure`, so the site **must** be served
  over **HTTPS** (step 9) or logins won't work.
- `APP_URL` must be the public HTTPS origin — it's used to build the OAuth callback URLs.
- `CLIENT_URL` must exactly match the public origin (no trailing slash) — it's the CORS
  allowlist and the CSRF origin check.
- OAuth is optional. If you set `GOOGLE_CLIENT_ID` you must also set `GOOGLE_CLIENT_SECRET`
  (same for Facebook, which also needs `FACEBOOK_GRAPH_VERSION`, e.g. `v19.0`). See step 10.

---

## 5. Install dependencies

```powershell
cd D:\apps\EntraSave
npm run install:all      # installs server + client
```

---

## 6. Set up the database schema (Prisma)

From the **server** folder:

```powershell
cd D:\apps\EntraSave\server
npm run prisma:generate   # generate the Prisma client
npm run prisma:deploy     # apply all migrations to the Finance database
npm run db:seed           # seed required roles/permissions (USER role, etc.)
```

- `prisma:deploy` runs `prisma migrate deploy` — the production‑safe, non‑interactive
  migration command.
- **`db:seed` is required**, not optional: the app assigns a default `USER` role on
  sign‑up and will error if roles aren't seeded.

---

## 7. Build the client

```powershell
cd D:\apps\EntraSave\client
npm run build            # outputs static files to client\dist
```

The deployable SPA is now in `D:\apps\EntraSave\client\dist`.

---

## 8. Run the API as a Windows service (NSSM)

Test it first in the foreground:

```powershell
cd D:\apps\EntraSave\server
npm run start            # tsx src/server.ts — should log "server.started" on port 4000
# Ctrl+C to stop
```

If it prints an environment error, fix `server\.env` (it lists the offending field names).

Now install it as an always‑on service:

```powershell
nssm install EntraSaveAPI "C:\Program Files\nodejs\npm.cmd" "run start"
nssm set EntraSaveAPI AppDirectory "D:\apps\EntraSave\server"
nssm set EntraSaveAPI AppStdout "D:\apps\EntraSave\logs\api.out.log"
nssm set EntraSaveAPI AppStderr "D:\apps\EntraSave\logs\api.err.log"
nssm set EntraSaveAPI Start SERVICE_AUTO_START
New-Item -ItemType Directory -Force D:\apps\EntraSave\logs | Out-Null
nssm start EntraSaveAPI
```

Verify it's listening:

```powershell
Invoke-RestMethod http://localhost:4001/health   # -> { ok = True; data = ... }
```

Service control later: `nssm restart EntraSaveAPI`, `nssm stop EntraSaveAPI`,
`nssm status EntraSaveAPI`. (`.env` is loaded by the app via dotenv, so you don't set
environment variables in NSSM.)

> Alternative: if you prefer PM2, `npm i -g pm2 pm2-windows-startup`, then
> `pm2 start npm --name EntraSaveAPI -- run start` (cwd = server), `pm2 save`,
> `pm2-startup install`. NSSM is recommended for the simplest, most reliable service.

---

## 9. Publish the client through IIS (with the API reverse proxy)

1. In **IIS Manager**, create a site (or use _Default Web Site_):
   - **Physical path:** `D:\apps\EntraSave\client\dist`
   - **Binding:** add an **https** binding for `finance.example.com` and select your TLS
     certificate. (Import a real cert, or use _Server Certificates → Create Self‑Signed_
     for testing. Public HTTPS is required because cookies are `Secure` in production.)
   - Optionally add an http binding and an HTTP→HTTPS redirect.

2. A `web.config` already ships with the build at
   `D:\apps\EntraSave\client\dist\web.config` (it lives in
   [client/public/web.config](../client/public/web.config) and Vite copies it into `dist/`
   on `npm run build`). You normally don't need to create it by hand. It
   (a) reverse‑proxies `/api/*` to the Node service and (b) serves `index.html` for
   client‑side routes (SPA fallback). For reference, its contents are:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <!-- Forward API calls to the Node service on localhost:4001 -->
           <rule name="EntraSave API proxy" stopProcessing="true">
             <match url="^api/(.*)" />
             <action type="Rewrite" url="http://localhost:4001/api/{R:1}" />
           </rule>

           <!-- SPA fallback: anything that isn't a real file/dir -> index.html -->
           <rule name="SPA fallback" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
             </conditions>
             <action type="Rewrite" url="/index.html" />
           </rule>
         </rules>
       </rewrite>

       <!-- Don't cache the HTML shell so deploys are picked up immediately -->
       <staticContent>
         <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="365.00:00:00" />
       </staticContent>
     </system.webServer>
   </configuration>
   ```

   > The API proxy rule only works if **ARR proxy is enabled** at the server level (step 1).
   > Vite fingerprints asset filenames, so long caching of `/assets/*` is safe; `index.html`
   > is always revalidated by the SPA fallback.

3. Browse to `https://finance.example.com` — you should get the EntraSave landing page,
   and `https://finance.example.com/api/auth/providers` should return JSON from the API.

---

## 10. (Optional) Enable Google / Facebook login

Only if you filled the OAuth values in `server\.env`. In each provider's console, register
the redirect/callback URL (derived from `APP_URL`):

- Google: `https://finance.example.com/api/auth/oauth/google/callback`
- Facebook: `https://finance.example.com/api/auth/oauth/facebook/callback`

Set `FACEBOOK_GRAPH_VERSION` to a real version like `v19.0`. Restart the API after editing
`.env`: `nssm restart EntraSaveAPI`.

---

## 11. Verify the deployment

- `Invoke-RestMethod http://localhost:4001/health` → healthy.
- Open the public site over **HTTPS**, create an account (sign up), and confirm you land on
  the dashboard. A successful login proves cookies (Secure + same‑site) and the `/api`
  proxy are working end‑to‑end.
- Check `D:\apps\EntraSave\logs\api.out.log` for `server.started`.

---

## 12. Updating to a new version

```powershell
cd D:\apps\EntraSave
git pull
npm run install:all                       # in case dependencies changed
cd server; npm run prisma:generate; npm run prisma:deploy   # apply any new migrations
cd ..\client; npm run build               # rebuild the SPA into dist
nssm restart EntraSaveAPI                  # restart the API service
```

IIS picks up the new `client\dist` files immediately (the HTML shell isn't cached).

---

## 13. Troubleshooting

| Symptom                                                   | Likely cause / fix                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| API service won't start / stops immediately               | Run `npm run start` in `server\` by hand; it prints which `.env` field is invalid. Check `logs\api.err.log`.                            |
| `prisma migrate deploy` fails to connect                  | Wrong `DATABASE_URL`; SQL Server TCP/IP disabled; firewall on 1433; login not in `db_owner`.                                            |
| Login appears to succeed but you're logged out on refresh | Cookies are `Secure` (NODE_ENV=production) but the site isn't on **HTTPS**, or `CLIENT_URL` doesn't exactly match the browser's origin. |
| `/api/...` returns 404/502 from IIS                       | ARR **proxy not enabled** (step 1), or the `web.config` API rule is missing, or the API service is down (`nssm status EntraSaveAPI`).   |
| "Cross-site request blocked" on POSTs                     | `CLIENT_URL` must equal the public origin with no trailing slash (it's the CSRF/CORS origin).                                           |
| Sign-up errors about a missing role                       | You skipped `npm run db:seed`. Run it.                                                                                                  |
| Google/Facebook button does nothing / errors              | Provider not configured (both ID + secret required), wrong callback URL, or `APP_URL` not matching the registered redirect.             |

---

## Quick reference

| Task                   | Command (from the folder shown)                  |
| ---------------------- | ------------------------------------------------ |
| Install everything     | `npm run install:all` (repo root)                |
| Generate Prisma client | `npm run prisma:generate` (server)               |
| Apply migrations       | `npm run prisma:deploy` (server)                 |
| Seed roles/permissions | `npm run db:seed` (server)                       |
| Build the SPA          | `npm run build` (client)                         |
| Run API in foreground  | `npm run start` (server)                         |
| Restart API service    | `nssm restart EntraSaveAPI`                      |
| API health check       | `Invoke-RestMethod http://localhost:4001/health` |
