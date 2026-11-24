// Bshatfine - fill STAGING with sample content (news, entries, events, notices).
//
//   node tests/seed/seed-staging.mjs --dry-run   show what would be created, send nothing
//   node tests/seed/seed-staging.mjs             create, add covers, publish
//   node tests/seed/seed-staging.mjs --cleanup   remove everything this script created
//
// Logs in as the staging Editor from the environment variables
// STAGING_EDITOR_EMAIL and STAGING_EDITOR_PASSWORD (never printed or saved).
// Talks ONLY to the website (its /api proxy), never to Render directly.
// Plain Node 18+, no packages needed.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { CONTENT } from "./seed-content.mjs";

const SITE = "https://bshatfine.vercel.app";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "seed-manifest.json");
const MODE = process.argv.includes("--cleanup") ? "cleanup"
           : process.argv.includes("--dry-run") ? "dry-run" : "seed";
const ONLY_MISSING = process.argv.includes("--missing"); // add only items not yet in the manifest

const GAP_MS = 700;         // between requests (admin limit is 120/min)
const UPLOAD_GAP_MS = 4000; // between uploads (upload limit is 20/min)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = "";
let lastUpload = 0;

// ---------------------------------------------------------------- HTTP
async function api(method, url, { json, form, quiet } = {}) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    await sleep(GAP_MS);
    const headers = { Origin: SITE, Accept: "application/json" };
    if (cookie) headers.Cookie = cookie;
    let body;
    if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
    if (form) body = form;

    let res;
    try {
      res = await fetch(SITE + url, { method, headers, body, redirect: "manual" });
    } catch {
      console.log(`  ...network error, the API may be waking up (try ${attempt})`);
      await sleep(5000);
      continue;
    }

    const setCookies = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
    if (setCookies.length) {
      const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
      for (const sc of setCookies) { const pair = sc.split(";")[0]; jar.set(pair.split("=")[0], pair); }
      cookie = [...jar.values()].join("; ");
    }

    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 30);
      console.log(`  ...rate limit, waiting ${wait} s`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    if ([502, 503, 504].includes(res.status)) {
      console.log(`  ...${res.status}, the API may be waking up (try ${attempt})`);
      await sleep(6000);
      continue;
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok && !quiet) {
      const detail = data && typeof data === "object" ? (data.detail || data.title || JSON.stringify(data.errors || data)) : text;
      console.log(`  ! ${method} ${url} -> ${res.status} ${String(detail).slice(0, 300)}`);
    }
    return { status: res.status, ok: res.ok, data };
  }
  throw new Error(`Gave up on ${method} ${url}`);
}

async function upload(url, png) {
  const wait = lastUpload + UPLOAD_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastUpload = Date.now();
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "cover.png");
  return api("POST", url, { form });
}

// ---------------------------------------------------------------- cover images (PNG, no packages)
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// palette: [sky top, sky bottom, sun, far hills, near hills]
const PALETTES = {
  news:     ["#cfe3ea", "#f4ead2", "#f6d58a", "#8fa98a", "#55724f"],
  history:  ["#e9d9bf", "#f6eee0", "#e7b877", "#b39b7a", "#7d6a50"],
  project:  ["#bfd8e6", "#eef4f2", "#f3cf7a", "#7fa6a0", "#3f6f68"],
  place:    ["#d7e7d0", "#f5f1df", "#f2c46d", "#93ad7c", "#4f6e3f"],
  service:  ["#dde3ee", "#f3f2ec", "#e9c98b", "#9aa7b8", "#5c6a80"],
  event:    ["#f1d8c4", "#f8efe3", "#f0a868", "#b8977a", "#7b5c49"],
};

function coverPng(section, seed) {
  const W = 1600, H = 900;
  const [skyTop, skyBot, sun, far, near] = PALETTES[section].map(hex);
  const ph = seed * 1.7, sunX = 300 + ((seed * 337) % 1000), sunY = 210 + ((seed * 53) % 120), sunR = 70;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      let c = mix(skyTop, skyBot, y / H);
      const d = Math.hypot(x - sunX, y - sunY);
      if (d < sunR) c = sun; else if (d < sunR * 2.2) c = mix(sun, c, (d - sunR) / (sunR * 1.2));
      const farY = 560 + 60 * Math.sin(x / 210 + ph) + 30 * Math.sin(x / 90 + ph * 2);
      const nearY = 700 + 50 * Math.sin(x / 260 + ph * 3) + 20 * Math.sin(x / 70 + ph);
      if (y > farY) c = mix(far, near, Math.min(1, (y - farY) / 500) * 0.4);
      if (y > nearY) c = mix(near, far, Math.min(1, (y - nearY) / 400) * 0.25);
      const p = row + 1 + x * 3;
      raw[p] = c[0]; raw[p + 1] = c[1]; raw[p + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- manifest
const readManifest = () => (fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { items: [] });
const saveManifest = (m) => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));

// ---------------------------------------------------------------- login / logout
async function login() {
  const email = process.env.STAGING_EDITOR_EMAIL, password = process.env.STAGING_EDITOR_PASSWORD;
  if (!email || !password) {
    console.log("Set STAGING_EDITOR_EMAIL and STAGING_EDITOR_PASSWORD first.");
    process.exit(1);
  }
  console.log("Waking the API up...");
  for (let i = 0; i < 12; i++) {
    const r = await api("GET", "/api/news?lang=ar", { quiet: true });
    if (r.ok) break;
    await sleep(5000);
  }
  const r = await api("POST", "/api/auth/login", { json: { email, password } });
  if (!r.ok) { console.log("Login failed. Is the staging account enabled and the password right?"); process.exit(1); }
  if (r.data?.requiresTwoFactor) { console.log("This account needs 2FA; use an account without it."); process.exit(1); }
  console.log("Logged in.\n");
}
const logout = () => api("POST", "/api/auth/logout", { quiet: true });

