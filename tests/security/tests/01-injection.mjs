// 1. Injection: SQL-looking, wildcard, NUL, very long and Unicode-control
// payloads through every input. Safe = 400/404/empty or normal result, never
// a 5xx, never extra rows, never a pg_sleep-sized delay, tables intact.
import { test } from "../lib/runner.mjs";
import { api, evidence, web } from "../lib/http.mjs";
import { count, exec, lit, rows, tables } from "../lib/db.mjs";
import { createEntry, createNews, extraStaff, KIND_DETAILS } from "../lib/fixtures.mjs";
import { newContext, watch } from "../lib/browser.mjs";

export const PAYLOADS = [
  ["or-true", "' OR 1=1 --"],
  ["or-string", "' OR '1'='1"],
  ["drop", `"; DROP TABLE "News"; --`],
  ["sleep", "1; SELECT pg_sleep(5)--"],
  ["sleep-quoted", "'; SELECT pg_sleep(5)--"],
  ["percent", "%"],
  ["underscore", "_"],
  ["backslash", "\\"],
  ["pct00-text", "%00"],
  ["nul", "\u0000"],
  ["long", "A".repeat(5000)],
  ["rtl-override", "‮txt.exe‬"],
  ["unicode-mix", "﻿​ﷺ𝕏́"],
];
const INJECTION_ONLY = PAYLOADS.filter(([k]) => !["percent", "underscore"].includes(k));
const enc = encodeURIComponent;
const SLOW_MS = 4500; // pg_sleep(5) would take at least 5000 ms

function judge(t, res, label) {
  if (res.status === 0 || res.status >= 500)
    t.fail(`${label}: server error`, evidence(res, "400, 404 or a normal answer; never 5xx"));
  else if (res.ms >= SLOW_MS)
    t.fail(`${label}: answered after ${Math.round(res.ms)} ms (pg_sleep-sized delay)`, evidence(res, `< ${SLOW_MS} ms`));
  return res;
}

async function each(list, fn) {
  for (const item of list) await fn(...item);
}

test(1, "1.1", "Public API query parameters (lang, kind, page, pageSize)", "400/normal, never 5xx or slow", async (t) => {
  const base = await api("GET", "/api/news?lang=ar&pageSize=50");
  await each(PAYLOADS, async (k, p) => {
    for (const path of [
      `/api/news?lang=${enc(p)}`,
      `/api/news?page=${enc(p)}`,
      `/api/news?pageSize=${enc(p)}`,
      `/api/entries?kind=${enc(p)}&lang=ar`,
      `/api/entries?kind=project&lang=${enc(p)}`,
      `/api/council?lang=${enc(p)}`,
      `/api/site-settings?lang=${enc(p)}`,
    ]) {
      const res = judge(t, await api("GET", path), `${k} ${path.split("?")[0]}`);
      if (res.status === 200 && path.startsWith("/api/news?") && res.json?.totalCount > (base.json?.totalCount ?? 0))
        t.fail(`${k}: more news rows than exist`, evidence(res, `total <= ${base.json?.totalCount}`));
    }
  });
});

test(1, "1.2", "Public route values (news slug, entry id, file id)", "404/400, never 5xx", async (t) => {
  await each(PAYLOADS, async (k, p) => {
    for (const path of [`/api/news/${enc(p)}?lang=ar`, `/api/entries/${enc(p)}`, `/api/files/${enc(p)}`]) {
      const res = judge(t, await api("GET", path), `${k} ${path.split("/").slice(0, 3).join("/")}`);
      t.check(res.status !== 200, `${k}: ${path} answered 200`, evidence(res, "404"));
    }
  });
});

test(1, "1.3", "Admin users list: search, role, isActive, page, pageSize", "no extra rows, never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  await each(INJECTION_ONLY, async (k, p) => {
    for (const param of ["search", "role"]) {
      const res = judge(t, await api("GET", `/api/admin/users?${param}=${enc(p)}`, { cookie }), `${k} ${param}`);
      if (res.status === 200 && res.json.totalCount !== 0 && p.trim() !== "")
        t.fail(`${k}: ${param} matched ${res.json.totalCount} users`, evidence(res, "total 0 (no account contains this text)"));
    }
    for (const param of ["isActive", "page", "pageSize"])
      judge(t, await api("GET", `/api/admin/users?${param}=${enc(p)}`, { cookie }), `${k} ${param}`);
  });
});

