// Bshatfine - import Facebook posts (Excel export saved as CSV UTF-8) as news on STAGING.
//
//   node tests/seed/import-news.mjs <file.csv> --dry-run   show what would be imported, send nothing
//   node tests/seed/import-news.mjs <file.csv>             import and publish (Arabic only)
//
// - Imports only rows whose "Website category" is News and whose "Title" (the post text) is not empty.
// - Can be run again: posts already imported (by Post ID) are skipped.
// - Writes tests/seed/import-news.sql for the Neon SQL Editor. Run it once after the import:
//     * deletes the sample news created by seed-staging.mjs (and their cover photos)
//     * sets every imported article's date to the original Facebook date (Beirut time)
//
// Logs in as the staging Editor from STAGING_EDITOR_EMAIL / STAGING_EDITOR_PASSWORD (never printed or saved).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://bshatfine.vercel.app";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "import-manifest.json");
const SEED_MANIFEST = path.join(HERE, "seed-manifest.json");
const SQL_OUT = path.join(HERE, "import-news.sql");
const DRY = process.argv.includes("--dry-run");
const CSV_PATH = process.argv.slice(2).find((a) => !a.startsWith("--"));
const GAP_MS = 700;
const TITLE_MAX = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = "";

// ---------------------------------------------------------------- CSV (quotes, line breaks inside quotes, , ; or tab)
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n/) >>> 0);
  const delim = ["\t", ";", ","].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ---------------------------------------------------------------- title and date
