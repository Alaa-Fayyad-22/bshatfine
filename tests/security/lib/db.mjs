// SQL against the throwaway test database, through psql inside the existing
// PostgreSQL container (the container's own superuser, so no password is
// needed or stored). Every helper refuses any database but bshatfine_test.
import { spawnSync } from "node:child_process";
import { config } from "./config.mjs";

function psql(database, sql) {
  if (database !== config.db.name && database !== "postgres")
    throw new Error(`Refusing to run SQL against database "${database}".`);
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      config.db.container,
      "sh",
      "-c",
      `psql -X -q -U "$POSTGRES_USER" -d ${database} -At -F '\t' -v ON_ERROR_STOP=1`,
    ],
    { input: sql, encoding: "utf8", windowsHide: true },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr.trim()}`);
  return r.stdout;
}

// Rows of the test database as arrays of strings.
export function rows(sql) {
  return psql(config.db.name, sql)
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => l.split("\t"));
}

export function scalar(sql) {
  const r = rows(sql);
  return r.length ? r[0][0] : null;
}

export const count = (sql) => Number(scalar(sql));

export function exec(sql) {
  psql(config.db.name, sql);
}

// Statements on the maintenance database (CREATE/DROP DATABASE, roles).
// Only used by env.mjs, with fixed names from config.
export function admin(sql) {
  return psql("postgres", sql);
}

// SQL string literal.
export const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;

// ---------- Facts the tests check ----------
export const tables = () =>
  rows(`select table_name from information_schema.tables where table_schema='public' order by 1`).map((r) => r[0]);

export const storedFileCount = () => count(`select count(*) from "StoredFiles"`);

export const storedFileExists = (id) => count(`select count(*) from "StoredFiles" where "Id"=${lit(id)}`) > 0;

// Files that no news article, entry or council member points to.
export const orphanFiles = () =>
  rows(`select f."Id", f."Folder" from "StoredFiles" f
        where not exists (select 1 from "News" n where n."CoverImagePath" = f."Id"::text)
          and not exists (select 1 from "Entries" e where e."CoverImagePath" = f."Id"::text)
          and not exists (select 1 from "CouncilMembers" c where c."PhotoPath" = f."Id"::text)`);

export const activeAdmins = () =>
  rows(`select u."Email" from "AspNetUsers" u
        join "AspNetUserRoles" ur on ur."UserId" = u."Id"
        join "AspNetRoles" r on r."Id" = ur."RoleId"
        where r."Name" = 'Admin' and u."IsActive"`).map((r) => r[0]);

export function auditCount(action, entityId) {
  return count(`select count(*) from "AuditLogs" where "Action"=${lit(action)} and "EntityId"=${lit(entityId)}`);
}

// Removes a news article whatever its state (published ones cannot be deleted
// through the API), with its translations and cover file.
export function purgeNews(id) {
  exec(`delete from "StoredFiles" where "Id"::text in (select "CoverImagePath" from "News" where "Id"=${lit(id)});
        delete from "NewsTranslations" where "NewsId"=${lit(id)};
        delete from "News" where "Id"=${lit(id)};`);
}

export function purgeEntry(id) {
  exec(`delete from "StoredFiles" where "Id"::text in (select "CoverImagePath" from "Entries" where "Id"=${lit(id)});
        delete from "EntryTranslations" where "EntryId"=${lit(id)};
        delete from "Entries" where "Id"=${lit(id)};`);
}

export function purgeCouncil(id) {
  exec(`delete from "StoredFiles" where "Id"::text in (select "PhotoPath" from "CouncilMembers" where "Id"=${lit(id)});
        delete from "CouncilMembers" where "Id"=${lit(id)};`);
}
