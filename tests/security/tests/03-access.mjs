// 3. Access control: anonymous and Editor access, mass assignment, IDOR,
// tampered cookies, sessions after logout / disable, open redirects.
import { test } from "../lib/runner.mjs";
import { api, evidence, sessionCookie } from "../lib/http.mjs";
import { exec, lit, rows } from "../lib/db.mjs";
import { createCouncil, createEntry, createNews, extraStaff, login } from "../lib/fixtures.mjs";
import { newContext, watch } from "../lib/browser.mjs";

const G = "01900000-0000-7000-8000-000000000001"; // any well-formed id

// Every staff route: [method, path, adminOnly]
const ROUTES = [
  ["GET", "/api/admin/users", true],
  ["GET", `/api/admin/users/${G}`, true],
  ["POST", "/api/admin/users", true],
  ["PUT", `/api/admin/users/${G}`, true],
  ["POST", `/api/admin/users/${G}/disable`, true],
  ["POST", `/api/admin/users/${G}/enable`, true],
  ["POST", `/api/admin/users/${G}/reset-password`, true],
  ["POST", `/api/admin/users/${G}/force-logout`, true],
  ["POST", `/api/admin/users/${G}/unlock`, true],
  ["GET", "/api/admin/audit", true],
  ["GET", "/api/admin/site-settings", true],
  ["PUT", "/api/admin/site-settings", true],
  ["GET", "/api/admin/council", true],
  ["GET", `/api/admin/council/${G}`, true],
  ["POST", "/api/admin/council", true],
  ["PUT", `/api/admin/council/${G}`, true],
  ["POST", `/api/admin/council/${G}/activate`, true],
  ["POST", `/api/admin/council/${G}/deactivate`, true],
  ["PUT", "/api/admin/council/order", true],
  ["DELETE", `/api/admin/council/${G}`, true],
  ["POST", `/api/admin/council/${G}/photo`, true],
  ["DELETE", `/api/admin/council/${G}/photo`, true],
  ["GET", "/api/admin/news", false],
  ["GET", `/api/admin/news/${G}`, false],
  ["POST", "/api/admin/news", false],
  ["PUT", `/api/admin/news/${G}`, false],
  ["DELETE", `/api/admin/news/${G}`, false],
  ["POST", `/api/admin/news/${G}/publish`, false],
  ["POST", `/api/admin/news/${G}/archive`, false],
  ["POST", `/api/admin/news/${G}/republish`, false],
  ["POST", `/api/admin/news/${G}/cover`, false],
  ["DELETE", `/api/admin/news/${G}/cover`, false],
  ["GET", "/api/admin/entries?kind=project", false],
  ["GET", `/api/admin/entries/${G}`, false],
  ["POST", "/api/admin/entries", false],
  ["PUT", `/api/admin/entries/${G}`, false],
  ["POST", `/api/admin/entries/${G}/publish`, false],
  ["POST", `/api/admin/entries/${G}/unpublish`, false],
  ["PUT", "/api/admin/entries/order?kind=project", false],
  ["DELETE", `/api/admin/entries/${G}`, false],
  ["POST", `/api/admin/entries/${G}/cover`, false],
  ["DELETE", `/api/admin/entries/${G}/cover`, false],
];
// Upload routes get a real multipart body, so routing (415) cannot answer
// before authorization does.
const bodyFor = (method, path = "") => {
  if (method === "POST" && /\/(cover|photo)$/.test(path)) {
    const fd = new FormData();
    fd.append("file", new Blob([Buffer.from("x")], { type: "image/png" }), "a.png");
    return { form: fd };
  }
  return method === "POST" || method === "PUT" ? { json: {} } : {};
};

