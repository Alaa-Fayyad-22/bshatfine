// 5. Uploads: refused files leave nothing stored; accepted files are always
// re-encoded WebP served with nosniff; path tricks on /api/files.
import { test } from "../lib/runner.mjs";
import { api, evidence, rawRequest, web } from "../lib/http.mjs";
import { count, lit, orphanFiles, purgeEntry, purgeNews, storedFileCount } from "../lib/db.mjs";
import { createEntry, createNews, imageForm, jpeg, png, pngHeaderBomb, pngZeroBomb } from "../lib/fixtures.mjs";

const BAD = () => [
  ["text named .jpg", Buffer.from("hello, this is not an image"), "fake.jpg", "image/jpeg"],
  ["HTML named .jpg", Buffer.from("<html><body><script>alert(1)</script></body></html>"), "page.jpg", "image/jpeg"],
  ["SVG named .jpg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'), "x.jpg", "image/jpeg"],
  ["SVG as image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml"],
  ["PNG magic + HTML", Buffer.concat([png(1, 1).subarray(0, 16), Buffer.from("<script>alert(1)</script>")]), "poly.png", "image/png"],
  ["JPEG magic + garbage", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 0x41)]), "trunc.jpg", "image/jpeg"],
  ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;"), "a.gif", "image/gif"],
  ["header bomb 30000x30000", pngHeaderBomb(), "bomb.png", "image/png"],
  ["0 bytes", Buffer.alloc(0), "empty.jpg", "image/jpeg"],
];

async function target(cookie, kind) {
  if (kind === "news") return { id: (await createNews(cookie)).id, url: (id) => `/api/admin/news/${id}/cover`, purge: purgeNews };
  return { id: (await createEntry(cookie, "place")).id, url: (id) => `/api/admin/entries/${id}/cover`, purge: purgeEntry };
}

test(5, "5.1", "Refused files: fake, HTML, SVG, polyglot, GIF, header bomb, 0 bytes (news and entry covers)", "400, nothing stored", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  for (const kind of ["news", "entry"]) {
    const tg = await target(cookie, kind);
    try {
      for (const [label, bytes, filename, type] of BAD()) {
        const before = storedFileCount();
        const r = await api("POST", tg.url(tg.id), { cookie, form: imageForm(bytes, { filename, type }) });
        t.check(r.status === 400, `${kind}: ${label} → ${r.status}`, evidence(r, "400"));
        t.check(storedFileCount() === before, `${kind}: ${label} left a stored file`, `StoredFiles ${before} → ${storedFileCount()}`);
      }
    } finally {
      tg.purge(tg.id);
    }
  }
});

test(5, "5.2", "Too large (12 MB) directly and through the website proxy", "413/400, nothing stored", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const tg = await target(cookie, "entry");
  const big = Buffer.concat([jpeg(), Buffer.alloc(12 * 1024 * 1024 - jpeg().length, 0)]);
  try {
    for (const [label, fn] of [["API", api], ["site proxy", web]]) {
      const before = storedFileCount();
      const r = await fn("POST", tg.url(tg.id), { cookie, form: imageForm(big) });
      t.check(r.status === 413 || r.status === 400, `${label}: 12 MB → ${r.status}`, evidence(r, "413 or 400"));
      t.check(storedFileCount() === before, `${label}: 12 MB left a stored file`, `StoredFiles ${before} → ${storedFileCount()}`);
    }
  } finally {
    tg.purge(tg.id);
  }
});

test(5, "5.3", "Wrong form field name, no file, two files", "400, nothing stored, never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const tg = await target(cookie, "entry");
  try {
    const before = storedFileCount();
    const wrong = await api("POST", tg.url(tg.id), { cookie, form: imageForm(png(), { field: "image" }) });
    t.check(wrong.status === 400, `wrong field name → ${wrong.status}`, evidence(wrong, "400"));
    const none = await api("POST", tg.url(tg.id), { cookie, body: "", headers: { "content-type": "multipart/form-data; boundary=zzz" } });
    t.check(none.status === 400, `empty multipart → ${none.status}`, evidence(none, "400"));
    const json = await api("POST", tg.url(tg.id), { cookie, json: { file: "AAAA" } });
    t.check(json.status >= 400 && json.status < 500, `JSON instead of a file → ${json.status}`, evidence(json, "400/415"));
    t.check(storedFileCount() === before, "a refused request stored a file", `StoredFiles ${before} → ${storedFileCount()}`);
  } finally {
    tg.purge(tg.id);
  }
});

