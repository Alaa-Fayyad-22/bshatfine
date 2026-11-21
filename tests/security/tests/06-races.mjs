// 6. Race conditions: the same request 10–20 times IN PARALLEL, then the
// database is checked.
import { test } from "../lib/runner.mjs";
import { api, evidence, web } from "../lib/http.mjs";
import { activeAdmins, auditCount, count, exec, lit, orphanFiles, purgeCouncil, purgeEntry, purgeNews, rows, storedFileCount, storedFileExists } from "../lib/db.mjs";
import { createCouncil, createEntry, createNews, extraStaff, imageForm, login, png } from "../lib/fixtures.mjs";

const N = 15;
const tally = (list) => list.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
const fmt = (m) => Object.entries(m).map(([k, v]) => `${k}×${v}`).join(", ");

test(6, "6.a", "Parallel saves with the same version (news and entry)", "exactly one 200, the rest 409; saved text is the winner's", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const news = await createNews(cookie);
  const entry = await createEntry(cookie, "history");
  try {
    for (const [label, id, path, make] of [
      ["news", news.id, `/api/admin/news/${news.id}`, (i) => ({ translations: [{ language: "ar", title: `race-${i}`, body: `body-${i}` }], version: news.version })],
      ["entry", entry.id, `/api/admin/entries/${entry.id}`, (i) => ({ year: 1900, translations: [{ language: "ar", title: `race-${i}`, summary: "s", body: `body-${i}` }], version: entry.version })],
    ]) {
      const res = await Promise.all(Array.from({ length: N }, (_, i) => api("PUT", path, { cookie, json: make(i) })));
      const c = tally(res);
      t.note(`${label}: ${fmt(c)}`);
      t.check(c[200] === 1 && (c[409] ?? 0) === N - 1, `${label}: ${fmt(c)}`, `${N}× PUT ${path} with version ${label === "news" ? news.version : entry.version} → expected 200×1, 409×${N - 1}`);
      const winners = res.map((r, i) => (r.status === 200 ? i : -1)).filter((i) => i >= 0);
      const now = (await api("GET", `/api/admin/${label === "news" ? "news" : "entries"}/${id}`, { cookie })).json;
      const title = now.translations.find((x) => x.language === "ar").title;
      t.check(winners.some((i) => title === `race-${i}`), `${label}: saved title "${title}" is not the accepted request's`, `winners: ${winners.join(",")}`);
    }
  } finally {
    purgeNews(news.id);
    purgeEntry(entry.id);
  }
});

test(6, "6.b", "Parallel publish of the same draft (news and entry)", "one 200, the rest 400 (or 409); published once", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const news = await createNews(cookie);
  const entry = await createEntry(cookie, "service");
  try {
    for (const [label, id, path, action] of [
      ["news", news.id, `/api/admin/news/${news.id}/publish`, "news.published"],
      ["entry", entry.id, `/api/admin/entries/${entry.id}/publish`, "entry.published"],
    ]) {
      const res = await Promise.all(Array.from({ length: N }, () => api("POST", path, { cookie })));
      const c = tally(res);
      t.note(`${label}: ${fmt(c)}`);
      const rest = (c[400] ?? 0) + (c[409] ?? 0);
      t.check(c[200] === 1 && rest === N - 1, `${label}: ${fmt(c)}`, `${N}× POST ${path} → expected 200×1 and 400/409 for the rest`);
      const audits = auditCount(action, id);
      t.check(audits === 1, `${label}: published ${audits} times according to the audit log`, `AuditLogs ${action} for ${id}`);
      const okRes = res.find((r) => r.status === 200);
      const now = (await api("GET", `/api/admin/${label === "news" ? "news" : "entries"}/${id}`, { cookie })).json;
      t.check(okRes && now.publishedAt === okRes.json.publishedAt, `${label}: publishedAt changed after the accepted publish`, `${okRes?.json?.publishedAt} vs ${now.publishedAt}`);
    }
  } finally {
    purgeNews(news.id);
    purgeEntry(entry.id);
  }
});

