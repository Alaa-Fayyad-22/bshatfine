// Accounts, sample data and image files shared by the tests.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { config, repoRoot } from "./config.mjs";
import { api, evidence, sessionCookie } from "./http.mjs";

// ---------- Accounts ----------
export async function login(email, password, opts = {}) {
  const res = await api("POST", "/api/auth/login", { json: { email, password }, retry429: false, ...opts });
  return { res, cookie: res.status === 200 ? sessionCookie(res) : null };
}

async function me(cookie) {
  return api("GET", "/api/auth/me", { cookie });
}

// Logs in an account whose password may still be the temporary one, and
// completes the forced change if needed. Returns a working session cookie.
async function activate(email, temporaryPassword, finalPassword) {
  const first = await login(email, temporaryPassword);
  if (!first.cookie) throw new Error(`Login of ${email} failed: ${first.res.status} ${first.res.text}`);
  const changed = await api("POST", "/api/auth/change-password", {
    cookie: first.cookie,
    json: { currentPassword: temporaryPassword, newPassword: finalPassword },
  });
  if (changed.status !== 204) throw new Error(`Password change of ${email} failed: ${changed.status} ${changed.text}`);
  return sessionCookie(changed) ?? (await login(email, finalPassword)).cookie;
}

export async function findStaff(adminCookie, email) {
  const res = await api("GET", `/api/admin/users?search=${encodeURIComponent(email)}&pageSize=100`, {
    cookie: adminCookie,
  });
  return res.json?.items?.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

// Creates (or resets) a staff account through the API and returns
// { id, email, cookie } with the account's final password set.
export async function ensureStaff(adminCookie, { email, password, role, displayName }) {
  let user = await findStaff(adminCookie, email);
  let temporary;
  if (!user) {
    const res = await api("POST", "/api/admin/users", {
      cookie: adminCookie,
      json: { email, displayName: displayName ?? email.split("@")[0], role },
    });
    if (res.status !== 201) throw new Error(`Could not create ${email}: ${res.status} ${res.text}`);
    user = res.json.user;
    temporary = res.json.temporaryPassword;
  } else {
    if (!user.isActive) await api("POST", `/api/admin/users/${user.id}/enable`, { cookie: adminCookie });
    if (user.role !== role)
      await api("PUT", `/api/admin/users/${user.id}`, {
        cookie: adminCookie,
        json: { displayName: user.displayName, role },
      });
    await api("POST", `/api/admin/users/${user.id}/unlock`, { cookie: adminCookie });
    const reset = await api("POST", `/api/admin/users/${user.id}/reset-password`, { cookie: adminCookie });
    if (reset.status !== 200) throw new Error(`Could not reset ${email}: ${reset.status} ${reset.text}`);
    temporary = reset.json.temporaryPassword;
  }
  const cookie = await activate(email, temporary, password);
  return { id: user.id, email, cookie };
}

// A throwaway account for one test. Returns { id, email, cookie, password }.
let extraCounter = 0;
export async function extraStaff(adminCookie, role = "Editor", label = "extra") {
  const email = `sectest-${label}-${Date.now().toString(36)}-${++extraCounter}@example.test`;
  const s = await ensureStaff(adminCookie, { email, password: config.extraPassword, role });
  return { ...s, password: config.extraPassword };
}

export class Sessions {
  constructor() {
    this.users = {};
  }
  async init() {
    const a1 = config.accounts.admin1;
    const first = await login(a1.email, a1.password);
    if (!first.cookie)
      throw new Error(
        `The seeded admin ${a1.email} cannot log in to ${config.apiUrl} (${first.res.status}). ` +
          "Is the test environment up (npm run env:up)?",
      );
    const meRes = await me(first.cookie);
    this.users.admin1 = { id: meRes.json.id, email: a1.email, cookie: first.cookie, password: a1.password };
    for (const name of ["admin2", "editor"]) {
      const acc = config.accounts[name];
      const s = await ensureStaff(this.users.admin1.cookie, acc);
      this.users[name] = { ...s, password: acc.password };
    }
    return this;
  }
  cookie(name) {
    return this.users[name].cookie;
  }
  id(name) {
    return this.users[name].id;
  }
  // Logs in again (sessions end when a test disables, demotes or resets an account).
  async refresh(name) {
    const u = this.users[name];
    const r = await login(u.email, u.password);
    if (!r.cookie) throw new Error(`Re-login of ${name} failed: ${r.res.status} ${r.res.text}`);
    u.cookie = r.cookie;
    return r.cookie;
  }
  async refreshAll() {
    for (const name of Object.keys(this.users)) {
      const check = await me(this.users[name].cookie);
      if (check.status !== 200) await this.refresh(name);
    }
  }
}

// ---------- Content ----------
export const KIND_DETAILS = {
  history: { category: null, status: null, year: 1900 },
  project: { category: "roads", status: "ongoing", year: 2026 },
  place: { category: "heritage", status: null, year: null },
  service: { category: "certificate", status: null, year: null },
};

export async function createNews(cookie, { ar, en } = {}) {
  const translations = [{ language: "ar", title: ar?.title ?? "خبر اختبار", body: ar?.body ?? "نص اختبار" }];
  if (en) translations.push({ language: "en", title: en.title, body: en.body });
  const res = await api("POST", "/api/admin/news", { cookie, json: { translations } });
  if (res.status !== 201) throw Object.assign(new Error(`createNews: ${res.status} ${res.text}`), { res });
  return res.json;
}

export async function createEntry(cookie, kind, { ar, en, ...details } = {}) {
  const d = { ...KIND_DETAILS[kind], ...details };
  const translations = [
    {
      language: "ar",
      title: ar?.title ?? "مدخل اختبار",
      summary: ar?.summary ?? "ملخص اختبار",
      body: ar?.body ?? "نص اختبار",
    },
  ];
  if (en) translations.push({ language: "en", title: en.title, summary: en.summary, body: en.body });
  const res = await api("POST", "/api/admin/entries", { cookie, json: { kind, translations, ...d } });
  if (res.status !== 201) throw Object.assign(new Error(`createEntry: ${res.status} ${res.text}`), { res });
  return res.json;
}

export async function createCouncil(cookie, fields = {}) {
  const res = await api("POST", "/api/admin/council", {
    cookie,
    json: { nameAr: "عضو اختبار", nameEn: "Test member", positionAr: "عضو", positionEn: "Member", ...fields },
  });
  if (res.status !== 201) throw Object.assign(new Error(`createCouncil: ${res.status} ${res.text}`), { res });
  return res.json;
}

export function expectStatus(t, res, allowed, what) {
  const ok = allowed.includes(res.status);
  t.check(ok, `${what}: got ${res.status}`, evidence(res, `status ${allowed.join(" or ")}`));
  return ok;
}

// ---------- Images ----------
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(width, height) {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(width, 0);
  h.writeUInt32BE(height, 4);
  h[8] = 8; // bit depth
  h[9] = 0; // greyscale
  return chunk("IHDR", h);
}

// A valid greyscale PNG (every row a gradient, so it is a real picture).
export function png(width = 64, height = 48) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = (x * 4 + y * 2) & 255;
  return Buffer.concat([PNG_SIGNATURE, ihdr(width, height), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// A tiny file that claims huge dimensions (the pixel data is only a few rows).
export function pngHeaderBomb(width = 30000, height = 30000) {
  const raw = Buffer.alloc((width + 1) * 4);
  return Buffer.concat([PNG_SIGNATURE, ihdr(width, height), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// A real, fully decodable image just under the API's 40-megapixel limit,
// compressed to a few tens of KB (all zeros): a "decompression bomb".
export function pngZeroBomb(width = 6300, height = 6300) {
  const raw = Buffer.alloc((width + 1) * height);
  return Buffer.concat([
    PNG_SIGNATURE,
    ihdr(width, height),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function jpeg() {
  return fs.readFileSync(path.join(repoRoot, "frontend", "public", "images", "council.jpg"));
}

export function imageForm(bytes, { field = "file", filename = "photo.jpg", type = "image/jpeg" } = {}) {
  const fd = new FormData();
  fd.append(field, new Blob([bytes], { type }), filename);
  return fd;
}