test(5, "5.4", "Accepted files are re-encoded: JPEG with a script appended, ../ and NUL in the file name, wrong content type", "200, served as image/webp + nosniff, no script bytes", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const tg = await target(cookie, "entry");
  try {
    for (const [label, bytes, filename, type] of [
      ["JPEG + appended <script>", Buffer.concat([jpeg(), Buffer.from("<script>alert(1)</script><?php system($_GET['c']); ?>")]), "photo.jpg", "image/jpeg"],
      ["../ and NUL in name", png(), "../../etc/passwd\u0000.jpg", "image/png"],
      ["PNG sent as text/html", png(), "page.html", "text/html"],
    ]) {
      const before = storedFileCount();
      const hadCover = count(`select count(*) from "Entries" where "Id"=${lit(tg.id)} and "CoverImagePath" is not null`) > 0;
      const r = await api("POST", tg.url(tg.id), { cookie, form: imageForm(bytes, { filename, type }) });
      if (!t.check(r.status === 200, `${label} → ${r.status}`, evidence(r, "200 (a valid image)"))) continue;
      const url = r.json.coverImageUrl;
      t.check(/^\/api\/files\/[0-9a-f-]{36}$/.test(url), `${label}: cover URL is not /api/files/{guid}`, url);
      const expected = before + (hadCover ? 0 : 1);
      t.check(storedFileCount() === expected, `${label}: ${storedFileCount() - before} files added`, `StoredFiles ${before} → ${storedFileCount()} (expected ${expected}: the old cover is deleted)`);
      for (const [where, fn] of [["API", api], ["site", web]]) {
        const f = await fn("GET", url);
        t.check(f.status === 200, `${where}: served file → ${f.status}`, evidence(f, "200"));
        t.check(f.headers.get("content-type") === "image/webp", `${where}: content type ${f.headers.get("content-type")}`, "image/webp");
        t.check(f.headers.get("x-content-type-options") === "nosniff", `${where}: no nosniff`, "X-Content-Type-Options: nosniff");
        const b = f.bytes ?? Buffer.alloc(0);
        t.check(b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP", `${where}: not a WebP file`, b.subarray(0, 12).toString("hex"));
        t.check(!b.includes("<script") && !b.includes("<?php"), `${where}: the served file still contains the appended script`, "re-encoded bytes only");
      }
    }
  } finally {
    tg.purge(tg.id);
  }
  t.check(orphanFiles().length === 0, "orphan files after the upload tests", JSON.stringify(orphanFiles()));
});

test(5, "5.5", "Decompression bomb under the pixel limit (6300x6300, ~40 KB)", "refused, or accepted quickly with the server still healthy", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const tg = await target(cookie, "entry");
  const bomb = pngZeroBomb();
  try {
    const before = storedFileCount();
    const r = await api("POST", tg.url(tg.id), { cookie, form: imageForm(bomb, { filename: "bomb.png", type: "image/png" }), timeout: 120000 });
    t.note(`${bomb.length} bytes declaring 6300x6300 px → ${r.status} in ${Math.round(r.ms)} ms`);
    t.check(r.status === 200 || r.status === 400, `bomb → ${r.status}`, evidence(r, "400 or 200, never 5xx"));
    if (r.status === 400) t.check(storedFileCount() === before, "refused bomb left a file", `${before} → ${storedFileCount()}`);
    const health = await api("GET", "/api/news?lang=ar");
    t.check(health.status === 200 && health.ms < 3000, "the API is slow or down after the bomb", evidence(health, "200 quickly"));
    // Five at once: the server must stay up
    const many = await Promise.all(Array.from({ length: 5 }, () => api("POST", tg.url(tg.id), { cookie, form: imageForm(bomb, { filename: "b.png", type: "image/png" }), timeout: 180000 })));
    const statuses = many.map((m) => m.status);
    t.note(`5 parallel bombs → ${statuses.join(", ")} (slowest ${Math.round(Math.max(...many.map((m) => m.ms)))} ms)`);
    t.check(statuses.every((x) => x > 0 && x < 500), "a parallel bomb upload failed with a server error", statuses.join(", "));
    const health2 = await api("GET", "/api/news?lang=ar");
    t.check(health2.status === 200, "the API is down after parallel bombs", evidence(health2, "200"));
  } finally {
    tg.purge(tg.id);
  }
});

test(5, "5.6", "News cover uploads are rate limited like entry and council uploads", "429 after 20 uploads a minute", async (t, s) => {
  const cookie = s.sessions.cookie("admin2");
  const tg = await target(cookie, "news");
  try {
    let limited = 0;
    for (let i = 0; i < 24; i++) {
      const r = await api("POST", tg.url(tg.id), { cookie, form: imageForm(png(4, 4), { type: "image/png", filename: "a.png" }), retry429: false });
      if (r.status === 429) limited++;
    }
    t.check(limited > 0, "24 news cover uploads in a row were never rate limited", "POST /api/admin/news/{id}/cover ×24 → no 429 (entries and council use the 20/min uploads policy)");
  } finally {
    tg.purge(tg.id);
  }
});

test(5, "5.7", "/api/files path tricks: ../, %2e%2e, non-GUID ids, unknown GUID (API and site)", "404/400, never a file or 5xx", async (t, s) => {
  for (const [label, base] of [["API", s.api], ["site", s.web]]) {
    for (const p of [
      "/api/files/../",
      "/api/files/..%2f..%2fapi%2fadmin%2fusers",
      "/api/files/%2e%2e/%2e%2e/api/admin/users",
      "/api/files/%2e%2e%2f",
      "/api/files/..\\..\\web.config",
      "/api/files/not-a-guid",
      "/api/files/00000000-0000-0000-0000-000000000000",
      "/api/files/01900000-0000-7000-8000-000000000001%00.jpg",
      "/api/files/{01900000-0000-7000-8000-000000000001}",
      "/api/files/%00",
    ]) {
      const r = await rawRequest(base, "GET", p);
      t.check(r.status > 0 && r.status < 500 && r.status !== 200, `${label} ${p} → ${r.status}`, evidence(r, "404 or 400"));
    }
  }
});