// ---------------------------------------------------------------- create with fallbacks
// Some entry categories are not known for sure, so each item may list
// alternatives; the first one the API accepts is used.
async function createWithFallback(url, body, alternatives = []) {
  const tries = [{}, ...alternatives];
  for (const alt of tries) {
    const attempt = { ...body, ...alt };
    for (const k of Object.keys(attempt)) if (attempt[k] === undefined) delete attempt[k];
    const r = await api("POST", url, { json: attempt, quiet: alt !== tries[tries.length - 1] });
    if (r.status === 201 || r.status === 200) {
      if (Object.keys(alt).length) console.log(`  (used ${JSON.stringify(alt)})`);
      return r.data;
    }
    if (r.status !== 400) return null;
  }
  return null;
}

// ---------------------------------------------------------------- seed
async function seed() {
  if (fs.existsSync(MANIFEST) && !ONLY_MISSING) {
    console.log("seed-manifest.json already exists: run with --missing to add only what failed, or --cleanup first.");
    process.exit(1);
  }
  const existing = readManifest();
  const done = new Set(existing.items.map((i) => `${i.type}|${i.title}`));
  const plan = [
    ...CONTENT.news.map((x) => ({ type: "news", ...x })),
    ...CONTENT.entries.map((x) => ({ type: "entry", ...x })),
    ...CONTENT.events.map((x) => ({ type: "event", ...x })),
    ...CONTENT.notices.map((x) => ({ type: "notice", ...x })),
  ].filter((p) => !done.has(`${p.type}|${p.body.translations[1]?.title}`));
  if (!plan.length) { console.log("Nothing missing: everything is already created."); return; }
  const count = (t) => plan.filter((p) => p.type === t).length;
  console.log(`Plan: ${count("news")} news, ${count("entry")} entries, ${count("event")} events, ${count("notice")} notices = ${plan.length} items`);
  if (MODE === "dry-run") {
    for (const p of plan) console.log(`  ${p.type.padEnd(6)} ${p.body.kind ?? p.body.category ?? ""}  ${p.body.translations[0].title}`);
    return;
  }

  await login();
  const manifest = existing.items.length ? existing : { site: SITE, createdAt: new Date().toISOString(), items: [] };
  saveManifest(manifest);
  const base = { news: "/api/admin/news", entry: "/api/admin/entries", event: "/api/admin/events", notice: "/api/admin/notices" };
  let ok = 0, failed = 0, seedNo = 0;

  for (const p of plan) {
    seedNo++;
    console.log(`${p.type}: ${p.body.translations[1]?.title ?? p.body.translations[0].title}`);
    const created = await createWithFallback(base[p.type], p.body, p.alternatives);
    if (!created?.id) { failed++; console.log("  FAILED to create\n"); continue; }
    manifest.items.push({ type: p.type, id: created.id, title: p.body.translations[1]?.title });
    saveManifest(manifest);

    if (p.cover) {
      const section = p.type === "entry" ? p.body.kind : p.type;
      const up = await upload(`${base[p.type]}/${created.id}/cover`, coverPng(section, seedNo));
      if (!up.ok) console.log("  cover upload failed (item kept without a cover)");
    }
    const pub = await api("POST", `${base[p.type]}/${created.id}/publish`);
    if (pub.ok) { ok++; console.log("  published\n"); } else { failed++; console.log("  created but NOT published\n"); }
  }
  await logout();
  console.log(`Done: ${ok} published, ${failed} failed. Manifest: ${MANIFEST}`);
  console.log(`To remove everything later: node tests/seed/seed-staging.mjs --cleanup`);
}

// ---------------------------------------------------------------- cleanup
async function cleanup() {
  const m = readManifest();
  if (!m.items.length) { console.log("Nothing to clean up."); return; }
  await login();
  const base = { news: "/api/admin/news", entry: "/api/admin/entries", event: "/api/admin/events", notice: "/api/admin/notices" };
  const left = [];
  for (const it of m.items) {
    const url = `${base[it.type]}/${it.id}`;
    let done;
    if (it.type === "news") {
      const r = await api("POST", `${url}/archive`, { quiet: true });          // published news can only be archived
      done = r.ok || r.status === 400 || r.status === 404;                       // 400 = already archived / still a draft
      if (r.status === 400) { const d = await api("DELETE", url, { quiet: true }); done = d.ok || d.status === 400 || d.status === 404; }
    } else {
      await api("POST", `${url}/unpublish`, { quiet: true });
      const d = await api("DELETE", url, { quiet: true });
      done = d.ok || d.status === 404;
    }
    console.log(`${done ? "removed " : "FAILED  "} ${it.type}: ${it.title ?? it.id}`);
    if (!done) left.push(it);
  }
  await logout();
  if (left.length) { m.items = left; saveManifest(m); console.log(`${left.length} item(s) left in the manifest, run --cleanup again.`); }
  else { fs.unlinkSync(MANIFEST); console.log("All sample content removed (news are archived, so hidden from the site)."); }
}

(MODE === "cleanup" ? cleanup() : seed()).catch((e) => { console.error(e.message); process.exit(1); });
