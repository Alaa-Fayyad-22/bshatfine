// Every setting of the suite, read from environment variables with the
// documented development defaults (see README.md). Nothing here is a real
// secret: the accounts and the database role exist only in the throwaway
// bshatfine_test database, which the suite creates and drops itself.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env;
const here = path.dirname(fileURLToPath(import.meta.url));

export const suiteDir = path.resolve(here, "..");
export const repoRoot = path.resolve(suiteDir, "..", "..");

export const config = {
  apiUrl: (env.SECTEST_API_URL ?? "http://localhost:5247").replace(/\/+$/, ""),
  webUrl: (env.SECTEST_WEB_URL ?? "http://localhost:3001").replace(/\/+$/, ""),
  // A second local origin for the cross-site / same-site attacker pages.
  attackerPort: Number(env.SECTEST_ATTACKER_PORT ?? 4444),

  db: {
    container: env.SECTEST_DB_CONTAINER ?? "bshatfine-db",
    // Fixed on purpose: every SQL helper refuses any other database.
    name: "bshatfine_test",
    role: env.SECTEST_DB_ROLE ?? "bshatfine_sectest",
    password: env.SECTEST_DB_PASSWORD ?? "sectest-throwaway-Db-2026",
    host: env.SECTEST_DB_HOST ?? "localhost",
    port: env.SECTEST_DB_PORT ?? "5433",
  },

  // Where the copies of backend/ and frontend/ and the server logs go.
  workDir: env.SECTEST_WORK_DIR ?? path.join(os.tmpdir(), "bshatfine-sectest"),

  // Test accounts. admin1 is created by the API's own seeder (SeedAdmin__*);
  // admin2 and editor are created through the API by the suite.
  accounts: {
    admin1: {
      email: env.SECTEST_ADMIN1_EMAIL ?? "sectest-admin1@example.test",
      password: env.SECTEST_ADMIN1_PASSWORD ?? "Sectest-Admin1-Pass-2026",
      role: "Admin",
    },
    admin2: {
      email: env.SECTEST_ADMIN2_EMAIL ?? "sectest-admin2@example.test",
      password: env.SECTEST_ADMIN2_PASSWORD ?? "Sectest-Admin2-Pass-2026",
      role: "Admin",
    },
    editor: {
      email: env.SECTEST_EDITOR_EMAIL ?? "sectest-editor@example.test",
      password: env.SECTEST_EDITOR_PASSWORD ?? "Sectest-Editor-Pass-2026",
      role: "Editor",
    },
  },
  // Password given to the extra throwaway accounts some tests create.
  extraPassword: env.SECTEST_EXTRA_PASSWORD ?? "Sectest-Extra-Pass-2026",

  // How often the race tests repeat the "admins vs admins" scenario.
  raceRepeats: Number(env.SECTEST_RACE_REPEATS ?? 5),
};

// The suite must never touch the developer's own environment (API :5246,
// site :3000, database bshatfine) or any real account.
export function assertIsolated() {
  const problems = [];
  const apiPort = new URL(config.apiUrl).port;
  const webPort = new URL(config.webUrl).port;
  if (apiPort === "5246") problems.push("SECTEST_API_URL points at the development API (:5246).");
  if (webPort === "3000") problems.push("SECTEST_WEB_URL points at the development site (:3000).");
  if (config.db.name !== "bshatfine_test") problems.push("The database must be bshatfine_test.");
  for (const [name, a] of Object.entries(config.accounts)) {
    if (!a.email.toLowerCase().endsWith("@example.test"))
      problems.push(`Account ${name} must use an @example.test address (reserved, never a real mailbox).`);
  }
  if (problems.length > 0) throw new Error(`Refusing to run:\n - ${problems.join("\n - ")}`);
}