test(3, "3.1", "Anonymous: every /api/admin route and the private /api/auth routes", "401", async (t) => {
  for (const [m, p] of ROUTES) {
    const r = await api(m, p, bodyFor(m, p));
    t.check(r.status === 401, `${m} ${p} → ${r.status}`, evidence(r, "401"));
  }
  for (const [m, p] of [
    ["GET", "/api/auth/me"],
    ["POST", "/api/auth/change-password"],
    ["GET", "/api/auth/2fa/setup"],
    ["POST", "/api/auth/2fa/enable"],
  ]) {
    const r = await api(m, p, bodyFor(m));
    t.check(r.status === 401, `${m} ${p} → ${r.status}`, evidence(r, "401"));
  }
});

test(3, "3.2", "Editor: Admin-only routes (users, audit, site-settings, council)", "403", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  for (const [m, p, adminOnly] of ROUTES.filter((r) => r[2])) {
    const r = await api(m, p, { cookie, ...bodyFor(m, p) });
    t.check(r.status === 403, `${m} ${p} → ${r.status}`, evidence(r, "403"));
  }
  const ok = await api("GET", "/api/admin/news", { cookie });
  t.check(ok.status === 200, "the Editor cannot read news (sanity check)", evidence(ok, "200"));
});

test(3, "3.3", "An account that must still change its password cannot use staff routes", "403 until the password is changed", async (t, s) => {
  const admin = s.sessions.cookie("admin1");
  const email = `sectest-mustchange-${Date.now()}@example.test`;
  const c = await api("POST", "/api/admin/users", { cookie: admin, json: { email, displayName: "Must change", role: "Admin" } });
  try {
    const l = await login(email, c.json.temporaryPassword);
    t.check(!!l.cookie, "temporary password login failed", evidence(l.res, "200"));
    for (const p of ["/api/admin/news", "/api/admin/users"]) {
      const r = await api("GET", p, { cookie: l.cookie });
      t.check(r.status === 403, `GET ${p} with a temporary password → ${r.status}`, evidence(r, "403"));
    }
  } finally {
    exec(`delete from "AspNetUserRoles" where "UserId"=${lit(c.json.user.id)}; delete from "AspNetUsers" where "Id"=${lit(c.json.user.id)};`);
  }
});

