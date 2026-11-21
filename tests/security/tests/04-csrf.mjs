// 4. CSRF and origins. A browser holding the Admin's session opens an
// attacker page that posts to the site. 127.0.0.1:<port> is a different SITE
// from localhost (cross-site); localhost:<port> is the SAME site on another
// port (SameSite does not look at ports), shown separately.
import http from "node:http";
import { test } from "../lib/runner.mjs";
import { api, evidence, web } from "../lib/http.mjs";
import { config } from "../lib/config.mjs";
import { createNews, png } from "../lib/fixtures.mjs";
import { purgeNews } from "../lib/db.mjs";
import { newContext } from "../lib/browser.mjs";

function attackerServer(html) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(config.attackerPort, () => resolve(server)));
}

function attackPage(target, newsId) {
  const pngB64 = png(8, 8).toString("base64");
  return `<!doctype html><html><body>
<iframe name="sink" style="display:none"></iframe>
<form id="f1" method="POST" action="${target}/api/admin/news/${newsId}/publish" target="sink"></form>
<form id="f2" method="POST" action="${target}/api/admin/news/${newsId}/archive" target="sink" enctype="text/plain"><input name='{"a":"' value='"}'></form>
<script>
  document.getElementById("f1").submit();
  setTimeout(() => document.getElementById("f2").submit(), 300);
  const bytes = Uint8Array.from(atob("${pngB64}"), c => c.charCodeAt(0));
  const fd = new FormData(); fd.append("file", new Blob([bytes], { type: "image/png" }), "a.png");
  fetch("${target}/api/admin/news/${newsId}/cover", { method: "POST", mode: "no-cors", credentials: "include", body: fd });
  fetch("${target}/api/admin/news/${newsId}", { method: "PUT", mode: "no-cors", credentials: "include",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ translations: [{ language: "ar", title: "CSRF", body: "CSRF" }], version: 0 }) });
</script></body></html>`;
}

async function runAttack(t, s, attackerHost) {
  const editor = s.sessions.cookie("admin1");
  const draft = await createNews(editor, { ar: { title: "csrf-target", body: "csrf" } });
  const server = await attackerServer(attackPage(s.web, draft.id));
  const context = await newContext(editor);
  const cookieSeen = [];
  context.on("request", (req) => {
    if (req.url().startsWith(s.web + "/api/")) cookieSeen.push(`${req.method()} ${req.url()}`);
  });
  try {
    const page = await context.newPage();
    // capture whether the browser attached the session cookie
    const sent = [];
    page.on("request", async (req) => {
      if (req.url().startsWith(s.web + "/api/")) {
        const h = await req.allHeaders();
        sent.push(`${req.method()} ${new URL(req.url()).pathname} cookie=${/bsh\.session=/.test(h.cookie ?? "") ? "SENT" : "not sent"}`);
      }
    });
    await page.goto(`http://${attackerHost}:${config.attackerPort}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const after = await api("GET", `/api/admin/news/${draft.id}`, { cookie: editor });
    return { draft, after, sent };
  } finally {
    await context.close();
    server.close();
  }
}

test(4, "4.1", "Cross-site attacker page (127.0.0.1 → localhost): form posts and no-cors fetches", "cookie not sent, article unchanged", async (t, s) => {
  const { draft, after, sent } = await runAttack(t, s, "127.0.0.1");
  t.note(`requests the attacker page made: ${sent.join("; ") || "none"}`);
  t.check(!sent.some((x) => x.includes("cookie=SENT")), "the session cookie was sent cross-site", sent.join("; "));
  const a = after.json;
  t.check(a.status === "Draft" && !a.coverImageUrl && a.translations[0].title === "csrf-target", "the attack changed the article", evidence(after, "still a draft, no cover, same title"));
  await api("DELETE", `/api/admin/news/${draft.id}`, { cookie: s.sessions.cookie("admin1") });
});

test(4, "4.2", "Same-site attacker page on another port (localhost:4444 → localhost:3001)", "the action must not happen", async (t, s) => {
  const { draft, after, sent } = await runAttack(t, s, "localhost");
  t.note(`requests the attacker page made: ${sent.join("; ") || "none"}`);
  t.note("Ports do not make a different site, so SameSite=Strict still sends the cookie here; only server-side checks (Origin/antiforgery, JSON-only bodies) can stop it.");
  const a = after.json;
  if (a.status !== "Draft") t.fail(`a body-less form POST from another origin changed the article to ${a.status}`, evidence(after, "Draft (request refused: foreign Origin)"));
  if (a.coverImageUrl) t.fail("a no-cors multipart upload from another origin set the cover", evidence(after, "no cover"));
  if (a.translations[0].title !== "csrf-target") t.fail("a text/plain JSON body from another origin changed the title", evidence(after, "title unchanged"));
  const fresh = await api("GET", `/api/admin/news/${draft.id}`, { cookie: s.sessions.cookie("admin1") });
  if (fresh.json?.status === "Draft") await api("DELETE", `/api/admin/news/${draft.id}`, { cookie: s.sessions.cookie("admin1") });
  else purgeNews(draft.id);
});

test(4, "4.3", "State-changing requests carrying a foreign Origin / Referer (valid cookie)", "refused (403/400)", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  for (const [label, headers] of [
    ["Origin https://evil.example", { origin: "https://evil.example" }],
    ["Origin null", { origin: "null" }],
    ["Referer only", { referer: "https://evil.example/page" }],
  ]) {
    const draft = await createNews(cookie, { ar: { title: "origin", body: "origin" } });
    const r = await api("POST", `/api/admin/news/${draft.id}/publish`, { cookie, headers });
    t.check(r.status === 403 || r.status === 400, `${label}: publish accepted (${r.status})`, evidence(r, "403 (Origin not this site)"));
    purgeNews(draft.id);
  }
});

test(4, "4.4", "JSON endpoints refuse non-JSON (form / text/plain) bodies", "415 or 400, nothing created", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  const body = JSON.stringify({ translations: [{ language: "ar", title: "plain", body: "plain" }] });
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
    const r = await api("POST", "/api/admin/news", { cookie, body, headers: { "content-type": type } });
    t.check(r.status === 415 || r.status === 400, `${type}: ${r.status}`, evidence(r, "415"));
    if (r.status === 201) await api("DELETE", `/api/admin/news/${r.json.id}`, { cookie });
  }
});

test(4, "4.5", "CORS answers for foreign origins (API and site)", "no Access-Control-Allow-Origin for foreign origins", async (t) => {
  for (const origin of ["https://evil.example", "null", "http://localhost:4444", "http://localhost:3000.evil.example"]) {
    for (const [base, fn] of [["API", api], ["site", web]]) {
      const pre = await fn("OPTIONS", "/api/admin/news", {
        headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
      });
      const get = await fn("GET", "/api/news?lang=ar", { headers: { origin } });
      for (const r of [pre, get]) {
        const acao = r.headers.get("access-control-allow-origin");
        t.check(!acao || (acao !== origin && acao !== "*"), `${base} ${r.method}: Access-Control-Allow-Origin "${acao}" for ${origin}`, evidence(r, "no ACAO header"));
      }
    }
  }
  const dev = await api("OPTIONS", "/api/admin/news", { headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" } });
  t.note(`API preflight for the configured origin http://localhost:3000: ACAO=${dev.headers.get("access-control-allow-origin")}, credentials=${dev.headers.get("access-control-allow-credentials")}`);
});