function makeTitle(text) {
  const lines = text.split(/\r?\n/).map((s) => s.replace(/#/g, "").replace(/\s+/g, " ").trim()).filter((s) => /\p{L}/u.test(s));
  let t = lines[0] ?? "";
  if (t.length > TITLE_MAX) {
    const cut = t.slice(0, TITLE_MAX);
    const stop = Math.max(...[".", "!", "؟", "?"].map((p) => cut.lastIndexOf(p)));
    const comma = Math.max(cut.lastIndexOf("،"), cut.lastIndexOf(","));
    t = stop >= 40 ? cut.slice(0, stop + 1)          // end of a sentence
      : comma >= 50 ? cut.slice(0, comma)            // end of a clause
      : cut.slice(0, cut.lastIndexOf(" ")) + "…";    // end of a word
  }
  return t.replace(/^[^\p{L}\p{N}«"(]+/u, "").replace(/[\s،,:؛\-–]+$/u, "").trim();
}

function toIsoLocal(date, time) {
  let y, m, d;
  let mt = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mt) [, y, m, d] = mt;
  else if ((mt = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
    // Excel slash dates: assume month/day unless the first number cannot be a month
    [, m, d, y] = mt;
    if (Number(m) > 12) [m, d] = [d, m];
  } else return null;
  const tm = (time || "0:00").match(/^(\d{1,2}):(\d{2})/) ?? [null, "0", "00"];
  const p = (n) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)} ${p(tm[1])}:${tm[2]}`;
}

// ---------------------------------------------------------------- HTTP (same as seed-staging.mjs)
async function api(method, url, { json, quiet } = {}) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    await sleep(GAP_MS);
    const headers = { Origin: SITE, Accept: "application/json" };
    if (cookie) headers.Cookie = cookie;
    let body;
    if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
    let res;
    try { res = await fetch(SITE + url, { method, headers, body, redirect: "manual" }); }
    catch { console.log(`  ...network error, the API may be waking up (try ${attempt})`); await sleep(5000); continue; }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
    if (setCookies.length) {
      const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
      for (const sc of setCookies) { const pair = sc.split(";")[0]; jar.set(pair.split("=")[0], pair); }
      cookie = [...jar.values()].join("; ");
    }
    if (res.status === 429) { const w = Number(res.headers.get("retry-after") || 30); console.log(`  ...rate limit, waiting ${w} s`); await sleep((w + 1) * 1000); continue; }
    if ([502, 503, 504].includes(res.status)) { console.log(`  ...${res.status}, the API may be waking up (try ${attempt})`); await sleep(6000); continue; }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok && !quiet) {
      const detail = data && typeof data === "object" ? (data.detail || data.title || JSON.stringify(data.errors || data)) : text;
      console.log(`  ! ${method} ${url} -> ${res.status} ${String(detail).slice(0, 300)}`);
    }
    return { status: res.status, ok: res.ok, data };
  }
  throw new Error(`Gave up on ${method} ${url}`);
}

async function login() {
  const email = process.env.STAGING_EDITOR_EMAIL, password = process.env.STAGING_EDITOR_PASSWORD;
  if (!email || !password) { console.log("Set STAGING_EDITOR_EMAIL and STAGING_EDITOR_PASSWORD first."); process.exit(1); }
  console.log("Waking the API up...");
  for (let i = 0; i < 12; i++) { if ((await api("GET", "/api/news?lang=ar", { quiet: true })).ok) break; await sleep(5000); }
  const r = await api("POST", "/api/auth/login", { json: { email, password } });
  if (!r.ok) { console.log("Login failed. Is the staging account enabled and the password right?"); process.exit(1); }
  console.log("Logged in.\n");
}

// ---------------------------------------------------------------- SQL file
const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;
function writeSql(imported) {
  const seed = fs.existsSync(SEED_MANIFEST) ? JSON.parse(fs.readFileSync(SEED_MANIFEST, "utf8")) : { items: [] };
  const sampleIds = seed.items.filter((i) => i.type === "news").map((i) => sqlText(i.id));
  const lines = ["-- Generated by import-news.mjs. Run once in the Neon SQL Editor (main branch).", "BEGIN;", ""];
  if (sampleIds.length) {
    lines.push("-- 1. remove the sample news and their cover photos",
      `DELETE FROM "StoredFiles" WHERE "Id"::text IN (SELECT "CoverImagePath" FROM "News" WHERE "Id"::text IN (${sampleIds.join(", ")}) AND "CoverImagePath" IS NOT NULL);`,
      `DELETE FROM "News" WHERE "Id"::text IN (${sampleIds.join(", ")});`, "");
  }
  lines.push("-- 2. original Facebook dates (Beirut time)");
  for (const it of imported) if (it.localTime)
    lines.push(`UPDATE "News" SET "PublishedAt" = (TIMESTAMP ${sqlText(it.localTime)} AT TIME ZONE 'Asia/Beirut') WHERE "Id"::text = ${sqlText(it.id)};`);
  lines.push("", "COMMIT;", "",
    `SELECT count(*) AS news_total, min("PublishedAt") AS oldest, max("PublishedAt") AS newest FROM "News";`);
  fs.writeFileSync(SQL_OUT, lines.join("\n") + "\n");
}

// ---------------------------------------------------------------- main
async function main() {
  if (!CSV_PATH || !fs.existsSync(CSV_PATH)) { console.log("Usage: node tests/seed/import-news.mjs <file.csv> [--dry-run]"); process.exit(1); }
  const text = fs.readFileSync(CSV_PATH, "utf8");
  if (text.includes("�") || !/\p{Script=Arabic}/u.test(text)) {
    console.log("The Arabic text looks broken. In Excel use File > Save As > \"CSV UTF-8 (Comma delimited)\".");
    process.exit(1);
  }
  const rows = parseCsv(text);
  // Two layouts are accepted:
  //  - the full Facebook export: Date, Time, Title (post text), Post ID, Website category
  //  - the "News for website" sheet: Date, Headline, Full text, Permalink (every row is news)
  const cols = rows[0] ?? {};
  const textCol = "full text" in cols ? "full text" : "title";
  const missing = ["date", textCol].filter((c) => !(c in cols));
  if (!("post id" in cols) && !("permalink" in cols)) missing.push("permalink");
  if (missing.length) { console.log(`Missing column(s): ${missing.join(", ")}`); process.exit(1); }
  const sameDay = new Map(); // posts without a time: keep the file order within a day (12:00, 12:01, ...)

  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { site: SITE, items: [] };
  const already = new Set(manifest.items.map((i) => i.postId));
  const seen = new Set();
  const posts = [];
  let skippedCategory = 0, skippedEmpty = 0, skippedDone = 0, badDate = 0;
  for (const r of rows) {
    if ("website category" in r && r["website category"].toLowerCase() !== "news") { skippedCategory++; continue; }
    const body = (r[textCol] ?? "").replace(/\r\n/g, "\n").trim();
    // a ready headline is used unless the export cut it short with "…"
    const headline = (r["headline"] ?? "").replace(/#/g, "").replace(/\s+/g, " ").trim();
    const title = headline && !/(…|\.\.\.)$/.test(headline) && headline.length <= 200
      ? headline.replace(/[\s،,:؛\-–]+$/u, "") : makeTitle(body);
    if (!title || !body) { skippedEmpty++; continue; }
    const postId = r["post id"] || r["permalink"];
    if (seen.has(postId)) continue;
    seen.add(postId);
    if (already.has(postId)) { skippedDone++; continue; }
    let time = r["time"];
    if (!time) {
      const n = sameDay.get(r["date"]) ?? 0;
      sameDay.set(r["date"], n + 1);
      time = `12:${String(n).padStart(2, "0")}`;
    }
    const localTime = toIsoLocal(r["date"], time);
    if (!localTime) badDate++;
    posts.push({ postId, title, body, localTime });
  }
  posts.sort((a, b) => String(a.localTime).localeCompare(String(b.localTime))); // oldest first

  console.log(`Rows: ${rows.length}. To import: ${posts.length}. Skipped: ${skippedCategory} not news, ${skippedEmpty} without text, ${skippedDone} already imported.`);
  if (badDate) console.log(`Warning: ${badDate} post(s) have a date I can't read; they keep today's date.`);

  if (DRY) {
    for (const p of posts) console.log(`  ${p.localTime ?? "?"}  ${p.title}`);
    return;
  }
  if (!posts.length) { writeSql(manifest.items); console.log(`Nothing new to import. SQL file: ${SQL_OUT}`); return; }

  await login();
  let ok = 0, failed = 0;
  for (const p of posts) {
    console.log(`${p.localTime}  ${p.title}`);
    const c = await api("POST", "/api/admin/news", { json: { translations: [{ language: "ar", title: p.title, body: p.body }] } });
    if (!c.ok || !c.data?.id) { failed++; console.log("  FAILED to create\n"); continue; }
    manifest.items.push({ postId: p.postId, id: c.data.id, localTime: p.localTime, title: p.title });
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    const pub = await api("POST", `/api/admin/news/${c.data.id}/publish`);
    if (pub.ok) { ok++; console.log("  published\n"); } else { failed++; console.log("  created as a draft, NOT published\n"); }
  }
  await api("POST", "/api/auth/logout", { quiet: true });
  writeSql(manifest.items);
  console.log(`Done: ${ok} published, ${failed} failed.`);
  console.log(`Now run ${SQL_OUT} in the Neon SQL Editor (removes the sample news, sets the original dates).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
