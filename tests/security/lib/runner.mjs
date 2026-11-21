// A small test runner: each test records failures (with the request, the
// response and what was expected) and keeps going, so one run shows every
// weakness. Results: PASS, FAIL, INFO (an observation to report, no verdict)
// or NOT TESTED (with the reason).
import fs from "node:fs";
import path from "node:path";
import { suiteDir } from "./config.mjs";

export const GROUPS = {
  1: "Injection",
  2: "Stored XSS",
  3: "Access control",
  4: "CSRF and origins",
  5: "Uploads",
  6: "Race conditions",
  7: "Headers and session",
};

const registry = [];

export function test(group, id, title, expected, fn) {
  registry.push({ group, id, title, expected, fn });
}

class Skip extends Error {}

export class TestContext {
  constructor(def) {
    this.def = def;
    this.failures = [];
    this.notes = [];
    this.info = false;
  }
  // Record a failure and continue. `ev` is { request, response, expected } or text.
  fail(message, ev) {
    this.failures.push({ message, evidence: ev });
  }
  check(ok, message, ev) {
    if (!ok) this.fail(message, ev);
    return ok;
  }
  note(text) {
    this.notes.push(text);
  }
  // Marks the result as an observation (INFO) instead of PASS.
  observe(text) {
    this.info = true;
    this.notes.push(text);
  }
  skip(reason) {
    throw new Skip(reason);
  }
}

export async function runAll(shared, { groups } = {}) {
  const results = [];
  const selected = registry.filter((t) => !groups || groups.includes(t.group));
  for (const def of selected) {
    const t = new TestContext(def);
    const started = Date.now();
    let status;
    let error;
    process.stdout.write(`  [${def.id}] ${def.title} … `);
    try {
      await def.fn(t, shared);
      status = t.failures.length ? "FAIL" : t.info ? "INFO" : "PASS";
    } catch (e) {
      if (e instanceof Skip) {
        status = "NOT TESTED";
        t.notes.push(e.message);
      } else {
        status = "FAIL";
        error = e?.stack ?? String(e);
        t.failures.push({ message: `The test itself crashed: ${e?.message ?? e}`, evidence: short(error) });
      }
    }
    const seconds = (Date.now() - started) / 1000;
    console.log(`${status} (${seconds.toFixed(1)}s)`);
    results.push({ ...def, fn: undefined, status, seconds, failures: t.failures, notes: t.notes });
  }
  return results;
}

function short(s, n = 1500) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? `${s.slice(0, n - 1)}…` : s + " ".repeat(n - s.length);
}

export function printTable(results) {
  const line = `${"-".repeat(6)}+${"-".repeat(72)}+${"-".repeat(12)}`;
  for (const [g, name] of Object.entries(GROUPS)) {
    const rows = results.filter((r) => r.group === Number(g));
    if (!rows.length) continue;
    console.log(`\n${g}. ${name}`);
    console.log(line);
    for (const r of rows) console.log(`${pad(r.id, 6)}| ${pad(r.title, 70)} | ${r.status}`);
    console.log(line);
  }
  const by = (s) => results.filter((r) => r.status === s).length;
  console.log(
    `\nTotal: ${results.length}  PASS ${by("PASS")}  FAIL ${by("FAIL")}  INFO ${by("INFO")}  NOT TESTED ${by("NOT TESTED")}`,
  );
}

function evidenceText(ev) {
  if (!ev) return "";
  if (typeof ev === "string") return "```\n" + ev + "\n```\n";
  const parts = [];
  if (ev.request) parts.push(`Request:  ${ev.request}`);
  if (ev.response) parts.push(`Response: ${ev.response}`);
  if (ev.expected) parts.push(`Expected: ${ev.expected}`);
  for (const [k, v] of Object.entries(ev))
    if (!["request", "response", "expected"].includes(k)) parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return "```\n" + parts.join("\n") + "\n```\n";
}

export function writeReport(results, { startedAt, seconds }) {
  const dir = path.join(suiteDir, "results");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ startedAt, seconds, results }, null, 2));

  let md = `# Security test results\n\nRun started ${startedAt}, took ${Math.round(seconds)} s.\n\n`;
  for (const [g, name] of Object.entries(GROUPS)) {
    const rows = results.filter((r) => r.group === Number(g));
    if (!rows.length) continue;
    md += `## ${g}. ${name}\n\n| ID | Test | Result |\n|---|---|---|\n`;
    for (const r of rows) md += `| ${r.id} | ${r.title.replaceAll("|", "\\|")} | ${r.status} |\n`;
    md += "\n";
  }
  md += "## Details\n\n";
  for (const r of results) {
    if (r.status === "PASS" && r.notes.length === 0) continue;
    md += `### ${r.id} ${r.title} — ${r.status}\n\nExpected: ${r.expected}\n\n`;
    for (const n of r.notes) md += `- ${n}\n`;
    if (r.notes.length) md += "\n";
    for (const f of r.failures) md += `**${f.message}**\n\n${evidenceText(f.evidence)}\n`;
  }
  fs.writeFileSync(path.join(dir, "report.md"), md);
  return path.join(dir, "report.md");
}
