// 2. Stored XSS: script payloads saved in every text staff can save, then
// every public and admin page that shows them opened in Chrome with dialog,
// alert-counter and CSP-violation listeners. Each saved text carries a unique
// marker, so a page that does not show the payload is reported as NOT TESTED
// instead of passing by accident.
import { test } from "../lib/runner.mjs";
import { api, evidence } from "../lib/http.mjs";
import { exec, lit, purgeCouncil, purgeEntry, purgeNews } from "../lib/db.mjs";
import { createCouncil, createEntry, createNews, extraStaff, KIND_DETAILS } from "../lib/fixtures.mjs";
import { domFindings, newContext, watch } from "../lib/browser.mjs";

const MARK = `XSSMARK${Date.now().toString(36)}`;

const INLINE = [
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)>`,
  `<svg onload=alert(1)>`,
  `"><script>alert(1)</script>`,
  `<iframe src="javascript:alert(1)"></iframe>`,
  `<a href="javascript:alert(1)">html-link</a>`,
  `javascript:alert(1)`,
].join(" ");

const MARKDOWN = [
  `[md-js-link](javascript:alert(1))`,
  `[md-js-encoded](jav&#x09;ascript:alert(1))`,
  `[md-data-link](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)`,
  `[md-vbs](vbscript:msgbox(1))`,
  `![md-js-img](javascript:alert(1))`,
  `![md-data-img](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)`,
  `<details open ontoggle=alert(1)>x</details>`,
  `<style>@import "javascript:alert(1)"</style>`,
].join("\n\n");

const title = (n) => `${MARK}-${n} <img src=x onerror=alert(1)><svg onload=alert(1)>`;
const text = (n) => `${MARK}-${n} ${INLINE}`;
const body = (n) => `${MARK}-${n}\n\n${INLINE}\n\n${MARKDOWN}`;

const state = { news: null, entries: {}, council: null, user: null, settingsBefore: null };

test(2, "2.1", "Save script payloads in news, entries (all kinds), council, contact details, user names", "saved as plain text (201/200)", async (t, s) => {
  const editor = s.sessions.cookie("editor");
  const admin = s.sessions.cookie("admin1");
  // News, Arabic + English, published
  state.news = await createNews(editor, { ar: { title: title("news-ar"), body: body("news-ar") }, en: { title: title("news-en"), body: body("news-en") } });
  const pub = await api("POST", `/api/admin/news/${state.news.id}/publish`, { cookie: editor });
  t.check(pub.status === 200, "news publish failed", evidence(pub, "200"));
  state.news = pub.json ?? state.news;
  // One published entry per kind
  for (const kind of Object.keys(KIND_DETAILS)) {
    const e = await createEntry(editor, kind, {
      ar: { title: title(`${kind}-ar`), summary: text(`${kind}-sum-ar`), body: body(`${kind}-ar`) },
      en: { title: title(`${kind}-en`), summary: text(`${kind}-sum-en`), body: body(`${kind}-en`) },
    });
    const p = await api("POST", `/api/admin/entries/${e.id}/publish`, { cookie: editor });
    t.check(p.status === 200, `${kind} publish failed`, evidence(p, "200"));
    state.entries[kind] = e;
  }
  // Council member (active by default)
  state.council = await createCouncil(admin, {
    nameAr: title("council-ar").slice(0, 100),
    nameEn: title("council-en").slice(0, 100),
    positionAr: `${MARK}-pos <script>alert(1)</script>`.slice(0, 100),
    positionEn: `${MARK}-pos <img src=x onerror=alert(1)>`.slice(0, 100),
  });
  // Contact details: free texts accept the payload as text
  const cur = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
  state.settingsBefore = cur;
  const saved = await api("PUT", "/api/admin/site-settings", {
    cookie: admin,
    json: {
      ...cur,
      addressAr: `${MARK}-addr <img src=x onerror=alert(1)>`,
      addressEn: `${MARK}-addr <script>alert(1)</script>`,
      openingHoursAr: `${MARK}-hours <svg onload=alert(1)>`,
      openingHoursEn: `${MARK}-hours "><script>alert(1)</script>`,
      phone: "+970 2 123 4567",
      email: "contact@example.test",
      version: cur.version,
    },
  });
  t.check(saved.status === 200, "contact details with text payloads were refused", evidence(saved, "200 (stored as text)"));
  // A staff user whose display name is a payload
  state.user = await extraStaff(admin, "Editor", "xss");
  const named = await api("PUT", `/api/admin/users/${state.user.id}`, {
    cookie: admin,
    json: { displayName: `${MARK}-user <img src=x onerror=alert(1)>`, role: "Editor" },
  });
  t.check(named.status === 200, "display name with payload refused", evidence(named, "200 (stored as text)"));
});