test(3, "3.4", "Mass assignment: extra fields (role, isActive, id, version, status…) are ignored", "server-controlled fields unchanged", async (t, s) => {
  const admin = s.sessions.cookie("admin1");
  const editor = s.sessions.cookie("editor");
  const forged = "01900000-0000-7000-8000-00000000beef";
  const cleanup = [];
  try {
    // Users: create with forged fields
    const email = `sectest-mass-${Date.now()}@example.test`;
    const u = await api("POST", "/api/admin/users", {
      cookie: admin,
      json: { email, displayName: "Mass", role: "Editor", id: forged, isActive: false, mustChangePassword: false, emailConfirmed: false, lockoutEnd: "2999-01-01T00:00:00Z", isLockedOut: true, securityStamp: "x" },
    });
    if (u.status === 201) {
      cleanup.push(() => exec(`delete from "AspNetUserRoles" where "UserId"=${lit(u.json.user.id)}; delete from "AspNetUsers" where "Id"=${lit(u.json.user.id)};`));
      const x = u.json.user;
      t.check(x.id !== forged && x.isActive && x.mustChangePassword && !x.isLockedOut, "user creation took forged fields", evidence(u, "new id, active, must change password, not locked"));
      // Update with forged email / isActive
      const up = await api("PUT", `/api/admin/users/${x.id}`, { cookie: admin, json: { displayName: "Mass2", role: "Editor", email: "changed@example.test", isActive: false, id: forged } });
      t.check(up.json?.email === email && up.json?.isActive === true, "user update took forged email/isActive", evidence(up, "email and isActive unchanged"));
    } else t.fail("user creation failed", evidence(u, "201"));

    // Login body with a role does not change the role
    const l = await api("POST", "/api/auth/login", { json: { email: s.sessions.users.editor.email, password: s.sessions.users.editor.password, role: "Admin", roles: ["Admin"] }, retry429: false });
    const me = await api("GET", "/api/auth/me", { cookie: sessionCookie(l) });
    t.check(JSON.stringify(me.json?.roles) === '["Editor"]', "login with role:Admin changed the roles", evidence(me, 'roles ["Editor"]'));

    // News
    const n = await api("POST", "/api/admin/news", {
      cookie: editor,
      json: { id: forged, status: "Published", slug: "forged-slug", publishedAt: "2000-01-01T00:00:00Z", version: 7, coverImageUrl: "/api/files/x", translations: [{ language: "ar", title: "mass", body: "mass" }] },
    });
    if (n.status === 201) {
      cleanup.push(() => api("DELETE", `/api/admin/news/${n.json.id}`, { cookie: editor }));
      t.check(n.json.id !== forged && n.json.status === "Draft" && n.json.slug !== "forged-slug" && !n.json.publishedAt && !n.json.coverImageUrl, "news creation took forged fields", evidence(n, "draft, new id, own slug, no date or cover"));
      const nu = await api("PUT", `/api/admin/news/${n.json.id}`, { cookie: editor, json: { status: "Published", publishedAt: "2000-01-01T00:00:00Z", translations: [{ language: "ar", title: "m", body: "m" }], version: n.json.version } });
      t.check(nu.json?.status === "Draft" && !nu.json?.publishedAt, "news update took forged status", evidence(nu, "still a draft"));
    } else t.fail("news creation failed", evidence(n, "201"));

    // Entries
    const e = await api("POST", "/api/admin/entries", {
      cookie: editor,
      json: { kind: "place", category: "nature", id: forged, isPublished: true, publishedAt: "2000-01-01T00:00:00Z", displayOrder: -50, coverImageUrl: "/api/files/x", version: 3, translations: [{ language: "ar", title: "m", summary: "m", body: "m" }] },
    });
    if (e.status === 201) {
      cleanup.push(async () => {
        await api("POST", `/api/admin/entries/${e.json.id}/unpublish`, { cookie: editor });
        await api("DELETE", `/api/admin/entries/${e.json.id}`, { cookie: editor });
      });
      t.check(e.json.id !== forged && !e.json.isPublished && e.json.displayOrder >= 0 && !e.json.coverImageUrl && !e.json.publishedAt, "entry creation took forged fields", evidence(e, "unpublished, new id, order >= 0"));
      const eu = await api("PUT", `/api/admin/entries/${e.json.id}`, { cookie: editor, json: { category: "nature", isPublished: true, displayOrder: 99, kind: "service", translations: [{ language: "ar", title: "m", summary: "m", body: "m" }], version: e.json.version } });
      t.check(eu.json?.isPublished === false && eu.json?.kind === "place" && eu.json?.displayOrder === e.json.displayOrder, "entry update took forged isPublished/kind/displayOrder", evidence(eu, "unchanged"));
    } else t.fail("entry creation failed", evidence(e, "201"));

    // Council
    const c = await api("POST", "/api/admin/council", { cookie: admin, json: { nameAr: "م", positionAr: "م", id: forged, isActive: false, displayOrder: 999, photoUrl: "/api/files/x" } });
    if (c.status === 201) {
      cleanup.push(() => api("DELETE", `/api/admin/council/${c.json.id}`, { cookie: admin }));
      t.check(c.json.id !== forged && c.json.isActive === true && c.json.displayOrder !== 999 && !c.json.photoUrl, "council creation took forged fields", evidence(c, "defaults"));
    } else t.fail("council creation failed", evidence(c, "201"));

    // Site settings singleton
    const cur = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
    const ss = await api("PUT", "/api/admin/site-settings", { cookie: admin, json: { ...cur, id: 2, updatedAt: "2000-01-01T00:00:00Z", version: cur.version } });
    const n2 = rows(`select count(*) from "SiteSettings"`)[0][0];
    t.check(ss.status === 200 && Number(n2) === 1 && !String(ss.json?.updatedAt).startsWith("2000"), "site settings took id/updatedAt", evidence(ss, "one row, server time"));
  } finally {
    for (const f of cleanup) await f();
  }
});

