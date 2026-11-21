// npm test               env up → all groups → env down, prints the table
// npm run test:only      the tests only (environment already up)
// Options: --groups 1,3,6   --keep-env (leave the servers and database up)
import { assertIsolated, config } from "./lib/config.mjs";
import { count, lit, tables } from "./lib/db.mjs";
import { down, up } from "./lib/environment.mjs";
import { Sessions } from "./lib/fixtures.mjs";
import { closeBrowser } from "./lib/browser.mjs";
import { GROUPS, printTable, runAll, writeReport } from "./lib/runner.mjs";

const args = process.argv.slice(2);
const noEnv = args.includes("--no-env");
const keepEnv = args.includes("--keep-env");
const gi = args.indexOf("--groups");
const groups = gi >= 0 ? args[gi + 1].split(",").map(Number) : undefined;

assertIsolated();
const startedAt = new Date().toISOString();
const t0 = Date.now();
let exit = 0;

try {
  if (!noEnv) await up();

  const sessions = await new Sessions().init();
  // Proof that the API under test uses the throwaway database and not the
  // developer's: the seeded test admin must be a row of bshatfine_test.
  const proof = count(`select count(*) from "AspNetUsers" where "NormalizedEmail"=${lit(config.accounts.admin1.email.toUpperCase())}`);
  if (proof !== 1) throw new Error("The API on the test port is not using bshatfine_test. Stopping.");

  const shared = {
    sessions,
    tablesAtStart: tables(),
    api: config.apiUrl,
    web: config.webUrl,
    raceRepeats: config.raceRepeats,
  };

  for (const f of ["01-injection", "02-xss", "03-access", "04-csrf", "05-uploads", "06-races", "07-headers"])
    await import(`./tests/${f}.mjs`);

  console.log(`\nRunning ${groups ? groups.map((g) => GROUPS[g]).join(", ") : "all groups"} against ${config.apiUrl} and ${config.webUrl}\n`);
  const results = await runAll(shared, { groups });
  await closeBrowser();
  const seconds = (Date.now() - t0) / 1000;
  printTable(results);
  const report = writeReport(results, { startedAt, seconds });
  console.log(`\nFull report: ${report}\nDuration: ${Math.round(seconds)} s`);
  if (results.some((r) => r.status === "FAIL")) exit = 1;
} catch (e) {
  console.error(`\n${e.stack ?? e}`);
  exit = 2;
} finally {
  await closeBrowser().catch(() => {});
  if (!noEnv && !keepEnv) await down().catch((e) => console.error(`env down failed: ${e.message}`));
}
process.exit(exit);