test(2, "2.2", "Contact links refuse javascript:, data:, http: and malformed addresses", "400 for each unsafe link", async (t, s) => {
  const admin = s.sessions.cookie("admin1");
  const bad = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "http://evil.example/",
    "//evil.example/",
    "https:evil.example",
    "file:///etc/passwd",
  ];
  for (const field of ["mapUrl", "facebookUrl", "instagramUrl"]) {
    for (const url of bad) {
      const cur = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
      const res = await api("PUT", "/api/admin/site-settings", { cookie: admin, json: { ...cur, [field]: url, version: cur.version } });
      if (res.status === 200) {
        const stored = res.json?.[field];
        t.check(
          typeof stored === "string" && stored.startsWith("https://"),
          `${field} accepted "${url}" (stored "${stored}")`,
          evidence(res, "400"),
        );
      }
    }
  }
  // A quote inside an https URL must not break out of an attribute
  const cur = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
  const q = await api("PUT", "/api/admin/site-settings", {
    cookie: admin,
    json: { ...cur, mapUrl: `https://evil.example/" onmouseover="alert(1)`, version: cur.version },
  });
  if (q.status === 200) t.check(!q.json.mapUrl.includes('"'), "a raw quote was stored in mapUrl", evidence(q, "400 or the quote encoded"));
  for (const email of [`"<script>alert(1)</script>"@example.test`, `a@b.c<script>`, `javascript:alert(1)@example.test`, `x@example.test\r\nBcc: y@example.test`]) {
    const c = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
    const res = await api("PUT", "/api/admin/site-settings", { cookie: admin, json: { ...c, email, version: c.version } });
    t.check(res.status === 400, `contact e-mail "${email.slice(0, 40)}" was accepted`, evidence(res, "400"));
  }
  for (const phone of [`<script>alert(1)</script>`, `javascript:alert(1)`, `+1 234 567"onclick="x`]) {
    const c = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
    const res = await api("PUT", "/api/admin/site-settings", { cookie: admin, json: { ...c, phone, version: c.version } });
    t.check(res.status === 400, `phone "${phone}" was accepted`, evidence(res, "400"));
  }
});

async function visit(t, s, cookie, pages, marker = MARK) {
  const context = await newContext(cookie);
  try {
    for (const path of pages) {
      const page = await context.newPage();
      const seen = watch(page);
      let status = 0;
      try {
        const res = await page.goto(s.web + path, { waitUntil: "networkidle", timeout: 45000 });
        status = res?.status() ?? 0;
        await page.waitForTimeout(800); // let client components render and any payload fire
        // Hover and click everything the payloads might have turned into links
        for (const a of await page.locator("main a").all()) {
          const href = (await a.getAttribute("href")) ?? "";
          if (/javascript|data:|vbscript/i.test(href)) await a.click({ timeout: 1000, noWaitAfter: true }).catch(() => {});
        }
      } catch (e) {
        t.fail(`${path}: page did not load (${String(e.message).split("\n")[0]})`, `GET ${s.web}${path}`);
        await page.close();
        continue;
      }
      const f = await domFindings(page);
      const where = `${path} (HTTP ${status})`;
      if (!f.text.includes(marker)) t.note(`NOT TESTED on ${path}: the saved text is not shown there.`);
      t.check(seen.dialogs.length === 0, `${where}: a dialog opened`, seen.dialogs.join("; "));
      t.check(f.xss === 0, `${where}: alert/confirm/prompt was called ${f.xss}×`, "window.alert counter");
      t.check(f.links.length === 0, `${where}: unsafe link(s) rendered`, f.links.join(" | "));
      t.check(f.srcs.length === 0, `${where}: javascript: in src/action`, f.srcs.join(" | "));
      t.check(f.handlers.length === 0, `${where}: inline event handler attribute(s)`, f.handlers.slice(0, 5).join(" | "));
      t.check(f.scripts.length === 0, `${where}: a script containing the payload`, f.scripts.join(" | "));
      t.check(f.injected === 0, `${where}: injected iframe/object/embed/base/meta in the content`, `${f.injected}`);
      const csp = [...f.csp, ...seen.cspConsole];
      t.check(csp.length === 0, `${where}: CSP violation(s)`, csp.join(" | "));
      await page.close();
    }
  } finally {
    await context.close();
  }
}

