# SECURITY.md

Security policy and engineering rules for the EntraSave application. This is the
enforceable companion to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Treat
every rule here as a merge gate.

---

## 1. Threat model in one paragraph

This app stores **personal financial data** for many isolated users. The primary
threats are: one user reading/altering another user's data (broken access
control / IDOR), credential abuse, injection, leaking financial values through
logs/errors, and abuse/DoS of expensive endpoints. The architecture is
**server-authoritative**: the React client is never trusted, the Express API is
the only trust boundary, and every layer assumes the one before it failed.

---

## 2. Non-negotiable rules

### Authentication
- Identity is local. Passwords are stored only as salted, versioned, memory-hard
  scrypt hashes; plaintext passwords and provider tokens are never persisted.
- Google and Facebook use direct authorization-code flows. The backend verifies
  state and returned provider tokens before creating or linking a local user.
- Automatic email-based linking is allowed only for an already provider-verified
  local email; unverified password registrations cannot be used to pre-claim it.
- A verified provider may claim a credential-less legacy migration row with the
  same email. This exception is safe only while password and both provider ids
  are null; the callback marks the email verified and stores the provider id.
- Session JWTs use strict algorithm/issuer/audience/expiry checks and are stored
  only in `Secure`, `HttpOnly`, `SameSite=Lax` cookies. `sessionVersion` provides
  immediate server-side revocation; logout increments it and clears the cookie.
- Every protected endpoint resolves identity via
  [requireAuth()](server/src/utils/require-auth.ts) — which rejects
  anonymous, unprovisioned, suspended, and deleted users, reloading roles,
  permissions, status, and `sessionVersion` from SQL Server on every request.
- Authorization never relies on the JWT payload fields; the token is a session
  bearer only. The decoded `sub`/`sv` are re-validated against the database.
- Password-created emails are unverified until an explicit mailbox-verification
  feature exists. Password reset, email verification, MFA, recovery codes, and
  refresh tokens must be designed as separate threat-modeled auth use cases.

### Credential and token handling
- Password inputs are bounded to 12–128 characters and handled only by
  [password.ts](server/src/utils/password.ts). Hashes encode fixed scrypt
  work factors; malformed or unexpected hash formats fail closed.
- JWT verification pins `HS256`, issuer, audience, issued-at, expiry, maximum
  lifetime, subject, session version, and `jti`. Never decode-and-trust tokens.
- JWTs and OAuth state live only in HttpOnly cookies. Never use local storage,
  session storage, readable cookies, query parameters, or client React state.
- JWT/OAuth secrets, passwords/hashes, authorization codes, access/ID tokens,
  signed state, and email addresses are forbidden in logs and audit metadata.

### OAuth integrity
- Callback URLs derive from validated `APP_URL`; request host/forwarded headers
  never select a callback URL. Post-auth redirects target `CLIENT_URL` and accept
  local paths only.
- Google retains signed state, S256 PKCE, nonce, backend code exchange, verified
  issuer/audience/expiry/email, and provider subject checks.
- Facebook retains signed state, backend code exchange, `debug_token`, app-id,
  validity/expiry and user-id checks, plus `appsecret_proof` profile retrieval.
- Provider JSON is untrusted input and is Zod-parsed. Provider access/ID tokens
  are used transiently and never persisted or returned to the browser.
- Provider avatar URLs are length-bounded, stored as profile metadata only, and
  never treated as authentication evidence or fetched by application services.

### Authorization (two independent checks, both required)
1. **RBAC** — DB-backed permissions via
   [requirePermission()](server/src/utils/require-permission.ts). Deny by default.
2. **Ownership** — every owned query is scoped by `userId` in the repository
   `where`. IDOR is prevented in the query, not after the fetch.
- Admin capability is an explicit `admin.*` permission and is **always audited**.

### Input / output
- **All external input is parsed with Zod** at the entrypoint (`defineRoute`)
  before reaching a service. No `as` casts to launder untyped input. The server
  schema is authoritative — the separate React client cannot be trusted to validate.
- Every string field is **length-bounded**; collections are size-bounded.
- The accepted JSON body is capped (`express.json({ limit: '1mb' })`) — defense in
  depth alongside the IIS request cap.
- **Output is DTO-only.** Internal fields never leave the service. React's default
  escaping is relied on; `dangerouslySetInnerHTML` with user data is forbidden.

### Injection
- **Prisma only**, parameterized. No string-built SQL. `$queryRaw` is allowed
  **only** as a tagged template with interpolated parameters — never string
  concatenation — and must be justified in review.

### Cross-origin & transport
- The API enables CORS for a **single allowlisted origin** (`CLIENT_URL`) with
  `credentials: true`. Never reflect the request `Origin`, never use `*` with
  credentials, and never widen the allowlist to bypass a same-site cookie.
- Security headers (HSTS in prod, `X-Content-Type-Options`, `X-Frame-Options:
  DENY`, `Referrer-Policy`, `Permissions-Policy`, a locked-down `default-src
  'none'` CSP for the JSON API) are set once in
  [server/src/middleware/](server/src/middleware/). Do not set
  conflicting headers elsewhere.