test(1, "1.4", "Admin audit log filters (userEmail, action, entityType, entityId, from, to, page, pageSize)", "no extra rows, never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  await each(INJECTION_ONLY, async (k, p) => {
    for (const param of ["userEmail", "action", "entityType", "entityId"]) {
      const res = judge(t, await api("GET", `/api/admin/audit?${param}=${enc(p)}`, { cookie }), `${k} ${param}`);
      if (res.status === 200 && res.json.totalCount !== 0 && p.trim() !== "")
        t.fail(`${k}: ${param} matched ${res.json.totalCount} log rows`, evidence(res, "total 0"));
    }
    for (const param of ["from", "to", "page", "pageSize"])
      judge(t, await api("GET", `/api/admin/audit?${param}=${enc(p)}`, { cookie }), `${k} ${param}`);
  });
});

test(1, "1.5", "Admin news/entries/council/users: query and route values", "400/404, never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  await each(PAYLOADS, async (k, p) => {
    for (const [method, path, json] of [
      ["GET", `/api/admin/news?status=${enc(p)}`],
      ["GET", `/api/admin/news?page=${enc(p)}`],
      ["GET", `/api/admin/news?pageSize=${enc(p)}`],
      ["GET", `/api/admin/news/${enc(p)}`],
      ["GET", `/api/admin/entries?kind=${enc(p)}`],
      ["GET", `/api/admin/entries/${enc(p)}`],
      ["PUT", `/api/admin/entries/order?kind=${enc(p)}`, { ids: [] }],
      ["GET", `/api/admin/users/${enc(p)}`],
      ["GET", `/api/admin/council/${enc(p)}`],
      ["DELETE", `/api/admin/entries/${enc(p)}`],
    ]) {
      const res = judge(t, await api(method, path, { cookie, json }), `${k} ${method} ${path.split("?")[0].slice(0, 40)}`);
      if (path.includes("status=") && res.status === 200)
        t.fail(`${k}: an unknown status filter was accepted`, evidence(res, "400"));
    }
  });
});

test(1, "1.6", "News JSON bodies (title, body, language, version)", "stored as plain text or 400; never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const created = [];
  try {
    await each(PAYLOADS, async (k, p) => {
      const res = judge(
        t,
        await api("POST", "/api/admin/news", { cookie, json: { translations: [{ language: "ar", title: p, body: p }] } }),
        `${k} create`,
      );
      if (res.status === 201) {
        created.push(res.json.id);
        const back = await api("GET", `/api/admin/news/${res.json.id}`, { cookie });
        const tr = back.json?.translations?.[0];
        t.check(
          tr?.title === p.trim() || tr?.title === p,
          `${k}: the saved title is not the text that was sent`,
          evidence(back, "the same text, stored as data"),
        );
      }
      judge(t, await api("POST", "/api/admin/news", { cookie, json: { translations: [{ language: p, title: "x", body: "x" }] } }), `${k} language`);
    });
    const draft = await createNews(cookie);
    created.push(draft.id);
    for (const [label, version] of [
      ["string", "1 OR 1=1"],
      ["negative", -1],
      ["huge", 99999999999],
      ["float", 1.5],
      ["object", { $gt: 0 }],
      ["max-uint", 4294967295],
    ]) {
      const res = judge(
        t,
        await api("PUT", `/api/admin/news/${draft.id}`, {
          cookie,
          json: { translations: [{ language: "ar", title: "t", body: "b" }], version },
        }),
        `version ${label}`,
      );
      t.check(res.status !== 200, `version ${label} was accepted`, evidence(res, "400 or 409"));
    }
  } finally {
    for (const id of created) await api("DELETE", `/api/admin/news/${id}`, { cookie });
  }
});