test(3, "3.5", "IDOR: an Editor cannot read or change other users (or promote itself)", "403", async (t, s) => {
  const editor = s.sessions.cookie("editor");
  const eid = s.sessions.id("editor");
  const aid = s.sessions.id("admin1");
  for (const [m, p, json] of [
    ["GET", `/api/admin/users/${aid}`],
    ["GET", `/api/admin/users/${eid}`],
    ["PUT", `/api/admin/users/${eid}`, { displayName: "self", role: "Admin" }],
    ["PUT", `/api/admin/users/${aid}`, { displayName: "pwned", role: "Editor" }],
    ["POST", `/api/admin/users/${aid}/reset-password`],
    ["POST", `/api/admin/users/${aid}/disable`],
    ["POST", `/api/admin/users/${aid}/force-logout`],
  ]) {
    const r = await api(m, p, { cookie: editor, json });
    t.check(r.status === 403, `${m} ${p} as Editor → ${r.status}`, evidence(r, "403"));
  }
  // change-password only ever affects the caller
  const r = await api("POST", "/api/auth/change-password", { cookie: editor, json: { userId: aid, email: s.sessions.users.admin1.email, currentPassword: "wrong-Password-1", newPassword: "Another-Pass-2026x" } });
  t.check(r.status === 400, "change-password with another user's id did not fail", evidence(r, "400 (wrong current password of the caller)"));
  const me = await api("GET", "/api/auth/me", { cookie: editor });
  t.check(me.json?.id === eid, "/me returned another user", evidence(me, "the caller only"));
});

test(3, "3.6", "Tampered, truncated or forged session cookies", "401", async (t, s) => {
  const good = s.sessions.cookie("editor").split("=").slice(1).join("=");
  const flip = (v, i) => v.slice(0, i) + (v[i] === "A" ? "B" : "A") + v.slice(i + 1);
  const variants = {
    "one char changed (middle)": flip(good, Math.floor(good.length / 2)),
    "one char changed (end)": flip(good, good.length - 3),
    truncated: good.slice(0, Math.floor(good.length / 2)),
    "extra data": good + "AAAA",
    empty: "",
    garbage: "not-a-cookie",
    "base64 of JSON role": Buffer.from('{"role":"Admin"}').toString("base64"),
  };
  for (const [label, v] of Object.entries(variants)) {
    for (const p of ["/api/auth/me", "/api/admin/news"]) {
      const r = await api("GET", p, { cookie: `bsh.session=${v}` });
      t.check(r.status === 401, `${label}: ${p} → ${r.status}`, evidence(r, "401"));
    }
  }
});

test(3, "3.7", "A cookie copied before logout no longer works after logout", "401 after logout", async (t, s) => {
  const u = await extraStaff(s.sessions.cookie("admin1"), "Editor", "logout");
  const before = await api("GET", "/api/auth/me", { cookie: u.cookie });
  t.check(before.status === 200, "fresh session does not work", evidence(before, "200"));
  const out = await api("POST", "/api/auth/logout", { cookie: u.cookie });
  t.check(out.status === 204, "logout failed", evidence(out, "204"));
  const after = await api("GET", "/api/admin/news", { cookie: u.cookie });
  t.check(after.status === 401, `the old cookie still works after logout (${after.status})`, evidence(after, "401 (session ended on the server)"));
  exec(`update "AspNetUsers" set "IsActive"=false where "Id"=${lit(u.id)}`);
});

async function untilRejected(cookie, seconds) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < seconds) {
    const r = await api("GET", "/api/admin/news", { cookie });
    if (r.status === 401 || r.status === 403) return { after: (Date.now() - start) / 1000, status: r.status };
    await new Promise((res) => setTimeout(res, 5000));
  }
  return null;
}

