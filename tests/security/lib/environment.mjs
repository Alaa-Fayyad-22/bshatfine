// The isolated test environment:
//   database bshatfine_test (own role) in the existing bshatfine-db container,
//   a copy of backend/ migrated with `dotnet ef database update --connection`
//   and run on :5247, and a production build of a copy of frontend/ on :3001.
// Nothing is written inside the repository, and the developer's API (:5246),
// site (:3000) and database (bshatfine) are never touched.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config, repoRoot } from "./config.mjs";
import { admin as adminSql } from "./db.mjs";

const work = config.workDir;
const pidFile = path.join(work, "pids.json");
const backendCopy = path.join(work, "backend");
const frontendCopy = path.join(work, "frontend");
const isWin = process.platform === "win32";

const connectionString = () =>
  `Host=${config.db.host};Port=${config.db.port};Database=${config.db.name};` +
  `Username=${config.db.role};Password=${config.db.password}`;

const log = (msg) => console.log(`[env] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "manual" });
    return res.status;
  } catch {
    return 0;
  }
}

async function waitFor(url, label, seconds, logFile) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const s = await reachable(url);
    if (s >= 200 && s < 500) return;
    await sleep(1500);
  }
  throw new Error(`${label} did not start within ${seconds}s. See ${logFile}`);
}

function run(cmd, args, opts = {}) {
  log(`${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", windowsHide: true, shell: opts.shell ?? false, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed with exit code ${r.status}`);
}

// Copies a folder, skipping build output, dependencies and local env files.
function copyTree(from, to, skip) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      return !skip.some((s) => (s instanceof RegExp ? s.test(name) : s === name));
    },
  });
}

function readPids() {
  try {
    return JSON.parse(fs.readFileSync(pidFile, "utf8"));
  } catch {
    return {};
  }
}

function startDetached(name, cmd, args, opts) {
  const logFile = path.join(work, `${name}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(cmd, args, {
    ...opts,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  const pids = readPids();
  pids[name] = child.pid;
  fs.writeFileSync(pidFile, JSON.stringify(pids, null, 2));
  return logFile;
}

function killTree(pid) {
  if (!pid) return;
  if (isWin) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

// ---------- Database ----------
function createDatabase() {
  const { role, password, name } = config.db;
  log(`creating database ${name} (role ${role}) in container ${config.db.container}`);
  adminSql(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} LOGIN PASSWORD '${password.replaceAll("'", "''")}';
  END IF;
END $$;
ALTER ROLE ${role} LOGIN PASSWORD '${password.replaceAll("'", "''")}';
DROP DATABASE IF EXISTS ${name} WITH (FORCE);
CREATE DATABASE ${name} OWNER ${role};
`);
}

function dropDatabase() {
  const { role, name } = config.db;
  log(`dropping database ${name} and role ${role}`);
  adminSql(`DROP DATABASE IF EXISTS ${name} WITH (FORCE);\nDROP ROLE IF EXISTS ${role};\n`);
}

// ---------- Up / down ----------
export async function status() {
  return {
    api: await reachable(`${config.apiUrl}/api/site-settings`),
    web: await reachable(`${config.webUrl}/ar`),
    pids: readPids(),
  };
}

export async function up() {
  fs.mkdirSync(work, { recursive: true });
  const before = await status();
  if (before.api || before.web)
    throw new Error(
      `Something already answers on ${config.apiUrl} or ${config.webUrl}. ` +
        "Run `npm run env:down` first (or free the ports).",
    );

  const seed = config.accounts.admin1;
  const apiEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    DOTNET_ENVIRONMENT: "Development",
    ConnectionStrings__Default: connectionString(),
    SeedAdmin__Email: seed.email,
    SeedAdmin__Password: seed.password,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_NOLOGO: "1",
  };

  // 1. Database
  createDatabase();

  // 2. Backend: a copy outside the repo, so the running API's files are not locked
  log(`copying backend/ to ${backendCopy}`);
  copyTree(path.join(repoRoot, "backend"), backendCopy, ["bin", "obj", ".vs", /\.user$/]);
  run("dotnet", ["build", path.join(backendCopy, "Bshatfine.Api"), "-v", "q", "-nologo"], { env: apiEnv });
  run(
    "dotnet",
    [
      "ef",
      "database",
      "update",
      "--project",
      path.join(backendCopy, "Bshatfine.Infrastructure"),
      "--startup-project",
      path.join(backendCopy, "Bshatfine.Api"),
      "--connection",
      connectionString(),
    ],
    { env: apiEnv },
  );
  const apiLog = startDetached(
    "api",
    "dotnet",
    ["run", "--project", path.join(backendCopy, "Bshatfine.Api"), "--no-launch-profile", "--urls", config.apiUrl],
    { env: apiEnv, cwd: path.join(backendCopy, "Bshatfine.Api") },
  );
  log(`API starting on ${config.apiUrl} (log: ${apiLog})`);
  await waitFor(`${config.apiUrl}/api/site-settings`, "The test API", 300, apiLog);

  // 3. Frontend: production build of a copy, pointed at the test API
  log(`copying frontend/ to ${frontendCopy}`);
  copyTree(path.join(repoRoot, "frontend"), frontendCopy, ["node_modules", ".next", /^\.env/, "next-env.d.ts"]);
  const webEnv = { ...process.env, API_INTERNAL_URL: config.apiUrl, NEXT_TELEMETRY_DISABLED: "1" };
  delete webEnv.NODE_ENV;
  const hasLock = fs.existsSync(path.join(frontendCopy, "package-lock.json"));
  run("npm", [hasLock ? "ci" : "install", "--no-audit", "--no-fund"], { cwd: frontendCopy, env: webEnv, shell: isWin });
  run("npm", ["run", "build"], { cwd: frontendCopy, env: webEnv, shell: isWin });
  const nextBin = path.join(frontendCopy, "node_modules", "next", "dist", "bin", "next");
  const webLog = startDetached("web", process.execPath, [nextBin, "start", "-p", new URL(config.webUrl).port], {
    env: { ...webEnv, NODE_ENV: "production" },
    cwd: frontendCopy,
  });
  log(`site starting on ${config.webUrl} (log: ${webLog})`);
  await waitFor(`${config.webUrl}/ar`, "The test site", 120, webLog);
  log("environment is up");
}

export async function down({ keepCopies = false } = {}) {
  const pids = readPids();
  for (const [name, pid] of Object.entries(pids)) {
    log(`stopping ${name} (pid ${pid})`);
    killTree(pid);
  }
  try {
    fs.rmSync(pidFile, { force: true });
  } catch {
    /* ignore */
  }
  // Give the API a moment to close its connections, then drop the database.
  await sleep(1500);
  dropDatabase();
  if (!keepCopies) {
    log(`removing ${work}`);
    for (let i = 0; i < 5; i++) {
      try {
        fs.rmSync(work, { recursive: true, force: true });
        break;
      } catch {
        await sleep(2000); // Windows may hold files for a moment after the processes exit
      }
    }
  }
  log("environment is down");
}