test(2, "2.3", "Public pages show the payloads as text (AR and EN)", "no dialog, no script, no unsafe link, no CSP violation", async (t, s) => {
  if (!state.news) t.skip("2.1 did not save the payloads");
  const slug = state.news.slug;
  const pages = [];
  for (const l of ["ar", "en"]) {
    pages.push(`/${l}`, `/${l}/news`, `/${l}/news/${slug}`, `/${l}/discover`, `/${l}/municipality`, `/${l}/services`, `/${l}/contact`);
    for (const e of Object.values(state.entries)) pages.push(`/${l}/entries/${e.id}`);
  }
  await visit(t, s, null, pages);
});

test(2, "2.4", "Admin pages show the payloads as text", "no dialog, no script, no unsafe link, no CSP violation", async (t, s) => {
  if (!state.news) t.skip("2.1 did not save the payloads");
  const pages = [
    "/ar/admin",
    "/ar/admin/news",
    `/ar/admin/news/${state.news.id}`,
    ...Object.keys(state.entries).map((k) => `/ar/admin/content?kind=${k}`),
    ...Object.values(state.entries).map((e) => `/ar/admin/content/${e.id}`),
    "/ar/admin/council",
    "/ar/admin/contact",
    "/ar/admin/users",
    "/ar/admin/audit",
    "/en/admin/users",
    "/en/admin/audit",
  ];
  await visit(t, s, s.sessions.cookie("admin1"), pages);
});

test(2, "2.5", "Admin editors: Markdown preview tab with the payloads", "the live preview renders safely", async (t, s) => {
  if (!state.news) t.skip("2.1 did not save the payloads");
  const context = await newContext(s.sessions.cookie("admin1"));
  try {
    for (const path of [`/ar/admin/news/${state.news.id}`, `/ar/admin/content/${state.entries.project.id}`]) {
      const page = await context.newPage();
      const seen = watch(page);
      await page.goto(s.web + path, { waitUntil: "networkidle" });
      // Open every "preview"-like tab or button the editor has
      for (const b of await page.getByRole("tab").all()) await b.click({ timeout: 1000 }).catch(() => {});
      for (const b of await page.locator("button").filter({ hasText: /معاينة|Preview/i }).all())
        await b.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(800);
      const f = await domFindings(page);
      t.check(seen.dialogs.length === 0 && f.xss === 0, `${path}: script ran in the preview`, seen.dialogs.join("; "));
      t.check(f.links.length === 0, `${path}: unsafe link in the preview`, f.links.join(" | "));
      t.check(f.handlers.length === 0, `${path}: inline handler in the preview`, f.handlers.slice(0, 5).join(" | "));
      await page.close();
    }
  } finally {
    await context.close();
  }
});

test(2, "2.6", "Clean-up of the XSS data", "everything created by group 2 removed", async (t, s) => {
  const admin = s.sessions.cookie("admin1");
  if (state.news) purgeNews(state.news.id);
  for (const e of Object.values(state.entries)) purgeEntry(e.id);
  if (state.council) purgeCouncil(state.council.id);
  if (state.user) exec(`delete from "AspNetUserRoles" where "UserId"=${lit(state.user.id)}; delete from "AspNetUsers" where "Id"=${lit(state.user.id)};`);
  if (state.settingsBefore) {
    const now = (await api("GET", "/api/admin/site-settings", { cookie: admin })).json;
    const res = await api("PUT", "/api/admin/site-settings", { cookie: admin, json: { ...state.settingsBefore, version: now.version } });
    t.check(res.status === 200, "contact details not restored", evidence(res, "200"));
  }
});