- TLS everywhere; HSTS on; origin firewalled to Cloudflare IPs with
  Authenticated Origin Pulls in production. In production the SPA and API are
  served same-site behind IIS/Cloudflare.

### Secrets & config
- Secrets live in `server/.env` (git-ignored), validated at boot by
  [env.ts](server/src/config/env.ts). The API refuses to start if invalid.
- The React build only ever embeds values prefixed for the client bundle (Vite
  `VITE_*`). Server secrets live exclusively in the API process and are never
  bundled — the client is a physically separate app.
- Never log secret values, even on validation failure (log key names only).
- `JWT_SECRET` is at least 32 random bytes and is not reused as an OAuth or DB
  secret. Rotation invalidates all sessions and outstanding OAuth state cookies.

### Money & data integrity
- Money is `Decimal(19,4)` in DB, `string` in transit. Never `Float`/`number`.
- External provider responses are verified before any local account mutation.

### Rate limiting & abuse
- Mutations and expensive reads declare a `rateLimit` policy in
  [defineRoute](server/src/utils/define-route.ts); limits live in
  [ratelimit/index.ts](server/src/utils/ratelimit/index.ts), keyed per user.
- Public credential routes use the explicit public `defineRoute()` mode and
  mandatory per-IP auth limits. OAuth start handlers enforce the OAuth IP limit.
  The client IP is read from the trusted edge header (`trust proxy` is set so the
  forwarded chain resolves correctly).
- The in-memory limiter supports one Node process only. Deploy Redis-backed
  limiting before horizontal scaling; this is a security requirement, not an optimization.
- Edge defenses (Cloudflare WAF, Bot Fight, Turnstile) front auth and high-value
  forms in production.

### File uploads (when added)
- Validate content-type allowlist + size; random storage keys (no user filenames
  as paths); store outside webroot; serve via signed, expiring, ownership-checked
  URLs; scan and quarantine. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §11.1.

### SSRF
- No user-supplied URL is fetched server-side. If ever required: host allowlist,
  block RFC1918/link-local, deny redirects to internal addresses.

---

## 3. Logging, audit & error handling

- **Operational logs never contain money or PII.** The logger
  ([logger.ts](server/src/utils/logger.ts)) redacts known-sensitive keys;
  log *that* something happened plus ids/`requestId`, never the amount.
- **Audit log** ([audit.service.ts](server/src/services/audit.service.ts)) is
  append-only and written for every mutation and admin action with
  actor/target/action/resource/redacted-metadata/ip/requestId. Audit `metadata`
  must be pre-redacted by the caller.
- **Errors are typed `AppError`s** ([app-error.ts](server/src/utils/app-error.ts)).
  Clients receive `{ ok:false, error:{ code, message, requestId, fieldErrors? } }`
  with a matching HTTP status — never a stack trace. Unknown errors become a
  generic 500 with full detail logged server-side.

---

## 4. OWASP Top 10 — where it's handled

| Risk | Control (file/section) |
|---|---|
| A01 Broken Access Control | RBAC + ownership-in-`where`; admin audited (§2) |
| A02 Cryptographic Failures | TLS/HSTS, SQL Server TDE, HttpOnly JWT cookies, scrypt hashes, Decimal money |
| A03 Injection | Prisma parameterization; Zod typing; no string SQL |
| A04 Insecure Design | Layered `defineRoute` pipeline; deny-by-default |
| A05 Misconfiguration | `env.ts` boot validation; hardened headers/CSP; strict CORS; least-priv service account |
| A06 Vulnerable Components | `npm audit` + Dependabot + lockfile, CI fail-on-high |
| A07 Auth/Session | Strict JWT claims, DB revocation counter, OAuth state/PKCE/nonce, sign-in limits |
| A08 Integrity | Verified OAuth state/provider tokens; lockfile; future attachment checksums |
| A09 Logging/Monitoring | Structured logs + audit + alerting; no sensitive data |
| A10 SSRF | No user-controlled server fetches (§2) |

Full checklist: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §12.

---

## 5. Dependency & supply chain

- Commit `package-lock.json` in both `server/` and `client/`; install with
  `npm ci` in CI.
- `npm audit` must be clean of high/critical before merge; enable Dependabot.
- Pin Node/runtime versions; review new dependencies for necessity and provenance.

---

## 6. Reporting a vulnerability

Do **not** open a public issue for a security flaw. Email the maintainer
privately with steps to reproduce and impact. Expect acknowledgement and a
remediation timeline. Authorized security testing of your own deployment is
welcome; do not test against other users' data.

---

## 7. Incident response (readiness)

On suspected compromise: increment affected users' session versions; rotate the
JWT secret for global revocation; rotate affected Google/Meta and DB credentials;
invalidate provider secrets in their consoles; isolate the node; preserve logs
and the audit trail; restore from a verified backup if integrity is in doubt;
document the timeline. Keep a runbook current — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §17.
