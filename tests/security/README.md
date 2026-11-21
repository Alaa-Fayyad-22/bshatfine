# Security and race-condition tests

Automated checks for the whole Bshatfine site: the ASP.NET Core API and the
Next.js frontend. Some tests are destructive (they lock accounts, disable
Admins, upload "image bombs"), so they never run against your own
environment. The suite builds an isolated one, runs, and removes it again.

| | Your environment (never touched) | Test environment (created by the suite) |
|---|---|---|
| API | http://localhost:5246 | http://localhost:5247 (a copy of `backend/`) |
| Website | http://localhost:3000 (dev) | http://localhost:3001 (production build of a copy of `frontend/`) |
| Database | `bshatfine` | `bshatfine_test`, role `bshatfine_sectest`, same `bshatfine-db` container |

The suite refuses to start if the test URLs point at :5246 or :3000, if the
database is not `bshatfine_test`, or if a test account is not an
`@example.test` address. Before running anything it also proves that the API
on :5247 really uses `bshatfine_test`.

## Requirements

- Node.js 22+, .NET 10 SDK with `dotnet-ef` (`dotnet tool install -g dotnet-ef`)
- Docker with the `bshatfine-db` container running (`docker compose up -d` at the repo root)
- Google Chrome installed (Playwright drives it; no browser download). Microsoft Edge is used if Chrome is missing, or set `SECTEST_CHROME` to a browser executable.
- Ports 5247, 3001 and 4444 free

## Run

```sh
cd tests/security
npm install
npm test                      # env up → all groups → env down; prints the PASS/FAIL table
```

Other commands:

```sh
npm run env:up                # only build and start the test environment
npm run test:only             # run the tests against an environment that is already up
npm run test:only -- --groups 3,6
npm test -- --keep-env        # leave the servers and database up afterwards (to inspect them)
npm run env:status
npm run env:down              # stop both test servers, drop bshatfine_test and its role, delete the copies
```

Exit code: 0 when nothing failed, 1 when a test failed, 2 when the run could
not start. Results are also written to `results/report.md` (table plus the
request, response and expectation of every failure) and
`results/results.json`; the folder is git-ignored.

A full run takes about 12–15 minutes; building the environment (npm ci and a
production build of the site) adds about 3–5 minutes.

## How the environment is created (what `env:up` does)

1. `docker exec bshatfine-db psql …`: creates role `bshatfine_sectest` (throwaway password) and a fresh database `bshatfine_test` owned by it.
2. Copies `backend/` (without `bin/`, `obj/`) to `%TEMP%\bshatfine-sectest\backend`, so the running API's files are never locked or rebuilt.
3. `dotnet ef database update --project …Infrastructure --startup-project …Api --connection "<bshatfine_test>"`.
4. `dotnet run --project <copy>\Bshatfine.Api --no-launch-profile --urls http://localhost:5247` with `ASPNETCORE_ENVIRONMENT=Development`, `ConnectionStrings__Default=<bshatfine_test>`, `SeedAdmin__Email` / `SeedAdmin__Password` = the test admin below. (Environment variables override your user secrets, so your real connection string and admin are not used.)
5. Copies `frontend/` (without `node_modules`, `.next`, `.env*`) to `%TEMP%\bshatfine-sectest\frontend`, runs `npm ci` and `npm run build` with `API_INTERNAL_URL=http://localhost:5247`, then `next start -p 3001`.
6. The run itself creates the other accounts through the API (create user → log in with the temporary password → change password).

To recreate it by hand, follow the same steps; `env:down` undoes all of them
(stops the processes it started, `DROP DATABASE bshatfine_test`, `DROP ROLE
bshatfine_sectest`, deletes the copies). Server logs are in
`%TEMP%\bshatfine-sectest\api.log` and `web.log` while it is up.

## Settings (environment variables, development defaults)

These values exist only inside the throwaway database. They are not secrets.

| Variable | Default |
|---|---|
| `SECTEST_ADMIN1_EMAIL` / `SECTEST_ADMIN1_PASSWORD` | `sectest-admin1@example.test` / `Sectest-Admin1-Pass-2026` (seeded by the API) |
| `SECTEST_ADMIN2_EMAIL` / `SECTEST_ADMIN2_PASSWORD` | `sectest-admin2@example.test` / `Sectest-Admin2-Pass-2026` |
| `SECTEST_EDITOR_EMAIL` / `SECTEST_EDITOR_PASSWORD` | `sectest-editor@example.test` / `Sectest-Editor-Pass-2026` |
| `SECTEST_EXTRA_PASSWORD` | `Sectest-Extra-Pass-2026` (throwaway accounts made by single tests) |
| `SECTEST_DB_ROLE` / `SECTEST_DB_PASSWORD` | `bshatfine_sectest` / `sectest-throwaway-Db-2026` |
| `SECTEST_DB_CONTAINER`, `SECTEST_DB_HOST`, `SECTEST_DB_PORT` | `bshatfine-db`, `localhost`, `5433` |
| `SECTEST_API_URL`, `SECTEST_WEB_URL`, `SECTEST_ATTACKER_PORT` | `http://localhost:5247`, `http://localhost:3001`, `4444` |
| `SECTEST_WORK_DIR` | `%TEMP%\bshatfine-sectest` |
| `SECTEST_RACE_REPEATS` | `5` (repeats of each "Admins vs Admins" scenario) |
| `SECTEST_CHROME` | (path to a Chrome/Edge executable, optional) |