test(6, "6.c", "Parallel creation of the same staff e-mail", "one 201, the rest 400; never 5xx; one user", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  const email = `sectest-dup-${Date.now()}@example.test`;
  const res = await Promise.all(Array.from({ length: N }, () => api("POST", "/api/admin/users", { cookie, json: { email, displayName: "Dup", role: "Editor" } })));
  const c = tally(res);
  t.note(fmt(c));
  t.check(c[201] === 1 && (c[400] ?? 0) === N - 1, `same e-mail ×${N}: ${fmt(c)}`, `POST /api/admin/users {"email":"${email}"} → expected 201×1, 400×${N - 1}`);
  const five = res.find((r) => r.status >= 500);
  if (five) t.fail("a duplicate creation answered with a server error", evidence(five, "400 An account with this email already exists."));
  const n = count(`select count(*) from "AspNetUsers" where "NormalizedEmail"=${lit(email.toUpperCase())}`);
  t.check(n === 1, `${n} users exist with that e-mail`, "1");
  exec(`delete from "AspNetUserRoles" where "UserId" in (select "Id" from "AspNetUsers" where "NormalizedEmail"=${lit(email.toUpperCase())});
        delete from "AspNetUsers" where "NormalizedEmail"=${lit(email.toUpperCase())};`);
});

test(6, "6.d", "Parallel wrong-password logins on one account", "at most 5 failures counted before lockout; account ends locked", async (t, s) => {
  const u = await extraStaff(s.sessions.cookie("admin1"), "Editor", "lockout");
  // Each request from its own address: the per-IP limiter must not be what stops them.
  const res = await Promise.all(Array.from({ length: 20 }, () => api("POST", "/api/auth/login", { json: { email: u.email, password: "Wrong-Password-123" }, retry429: false })));
  const c = tally(res);
  t.note(`20 parallel wrong logins: ${fmt(c)}`);
  const invalid = res.filter((r) => r.status === 401).length;
  t.check(invalid <= 5, `${invalid} attempts were answered "invalid password" (more than the 5 allowed before lockout)`, `20× POST /api/auth/login (wrong password) → ${fmt(c)}`);
  const [lockoutEnd, failed] = rows(`select coalesce("LockoutEnd"::text,''), "AccessFailedCount" from "AspNetUsers" where "Id"=${lit(u.id)}`)[0];
  t.note(`after: LockoutEnd=${lockoutEnd || "none"}, AccessFailedCount=${failed}`);
  t.check(lockoutEnd && new Date(lockoutEnd) > new Date(), "the account is not locked", `LockoutEnd=${lockoutEnd}`);
  const good = await login(u.email, u.password);
  t.check(good.res.status !== 200, "the correct password still works after 20 failures", evidence(good.res, "429 (locked)"));
  exec(`update "AspNetUsers" set "IsActive"=false where "Id"=${lit(u.id)}`);
});

async function restoreAdmins(s) {
  const ids = [s.sessions.id("admin1"), s.sessions.id("admin2")].map(lit).join(",");
  exec(`update "AspNetUsers" set "IsActive"=true, "LockoutEnd"=null, "AccessFailedCount"=0 where "Id" in (${ids});
        delete from "AspNetUserRoles" where "UserId" in (${ids});
        insert into "AspNetUserRoles" ("UserId","RoleId") select u."Id", r."Id" from "AspNetUsers" u, "AspNetRoles" r where u."Id" in (${ids}) and r."Name"='Admin';
        update "AspNetUsers" set "SecurityStamp"=gen_random_uuid()::text where "Id" in (${ids});`);
  await s.sessions.refresh("admin1");
  await s.sessions.refresh("admin2");
}

test(6, "6.e", "Two Admins (the only two) disabling / demoting EACH OTHER at the same moment", "at least one active Admin always remains", async (t, s) => {
  const others = activeAdmins().filter((e) => ![s.sessions.users.admin1.email, s.sessions.users.admin2.email].includes(e));
  if (others.length) t.skip(`other active Admins exist (${others.join(", ")}): the scenario needs exactly two`);
  const a1 = () => s.sessions.users.admin1;
  const a2 = () => s.sessions.users.admin2;
  const disable = (actor, target) => api("POST", `/api/admin/users/${target.id}/disable`, { cookie: actor.cookie });
  const demote = (actor, target) => api("PUT", `/api/admin/users/${target.id}`, { cookie: actor.cookie, json: { displayName: target.email.split("@")[0], role: "Editor" } });
  let broken = 0;
  let runs = 0;
  try {
    for (const [label, x, y] of [["disable vs disable", disable, disable], ["demote vs demote", demote, demote], ["disable vs demote", disable, demote]]) {
      for (let i = 0; i < s.raceRepeats; i++) {
        await restoreAdmins(s);
        const [r1, r2] = await Promise.all([x(a1(), a2()), y(a2(), a1())]);
        runs++;
        const left = activeAdmins();
        if (left.length === 0) {
          broken++;
          t.fail(`${label} (run ${i + 1}): no active Admin left`, {
            request: `in parallel: admin1 → ${x === disable ? "disable" : "demote"} admin2, admin2 → ${y === disable ? "disable" : "demote"} admin1`,
            response: `${r1.status} ${r1.text.slice(0, 150)} | ${r2.status} ${r2.text.slice(0, 150)}`,
            expected: "one 200 and one 400 (last active Admin); at least one active Admin",
          });
        }
      }
    }
    t.note(`${broken} of ${runs} runs left the site without any active Admin.`);
  } finally {
    await restoreAdmins(s);
  }
});