test(1, "1.7", "Entry JSON bodies, all kinds (title, summary, body, kind, category, status, year, version)", "stored as text or 400; never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("editor");
  const created = [];
  try {
    for (const kind of Object.keys(KIND_DETAILS)) {
      await each(PAYLOADS, async (k, p) => {
        const res = judge(
          t,
          await api("POST", "/api/admin/entries", {
            cookie,
            json: { kind, ...KIND_DETAILS[kind], translations: [{ language: "ar", title: p, summary: p, body: p }] },
          }),
          `${kind} ${k} text`,
        );
        if (res.status === 201) created.push(res.json.id);
        for (const field of ["kind", "category", "status"]) {
          const json = { kind, ...KIND_DETAILS[kind], translations: [{ language: "ar", title: "t", summary: "s", body: "b" }] };
          json[field] = p;
          const r = judge(t, await api("POST", "/api/admin/entries", { cookie, json }), `${kind} ${k} ${field}`);
          if (r.status === 201) {
            created.push(r.json.id);
            t.fail(`${kind}: ${field}=${k} was accepted`, evidence(r, "400 (only known values)"));
          }
        }
      });
    }
    const e = await createEntry(cookie, "project");
    created.push(e.id);
    for (const [label, version] of [["string", "1 OR 1=1"], ["negative", -1], ["huge", 99999999999], ["max-uint", 4294967295]]) {
      const res = judge(
        t,
        await api("PUT", `/api/admin/entries/${e.id}`, {
          cookie,
          json: { ...KIND_DETAILS.project, translations: [{ language: "ar", title: "t", summary: "s", body: "b" }], version },
        }),
        `entry version ${label}`,
      );
      t.check(res.status !== 200, `entry version ${label} was accepted`, evidence(res, "400 or 409"));
    }
    for (const year of ["1900 OR 1=1", -5, 1e12, "abc"]) {
      const res = judge(
        t,
        await api("POST", "/api/admin/entries", {
          cookie,
          json: { kind: "history", year, translations: [{ language: "ar", title: "t", summary: "s", body: "b" }] },
        }),
        `year ${year}`,
      );
      if (res.status === 201) {
        created.push(res.json.id);
        t.fail(`year ${year} was accepted`, evidence(res, "400"));
      }
    }
    // Reorder with injected ids
    judge(t, await api("PUT", "/api/admin/entries/order?kind=project", { cookie, json: { ids: ["' OR 1=1 --"] } }), "reorder ids");
  } finally {
    for (const id of created) {
      await api("POST", `/api/admin/entries/${id}/unpublish`, { cookie });
      await api("DELETE", `/api/admin/entries/${id}`, { cookie });
    }
  }
});