## What each group checks

A test passes only when the safe behaviour is observed. Each test creates its
own data and removes it again.

1. **Injection** (`tests/01-injection.mjs`). These payloads go through every input: `' OR 1=1 --`, `' OR '1'='1`, `"; DROP TABLE "News"; --`, `pg_sleep(5)`, `%`, `_`, `\`, `%00`, NUL, 5000-character strings, RTL-override and zero-width characters. The inputs are public and admin query parameters, route values (slugs, ids, file ids), JSON bodies (news, entries of every kind, council, contact details, users, versions as strings, negative and huge numbers), login and change-password, the website's URLs, and the admin search boxes in the browser.
   - Safe means: 400, 404 or a normal answer; never a 5xx; no extra rows; no delay as long as `pg_sleep`; every table still there.
   - 1.11 reports whether `%` and `_` act as LIKE wildcards in the users search and the audit e-mail filter. That isn't injection, so it is reported as INFO.
2. **Stored XSS** (`02-xss.mjs`). Payloads are saved in news, entries (all four kinds), council names, contact details and a user's display name. The payloads are `<script>`, `<img onerror>`, `<svg onload>`, `javascript:` and `data:` links, and Markdown links and images with those schemes.
   - Every public page (Arabic and English) and every admin page that shows them is opened in Chrome. Chrome listens for dialogs, `alert`/`confirm`/`prompt` calls, CSP violations, unsafe `href`s, inline event handlers and injected scripts.
   - Every saved text carries a unique marker. A page that doesn't show the marker is listed as NOT TESTED for that page, so it can't pass by accident.
   - 2.2 checks that the server refuses unsafe contact links and e-mails.
3. **Access control** (`03-access.mjs`):
   - Anonymous requests to every `/api/admin` route get 401.
   - The Editor gets 403 on the Admin-only routes.
   - An account that must change its password gets 403.
   - Mass assignment: extra fields such as `role`, `isActive`, `id`, `version`, `status`, `isPublished` and `displayOrder` are ignored.
   - IDOR: the Editor can't reach other users' records.
   - Tampered or truncated cookies get 401.
   - A cookie stops working after logout.
   - The session ends within about a minute after the account is disabled, force-logged-out, has its password reset or is demoted.
   - The login page's `returnTo` never leaves the site (18 variants, checked in the browser).
4. **CSRF and origins** (`04-csrf.mjs`):
   - An attacker page on `127.0.0.1:4444` (a different site) sends form posts, a no-cors multipart upload and a `text/plain` JSON body to the logged-in site.
   - The same attack is repeated from `localhost:4444`: the same site on another port.
   - A valid cookie is sent with a foreign `Origin` or `Referer`.
   - JSON endpoints must refuse form and `text/plain` bodies.
   - CORS answers to foreign origins are checked on both the API and the site.
5. **Uploads** (`05-uploads.mjs`):
   - A fake image, HTML and SVG renamed to `.jpg`, polyglots, a GIF, a header bomb (30000×30000), 0 bytes, 12 MB (direct and through the site's proxy) and a wrong field name must all be refused. The `StoredFiles` count must not change.
   - A JPEG with a script appended, a file name containing `../` and NUL, and a PNG sent as `text/html` are accepted, but are served only as re-encoded `image/webp` with `nosniff`.
   - A real decompression bomb just under the pixel limit, and five of them in parallel.
   - A rate limit on news cover uploads.
   - `/api/files/../`, `%2e%2e` and non-GUID ids, sent with raw, un-normalised paths.
6. **Race conditions** (`06-races.mjs`). Each case fires 10–20 identical requests with `Promise.all`, then checks the database:
   - (a) parallel saves with the same version;
   - (b) parallel publishing;
   - (c) the same staff e-mail created in parallel;
   - (d) parallel wrong-password logins, to see whether the lockout still holds;
   - (e) the only two Admins disabling or demoting each other, repeated `SECTEST_RACE_REPEATS` times for each of three variants;
   - (f) parallel reordering of entries and of the council;
   - (g) parallel cover uploads, followed by a check for orphan files;
   - (h) parallel deletes;
   - (i) 30 parallel logins from one address. These go direct and through the site's proxy, once with a spoofed `X-Forwarded-For` on each request.
7. **Headers and session** (`07-headers.mjs`):
   - Security headers on API and website responses: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, and no `Server` or `X-Powered-By`.
   - `Cache-Control: no-store` on admin responses.
   - Session cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`, and not persistent.
   - Every API error body produced during the run is scanned for stack traces, source paths, exception, SQL or type names, and parameter-binding details.

## Not covered

- The 30-minute idle and 8-hour absolute session limits, which would need a real wait that long.
- Two-factor login, which is not enabled for staff yet.
- HSTS and HTTPS redirection. The API adds these only outside Development, and the test instance runs in Development as required.
