// 7. Headers and session: security headers and CSP on API and website
// responses, cookie flags, and no internals in any error body of the run.
import { test } from "../lib/runner.mjs";
import { api, evidence, responseLog, web } from "../lib/http.mjs";

const API_HEADERS = {
  "x-content-type-options": (v) => v === "nosniff",
  "x-frame-options": (v) => v === "DENY",
  "referrer-policy": (v) => !!v,
  "content-security-policy": (v) => /default-src 'none'/.test(v ?? "") && /frame-ancestors 'none'/.test(v ?? ""),
};

test(7, "7.1", "API security headers on success, 4xx and file responses", "nosniff, DENY, Referrer-Policy, CSP default-src 'none'; no Server / X-Powered-By", async (t, s) => {
  const list = [
    await api("GET", "/api/news?lang=ar"),
    await api("GET", "/api/admin/users"),
    await api("GET", "/api/does-not-exist"),
    await api("POST", "/api/auth/login", { json: "{bad", retry429: false }),
    await api("GET", "/api/admin/news", { cookie: s.sessions.cookie("editor") }),
  ];
  for (const r of list) {
    for (const [h, ok] of Object.entries(API_HEADERS))
      t.check(ok(r.headers.get(h)), `${r.method} ${r.url} (${r.status}): ${h} = ${r.headers.get(h)}`, evidence(r, `${h} set correctly`));
    for (const h of ["server", "x-powered-by", "x-aspnet-version"])
      t.check(!r.headers.get(h), `${r.url}: ${h}: ${r.headers.get(h)}`, "header absent");
  }
  const admin = list[4];
  t.check(/no-store/.test(admin.headers.get("cache-control") ?? ""), "admin response is cacheable", evidence(admin, "Cache-Control: no-store"));
  t.note("Strict-Transport-Security is only added outside Development (app.UseHsts), so it is not checked against this Development instance.");
});

test(7, "7.2", "Website security headers and CSP (pages, 404, admin, /api through the proxy)", "CSP with object-src/base-uri/form-action/frame-ancestors; nosniff; DENY; no X-Powered-By", async (t) => {
  for (const path of ["/ar", "/en/news", "/ar/admin/login", "/ar/this-page-does-not-exist", "/ar/entries/01900000-0000-7000-8000-000000000001"]) {
    const r = await web("GET", path);
    const csp = r.headers.get("content-security-policy") ?? "";
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"])
      t.check(csp.includes(d), `${path}: CSP lacks ${d}`, csp);
    t.check(!/unsafe-eval/.test(csp), `${path}: CSP allows 'unsafe-eval' in production`, csp);
    t.check(r.headers.get("x-content-type-options") === "nosniff", `${path}: no nosniff`, "X-Content-Type-Options");
    t.check(r.headers.get("x-frame-options") === "DENY", `${path}: X-Frame-Options ${r.headers.get("x-frame-options")}`, "DENY");
    t.check(!r.headers.get("x-powered-by"), `${path}: X-Powered-By: ${r.headers.get("x-powered-by")}`, "absent (poweredByHeader: false)");
    if (/'unsafe-inline'/.test(csp.match(/script-src[^;]*/)?.[0] ?? "") && path === "/ar")
      t.observe("script-src allows 'unsafe-inline' (documented trade-off in next.config.ts): CSP would not stop an injected inline script.");
  }
});

test(7, "7.3", "Session cookie flags (API and through the site)", "HttpOnly; Secure; SameSite=Strict; Path=/; no persistent expiry", async (t, s) => {
  const { email, password } = s.sessions.users.editor;
  for (const [label, fn] of [["API", api], ["site", web]]) {
    // (the login limiter may still be full from 6.i: the helper waits for it)
    const r = await fn("POST", "/api/auth/login", { json: { email, password } });
    const c = (r.setCookie ?? []).find((x) => x.startsWith("bsh.session="));
    if (!t.check(!!c, `${label}: no session cookie set`, evidence(r, "Set-Cookie: bsh.session"))) continue;
    t.check(/;\s*httponly/i.test(c), `${label}: cookie not HttpOnly`, c.replace(/=[^;]+/, "=…"));
    t.check(/;\s*secure/i.test(c), `${label}: cookie not Secure`, c.replace(/=[^;]+/, "=…"));
    t.check(/;\s*samesite=strict/i.test(c), `${label}: cookie not SameSite=Strict`, c.replace(/=[^;]+/, "=…"));
    t.check(!/;\s*(expires|max-age)=/i.test(c), `${label}: persistent cookie`, c.replace(/=[^;]+/, "=…"));
  }
  t.note("Idle (30 min) and absolute (8 h) session limits are not exercised: they would need a 30-minute / 8-hour wait.");
});

test(7, "7.4", "Error bodies from the whole run: no stack traces or internal details", "no stack, file paths, SQL, exception or type names", async (t) => {
  const patterns = [
    ["stack trace", /\bat [A-Z][\w.`<>]+\(.*\)|\s+at\s+\S+\s+in\s+\S+:line\s+\d+/],
    ["source path", /[A-Z]:\\[^"\s]+\.(cs|ts|tsx|js)|\/src\/[^"\s]+\.(cs|ts)/],
    ["exception name", /\b\w+Exception\b/],
    ["SQL / Npgsql", /Npgsql|PostgresException|SQLSTATE|syntax error at or near|relation "/i],
    ["framework type name", /Microsoft\.(AspNetCore|EntityFrameworkCore)|System\.[A-Z]\w+\.|Bshatfine\.\w+/],
    ["parameter binding detail", /Failed to (read|bind) parameter/],
  ];
  // API answers (direct or through the site's /api proxy); the site's own HTML
  // error pages carry the framework's script bundle, judged in 7.2 instead.
  const errors = responseLog.filter((r) => (r.status >= 400 || r.status === 0) && /\/api\//.test(r.url));
  const fives = errors.filter((r) => r.status >= 500);
  const hits = new Map();
  for (const r of errors) {
    for (const [label, re] of patterns) {
      const m = re.exec(r.text ?? "");
      if (m) {
        const key = `${label}|${r.status}|${m[0].slice(0, 80)}`;
        if (!hits.has(key)) hits.set(key, { label, r, match: m[0] });
      }
    }
  }
  t.note(`${errors.length} error responses checked (${fives.length} with status 5xx).`);
  for (const { label, r, match } of [...hits.values()].slice(0, 25))
    t.fail(`${label} in a ${r.status} body: "${match.slice(0, 100)}"`, { request: `${r.method} ${r.url.slice(0, 200)}`, response: `${r.status} ${String(r.text).slice(0, 500)}`, expected: "a generic problem message" });
  for (const r of fives.slice(0, 15))
    t.fail(`server error ${r.status} during the run`, { request: `${r.method} ${r.url.slice(0, 200)}`, response: `${r.status} ${String(r.text).slice(0, 400)}`, expected: "never 5xx" });
});

test(7, "7.5", "Development-only surfaces on the test instance", "reported", async (t) => {
  const o = await api("GET", "/openapi/v1.json");
  t.observe(`/openapi/v1.json → ${o.status} (mapped only in Development; make sure production runs with ASPNETCORE_ENVIRONMENT=Production).`);
});