test(1, "1.8", "Council, contact details and staff-user JSON bodies", "stored as text or 400; never 5xx", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  const councilIds = [];
  const userIds = [];
  const settingsBefore = (await api("GET", "/api/admin/site-settings", { cookie })).json;
  try {
    await each(PAYLOADS, async (k, p) => {
      for (const field of ["nameAr", "nameEn", "positionAr", "positionEn"]) {
        const json = { nameAr: "اسم", nameEn: "Name", positionAr: "عضو", positionEn: "Member" };
        json[field] = p;
        const r = judge(t, await api("POST", "/api/admin/council", { cookie, json }), `council ${k} ${field}`);
        if (r.status === 201) councilIds.push(r.json.id);
      }
      for (const field of ["phone", "secondaryPhone", "email", "addressAr", "addressEn", "openingHoursAr", "openingHoursEn", "mapUrl", "facebookUrl", "instagramUrl"]) {
        const current = (await api("GET", "/api/admin/site-settings", { cookie })).json;
        const r = judge(
          t,
          await api("PUT", "/api/admin/site-settings", { cookie, json: { ...current, [field]: p, version: current.version } }),
          `settings ${k} ${field}`,
        );
        if (r.status === 200 && ["phone", "secondaryPhone", "email", "mapUrl", "facebookUrl", "instagramUrl"].includes(field) && p.trim() !== "")
          t.fail(`settings ${field}=${k} was accepted`, evidence(r, "400 (validated field)"));
      }
      const created = judge(
        t,
        await api("POST", "/api/admin/users", { cookie, json: { email: p, displayName: "Injected", role: "Editor" } }),
        `user email ${k}`,
      );
      if (created.status === 201) {
        userIds.push(created.json.user.id);
        t.fail(`user email ${k} was accepted`, evidence(created, "400 (not an email address)"));
      }
      for (const field of ["displayName", "role"]) {
        const json = { email: `sectest-inj-${k}-${field}-${Date.now()}@example.test`, displayName: "Injected", role: "Editor" };
        json[field] = p;
        const r = judge(t, await api("POST", "/api/admin/users", { cookie, json }), `user ${field} ${k}`);
        if (r.status === 201) {
          userIds.push(r.json.user.id);
          if (field === "role") t.fail(`role ${k} was accepted`, evidence(r, "400"));
        }
      }
    });
    const victim = await extraStaff(cookie, "Editor", "inj");
    userIds.push(victim.id);
    await each(PAYLOADS, async (k, p) => {
      judge(t, await api("PUT", `/api/admin/users/${victim.id}`, { cookie, json: { displayName: p, role: "Editor" } }), `user update ${k}`);
    });
  } finally {
    for (const id of councilIds) await api("DELETE", `/api/admin/council/${id}`, { cookie });
    if (userIds.length)
      exec(`delete from "AspNetUserRoles" where "UserId" in (${userIds.map(lit).join(",")});
            delete from "AspNetUsers" where "Id" in (${userIds.map(lit).join(",")});`);
    const now = (await api("GET", "/api/admin/site-settings", { cookie })).json;
    await api("PUT", "/api/admin/site-settings", { cookie, json: { ...settingsBefore, version: now.version } });
  }
});

test(1, "1.9", "Login and change-password fields", "401/400, never 5xx, never a login", async (t, s) => {
  const editor = s.sessions.users.editor;
  // Wrong passwords lock an account after 5 tries: use a throwaway one for those.
  const target = await extraStaff(s.sessions.cookie("admin1"), "Editor", "inj-login");
  await each(PAYLOADS, async (k, p) => {
    for (const json of [
      { email: p, password: p },
      { email: target.email, password: p },
      { email: `${editor.email}${p}`, password: editor.password },
      { email: p, password: editor.password },
    ]) {
      const res = judge(t, await api("POST", "/api/auth/login", { json, retry429: false }), `login ${k}`);
      t.check(res.status !== 200, `login with ${k} succeeded`, evidence(res, "401"));
    }
  });
  await each(PAYLOADS, async (k, p) => {
    const res = judge(
      t,
      await api("POST", "/api/auth/change-password", {
        cookie: editor.cookie,
        json: { currentPassword: p, newPassword: `${p}Aa1!xyzxyzxyz` },
      }),
      `change-password ${k}`,
    );
    t.check(res.status !== 204, `change-password with a wrong current password (${k}) succeeded`, evidence(res, "400"));
  });
  // Raw, malformed and mistyped JSON bodies
  for (const body of ['{"email":', "null", "[]", '{"email":{"$ne":null},"password":{"$ne":null}}', '{"email":1,"password":true}']) {
    const res = judge(t, await api("POST", "/api/auth/login", { json: body, retry429: false }), `login body ${body}`);
    t.check(res.status !== 200, `login body ${body} succeeded`, evidence(res, "400/401"));
  }
});

test(1, "1.10", "Database intact after the injection tests", "every table still there, nothing dropped", async (t, s) => {
  const now = tables();
  for (const name of s.tablesAtStart)
    t.check(now.includes(name), `table ${name} is missing`, `tables now: ${now.join(", ")}`);
  t.check(count(`select count(*) from "AspNetRoles"`) >= 2, "roles were removed", "AspNetRoles count");
  const admins = rows(`select count(*) from "AspNetUsers" where "Email" like 'sectest-admin%'`)[0][0];
  t.check(Number(admins) === 2, "the test admins are not both present", `count ${admins}`);
});