async function reorderRace(t, cookie, label, path, ids, read) {
  const perms = Array.from({ length: 10 }, () => [...ids].sort(() => Math.random() - 0.5));
  const res = await Promise.all(perms.map((p) => api("PUT", path, { cookie, json: { ids: p } })));
  const c = tally(res);
  t.note(`${label}: ${fmt(c)}`);
  t.check(!res.some((r) => r.status >= 500 || r.status === 0), `${label}: server error`, fmt(c));
  const order = read(); // [[id, displayOrder]]
  const positions = order.map((r) => Number(r[1])).sort((a, b) => a - b);
  t.check(positions.every((p, i) => p === i), `${label}: positions are not 0..n-1 each used once`, JSON.stringify(order));
  const final = order.sort((a, b) => a[1] - b[1]).map((r) => r[0]).join(",");
  const accepted = perms.filter((_, i) => res[i].status === 200).map((p) => p.join(","));
  t.check(accepted.includes(final), `${label}: the final order is a mix, not one of the accepted orders`, `final ${final}`);
}

test(6, "6.f", "Parallel reorder of the same kind (entries) and of the council", "final order consistent: each position once, one sent order", async (t, s) => {
  const editor = s.sessions.cookie("editor");
  const admin = s.sessions.cookie("admin1");
  const entries = [];
  const members = [];
  try {
    const existing = (await api("GET", "/api/admin/entries?kind=place", { cookie: editor })).json.map((e) => e.id);
    for (let i = 0; i < 5; i++) entries.push((await createEntry(editor, "place")).id);
    const ids = [...existing, ...entries];
    await reorderRace(t, editor, "entries", "/api/admin/entries/order?kind=place", ids, () =>
      rows(`select "Id", "DisplayOrder" from "Entries" where "Kind"=(select "Kind" from "Entries" where "Id"=${lit(entries[0])})`),
    );
    const existingC = (await api("GET", "/api/admin/council", { cookie: admin })).json.map((m) => m.id);
    for (let i = 0; i < 5; i++) members.push((await createCouncil(admin)).id);
    await reorderRace(t, admin, "council", "/api/admin/council/order", [...existingC, ...members], () => rows(`select "Id", "DisplayOrder" from "CouncilMembers"`));
  } finally {
    for (const id of entries) purgeEntry(id);
    for (const id of members) purgeCouncil(id);
  }
});

test(6, "6.g", "Parallel cover uploads to the same article / entry / council member", "one cover set, no orphan files", async (t, s) => {
  const editor = s.sessions.cookie("editor");
  const admin = s.sessions.cookie("admin2");
  const news = await createNews(editor);
  const entry = await createEntry(editor, "place");
  const member = await createCouncil(admin);
  const orphansBefore = orphanFiles().length;
  try {
    for (const [label, cookie, path, read] of [
      ["news", editor, `/api/admin/news/${news.id}/cover`, () => rows(`select "CoverImagePath" from "News" where "Id"=${lit(news.id)}`)],
      ["entry", editor, `/api/admin/entries/${entry.id}/cover`, () => rows(`select "CoverImagePath" from "Entries" where "Id"=${lit(entry.id)}`)],
      ["council", admin, `/api/admin/council/${member.id}/photo`, () => rows(`select "PhotoPath" from "CouncilMembers" where "Id"=${lit(member.id)}`)],
    ]) {
      const before = storedFileCount();
      const res = await Promise.all(Array.from({ length: 10 }, (_, i) => api("POST", path, { cookie, form: imageForm(png(20 + i, 20), { type: "image/png", filename: "c.png" }) })));
      const c = tally(res);
      t.note(`${label}: ${fmt(c)}`);
      t.check(!res.some((r) => r.status >= 500 || r.status === 0), `${label}: server error`, fmt(c));
      const cover = read()[0][0];
      t.check(cover && storedFileExists(cover), `${label}: the cover points to a missing file`, cover);
      const after = storedFileCount();
      t.check(after === before + 1, `${label}: ${after - before} files stored for one cover`, `StoredFiles ${before} → ${after} (expected +1)`);
    }
    const orphans = orphanFiles();
    t.check(orphans.length === orphansBefore, `${orphans.length - orphansBefore} orphan file(s) left by parallel uploads`, JSON.stringify(orphans.slice(0, 10)));
  } finally {
    purgeNews(news.id);
    purgeEntry(entry.id);
    purgeCouncil(member.id);
    exec(`delete from "StoredFiles" f where not exists (select 1 from "News" n where n."CoverImagePath"=f."Id"::text)
          and not exists (select 1 from "Entries" e where e."CoverImagePath"=f."Id"::text)
          and not exists (select 1 from "CouncilMembers" c where c."PhotoPath"=f."Id"::text)`);
  }
});