test(3, "3.8", "Disabled, force-logged-out, demoted and password-reset accounts lose their session within about a minute", "401/403 within 75 s", async (t, s) => {
  const admin = s.sessions.cookie("admin1");
  const cases = [
    ["disable", (id) => api("POST", `/api/admin/users/${id}/disable`, { cookie: admin }), "Editor"],
    ["force-logout", (id) => api("POST", `/api/admin/users/${id}/force-logout`, { cookie: admin }), "Editor"],
    ["reset-password", (id) => api("POST", `/api/admin/users/${id}/reset-password`, { cookie: admin }), "Editor"],
  ];
  const started = await Promise.all(
    cases.map(async ([label, action, role]) => {
      const u = await extraStaff(admin, role, label);
      const r = await action(u.id);
      t.check(r.status === 200, `${label} failed`, evidence(r, "200"));
      return [label, u, untilRejected(u.cookie, 90)];
    }),
  );
  // Demotion Admin -> Editor: the Admin-only route must close
  const demoted = await extraStaff(admin, "Admin", "demote");
  const d = await api("PUT", `/api/admin/users/${demoted.id}`, { cookie: admin, json: { displayName: "demoted", role: "Editor" } });
  t.check(d.status === 200, "demote failed", evidence(d, "200"));
  const demoteStart = Date.now();
  let demotedClosed = null;
  while ((Date.now() - demoteStart) / 1000 < 90) {
    const r = await api("GET", "/api/admin/users", { cookie: demoted.cookie });
    if (r.status === 401 || r.status === 403) {
      demotedClosed = (Date.now() - demoteStart) / 1000;
      break;
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
  for (const [label, u, wait] of started) {
    const w = await wait;
    t.check(w && w.after <= 75, `${label}: the open session still worked after ${w ? w.after : ">90"} s`, `GET /api/admin/news with ${u.email}'s cookie`);
    if (w) t.note(`${label}: session ended after ${Math.round(w.after)} s (${w.status}).`);
    const relog = await login(u.email, u.password);
    if (label === "disable") t.check(relog.res.status === 401, "a disabled account can still log in", evidence(relog.res, "401"));
    exec(`update "AspNetUsers" set "IsActive"=false where "Id"=${lit(u.id)}`);
  }
  t.check(demotedClosed !== null && demotedClosed <= 75, `demoted Admin kept Admin access for ${demotedClosed ?? ">90"} s`, "GET /api/admin/users");
  if (demotedClosed !== null) t.note(`demotion: Admin access ended after ${Math.round(demotedClosed)} s.`);
  exec(`update "AspNetUsers" set "IsActive"=false where "Id"=${lit(demoted.id)}`);
});

test(3, "3.9", "Login page returnTo never leaves the site", "stays on the site's own origin", async (t, s) => {
  const payloads = [
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https:evil.example",
    "https://evil.example",
    "http://evil.example/ar/admin",
    "%2F%2Fevil.example",
    "/%2F/evil.example",
    "/%5Cevil.example",
    "/\t/evil.example",
    "/%09/evil.example",
    "////evil.example",
    "/ar/admin/../..//evil.example",
    "javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "/ar/admin@evil.example",
    "。evil.example",
  ];
  const context = await newContext(s.sessions.cookie("editor"));
  const offsite = [];
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
      offsite.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  try {
    for (const p of payloads) {
      const page = await context.newPage();
      const seen = watch(page);
      const before = offsite.length;
      await page.goto(`${s.web}/ar/admin/login?returnTo=${encodeURIComponent(p)}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1500);
      const url = page.url();
      const origin = (() => {
        try {
          return new URL(url).origin;
        } catch {
          return url;
        }
      })();
      t.check(origin === s.web && offsite.length === before, `returnTo=${JSON.stringify(p)} left the site`, `ended at ${url}; off-site requests: ${offsite.slice(before).join(", ")}`);
      t.check(seen.dialogs.length === 0, `returnTo=${JSON.stringify(p)} ran script`, seen.dialogs.join("; "));
      await page.close();
    }
  } finally {
    await context.close();
  }
});