test(1, "1.11", "LIKE wildcards % and _ in the users search and audit e-mail filter", "reported (not injection)", async (t, s) => {
  const cookie = s.sessions.cookie("admin1");
  const all = (await api("GET", "/api/admin/users?pageSize=100", { cookie })).json.totalCount;
  const out = [];
  for (const [label, q] of [["%", "%"], ["_", "_"], ["s_ctest", "s_ctest"]]) {
    const r = await api("GET", `/api/admin/users?search=${enc(q)}`, { cookie });
    out.push(`users search "${label}" → ${r.json?.totalCount} of ${all}`);
  }
  const auditAll = (await api("GET", "/api/admin/audit?pageSize=1", { cookie })).json.totalCount;
  const withEmail = (await api("GET", "/api/admin/audit?pageSize=1&userEmail=%40", { cookie })).json.totalCount;
  const pct = (await api("GET", `/api/admin/audit?pageSize=1&userEmail=${enc("%")}`, { cookie })).json.totalCount;
  const us = (await api("GET", `/api/admin/audit?pageSize=1&userEmail=${enc("_")}`, { cookie })).json.totalCount;
  out.push(`audit userEmail "%" → ${pct}, "_" → ${us} (rows with an e-mail containing "@": ${withEmail}, all rows: ${auditAll})`);
  const wildcard = out.some((l) => /"%" → (\d+) of (\d+)/.test(l) && RegExp.$1 === RegExp.$2 && Number(RegExp.$1) > 0);
  t.observe(`${wildcard ? "% and _ act as wildcards" : "% and _ are matched literally"}: ${out.join("; ")}`);
});

test(1, "1.12", "Website URLs with payloads (pages, slugs, ids, locale, returnTo, kind)", "4xx or a normal page, never 5xx", async (t) => {
  await each(PAYLOADS, async (k, p) => {
    for (const path of [
      `/ar/news?page=${enc(p)}`,
      `/ar/news/${enc(p)}`,
      `/ar/entries/${enc(p)}`,
      `/${enc(p)}/discover`,
      `/ar/discover?q=${enc(p)}`,
      `/ar/admin/login?returnTo=${enc(p)}`,
      `/ar/admin/content?kind=${enc(p)}`,
      `/api/news?lang=${enc(p)}`,
    ]) {
      const res = await web("GET", path);
      if (res.status === 0 || res.status >= 500)
        t.fail(`${k}: ${path.slice(0, 60)} → ${res.status}`, evidence(res, "a page or 4xx"));
    }
  });
});

test(1, "1.13", "Admin search boxes in the browser (users, audit) with payloads", "no extra rows, no 5xx", async (t, s) => {
  const context = await newContext(s.sessions.cookie("admin1"));
  const page = await context.newPage();
  const seen = watch(page);
  const bad = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500) bad.push(`${r.status()} ${r.url()}`);
  });
  try {
    for (const [path, api] of [["/ar/admin/users", "/api/admin/users"], ["/ar/admin/audit", "/api/admin/audit"]]) {
      await page.goto(s.web + path, { waitUntil: "networkidle" });
      const box = page.locator('input[type="search"]').first();
      if ((await box.count()) === 0) {
        t.fail(`${path}: no search box found`, "selector input[type=search]");
        continue;
      }
      for (const [k, p] of INJECTION_ONLY.filter(([k]) => !["long", "nul"].includes(k))) {
        const wait = page.waitForResponse((r) => r.url().includes(api) && r.request().method() === "GET", { timeout: 10000 }).catch(() => null);
        await box.fill(p);
        await box.press("Enter");
        const r = await wait;
        if (!r) continue;
        const json = await r.json().catch(() => null);
        if (r.status() >= 500) bad.push(`${r.status()} ${r.url()}`);
        if (json && json.totalCount > 0) t.fail(`${path} search ${k} returned ${json.totalCount} rows`, `GET ${r.url()} → ${r.status()}`);
      }
    }
  } finally {
    await context.close();
  }
  for (const b of bad) t.fail("server error from a search box", b);
  t.check(seen.dialogs.length === 0, "a dialog opened", seen.dialogs.join("; "));
});