test(6, "6.h", "Parallel delete of the same draft with a cover (news and entry)", "one 204, the rest 404 (or 409); the cover file is gone", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  for (const [label, create, base] of [
    ["news", () => createNews(cookie), "/api/admin/news"],
    ["entry", () => createEntry(cookie, "place"), "/api/admin/entries"],
  ]) {
    const item = await create();
    const up = await api("POST", `${base}/${item.id}/cover`, { cookie, form: imageForm(png(), { type: "image/png", filename: "c.png" }) });
    const fileId = up.json?.coverImageUrl?.split("/").pop();
    const res = await Promise.all(Array.from({ length: N }, () => api("DELETE", `${base}/${item.id}`, { cookie })));
    const c = tally(res);
    t.note(`${label}: ${fmt(c)}`);
    t.check(c[204] === 1 && (c[404] ?? 0) + (c[409] ?? 0) === N - 1, `${label}: ${fmt(c)}`, `${N}× DELETE ${base}/{id} → expected 204×1, 404 for the rest`);
    if (fileId) t.check(!storedFileExists(fileId), `${label}: the cover file is still stored`, fileId);
  }
});

test(6, "6.i", "Rate limiting under parallel load: 30 logins from one address", "at most 10 pass the limiter (direct and through the site)", async (t, s) => {
  const email = `sectest-nobody-${Date.now()}@example.test`;
  const ip = `10.250.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const direct = await Promise.all(Array.from({ length: 30 }, () => api("POST", "/api/auth/login", { json: { email, password: "x" }, xff: ip, retry429: false })));
  const passed = direct.filter((r) => r.status !== 429).length;
  t.note(`API, one address: ${fmt(tally(direct))}`);
  t.check(passed <= 10, `${passed} of 30 parallel logins from one address passed the limiter`, "≤ 10 per minute");

  // Through the website's /api proxy, with no forwarding header: one client.
  await new Promise((r) => setTimeout(r, 61000)); // let the proxy's own bucket reset
  const viaSite = await Promise.all(Array.from({ length: 30 }, () => web("POST", "/api/auth/login", { json: { email, password: "x" }, retry429: false })));
  const passedSite = viaSite.filter((r) => r.status !== 429).length;
  t.note(`site proxy, one client: ${fmt(tally(viaSite))}`);
  t.check(passedSite <= 10, `${passedSite} of 30 logins through the site passed the limiter`, "≤ 10 per minute");

  // Same client, but each request claims another address in X-Forwarded-For.
  const spoofed = await Promise.all(Array.from({ length: 30 }, (_, i) => web("POST", "/api/auth/login", { json: { email, password: "x" }, xff: `203.0.113.${i + 1}`, retry429: false })));
  const passedSpoof = spoofed.filter((r) => r.status !== 429).length;
  t.note(`site proxy, spoofed X-Forwarded-For: ${fmt(tally(spoofed))}`);
  t.check(passedSpoof <= 10, `${passedSpoof} of 30 logins passed by sending a different X-Forwarded-For each time (limiter bypass)`, {
    request: "30× POST http://localhost:3001/api/auth/login with X-Forwarded-For: 203.0.113.1 … .30",
    response: fmt(tally(spoofed)),
    expected: "≤ 10 accepted: the client cannot choose its own address",
  });
});
