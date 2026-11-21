// npm run env:up | env:down | env:status
import { assertIsolated } from "./lib/config.mjs";
import { down, status, up } from "./lib/environment.mjs";

assertIsolated();
const cmd = process.argv[2];
try {
  if (cmd === "up") await up();
  else if (cmd === "down") await down({ keepCopies: process.argv.includes("--keep-copies") });
  else if (cmd === "status") console.log(await status());
  else {
    console.error("Usage: node env.mjs up | down [--keep-copies] | status");
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message ?? e);
  process.exitCode = 1;
}
