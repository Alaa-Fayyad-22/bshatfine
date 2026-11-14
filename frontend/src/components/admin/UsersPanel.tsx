"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  listUsers,
  STAFF_ROLES,
  type Paged,
  type StaffRole,
  type StaffUserDto,
  type TemporaryPasswordResult,
  type UserFilter,
} from "@/lib/admin-api";
import { toProblem, type Problem } from "@/lib/problem";
import { useAdminUser } from "./AdminGuard";
import { CreateUserDialog } from "./CreateUserDialog";
import { PasswordRevealDialog } from "./PasswordRevealDialog";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";
import { UserManageDialog } from "./UserManageDialog";
import { UserStatus } from "./UserStatus";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 350;

const control =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-paper px-3 py-2";

// The one-time password and who it is for. Lives in state only while its dialog
// is open; closing the dialog sets this back to null.
type Reveal = { name: string; email: string; password: string };

export function UsersPanel() {
  const t = useTranslations("Admin.users");
  const format = useFormatter();
  const me = useAdminUser();
  const uid = useId();

  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [status, setStatus] = useState<UserFilter["isActive"]>("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  const [result, setResult] = useState<{
    key: string;
    data: Paged<StaffUserDto> | null;
    problem: Problem | null;
  } | null>(null);
  const [lastData, setLastData] = useState<Paged<StaffUserDto> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // Typing in the search box waits a moment before it asks the API.
  useEffect(() => {
    const next = searchText.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, search]);

  const key = `${search}|${role}|${status}|${page}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    listUsers({ search, role, isActive: status, page, pageSize: PAGE_SIZE }).then(
      (data) => {
        if (cancelled) return;
        setResult({ key, data, problem: null });
        setLastData(data);
      },
      (e) => !cancelled && setResult({ key, data: null, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
    // The filters are all part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const problem = current?.problem ?? null;
  // The previous page of results stays on screen while a new one loads, so the
  // search box and the row buttons keep their place (and focus).
  const data = lastData;
  const managing = data?.items.find((u) => u.id === managingId) ?? null;

  function replaceUser(updated: StaffUserDto) {
    setLastData((d) =>
      d ? { ...d, items: d.items.map((u) => (u.id === updated.id ? updated : u)) } : d,
    );
  }

  function openReveal(r: TemporaryPasswordResult) {
    setReveal({ name: r.user.displayName, email: r.user.email, password: r.temporaryPassword });
  }

  function reload() {
    setAttempt((n) => n + 1);
  }

  const clearFilters = () => {
    setSearchText("");
    setSearch("");
    setRole("");
    setStatus("");
    setPage(1);
  };
  const filtered = search !== "" || role !== "" || status !== "";

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setCreating(true);
          }}
          className="inline-flex min-h-11 items-center rounded-control bg-pine px-5 font-semibold text-paper"
        >
          {t("new")}
        </button>
      </div>

      <div aria-live="polite" role="status" className="empty:hidden">
        {notice && (
          <p className="mt-4 border-s-4 border-pine bg-stone px-4 py-3 font-medium text-pine">
            {notice}
          </p>
        )}
      </div>

      <form
        role="search"
        aria-label={t("filtersLabel")}
        onSubmit={(e) => e.preventDefault()}
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <div>
          <label htmlFor={`${uid}-search`} className="block font-medium">
            {t("search")}
          </label>
          <input
            id={`${uid}-search`}
            type="search"
            value={searchText}
            autoComplete="off"
            onChange={(e) => setSearchText(e.target.value)}
            className={control}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-role`} className="block font-medium">
            {t("fieldRole")}
          </label>
          <select
            id={`${uid}-role`}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as StaffRole | "");
              setPage(1);
            }}
            className={control}
          >
            <option value="">{t("all")}</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-status`} className="block font-medium">
            {t("fieldStatus")}
          </label>
          <select
            id={`${uid}-status`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as UserFilter["isActive"]);
              setPage(1);
            }}
            className={control}
          >
            <option value="">{t("all")}</option>
            <option value="true">{t("status.active")}</option>
            <option value="false">{t("status.disabled")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtered && searchText === ""}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
          >
            {t("clear")}
          </button>
        </div>
      </form>

      {problem && (
        <div className="mt-6 max-w-prose space-y-3">
          <ProblemNotice problem={problem} onRateDone={reload} />
          {!isRateLimited(problem) && (
            <button
              type="button"
              onClick={reload}
              className="min-h-11 font-semibold underline underline-offset-4"
            >
              {t("retry")}
            </button>
          )}
        </div>
      )}

      {data === null ? (
        !problem && (
          <p role="status" className="mt-8 text-ink/70">
            {t("loading")}
          </p>
        )
      ) : (
        <div aria-busy={loading} className={loading ? "opacity-60" : undefined}>
          <p className="mt-6 text-ink/80">{t("total", { count: data.totalCount })}</p>

          {page > Math.max(data.totalPages, 1) ? (
            <div role="status" className="mt-8 max-w-prose">
              <p>{t("pageOutOfRange")}</p>
              <button
                type="button"
                onClick={() => setPage(1)}
                className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              >
                {t("goToFirst")}
              </button>
            </div>
          ) : data.items.length === 0 ? (
            <p role="status" className="mt-8 max-w-prose text-ink/80">
              {filtered ? t("emptyFilter") : t("empty")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-start text-base">
                <thead>
                  <tr className="border-b border-ink/30 text-sm text-ink/70">
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colName")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colEmail")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colRole")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colStatus")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colCreated")}</th>
                    <th scope="col" className="py-3 text-start font-medium">
                      <span className="sr-only">{t("colActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id} className="border-b border-line align-top">
                      <td className="max-w-56 py-3 pe-4 font-medium break-words">
                        {u.displayName}
                        {u.id === me.id && (
                          <span className="ms-2 text-sm font-normal text-ink/70">({t("you")})</span>
                        )}
                      </td>
                      <td className="max-w-64 py-3 pe-4 break-all">
                        <bdi dir="ltr">{u.email}</bdi>
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">{t(`role.${u.role}`)}</td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <UserStatus user={u} />
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <time dateTime={u.createdAt}>
                          {format.dateTime(new Date(u.createdAt), { dateStyle: "medium" })}
                        </time>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(null);
                            setManagingId(u.id);
                          }}
                          aria-label={t("manageLabel", { name: u.displayName })}
                          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                        >
                          {t("manageButton")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.totalPages > 1 && (
            <nav
              aria-label={t("pagination")}
              className="mt-8 flex items-center justify-between gap-6"
            >
              {page > 1 ? (
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
                >
                  {t("previous")}
                </button>
              ) : (
                <span />
              )}
              <span className="text-sm text-ink/70">
                {t("page", { page, total: data.totalPages })}
              </span>
              {page < data.totalPages ? (
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
                >
                  {t("next")}
                </button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      )}

      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            openReveal(r);
            setNotice(t("create.createdOk", { name: r.user.displayName }));
            reload();
          }}
        />
      )}

      {managing && (
        <UserManageDialog
          user={managing}
          isSelf={managing.id === me.id}
          onClose={() => setManagingId(null)}
          onChanged={replaceUser}
          onReset={(r) => {
            openReveal(r);
            setNotice(t("manage.resetOk", { name: r.user.displayName }));
          }}
        />
      )}

      {reveal && (
        <PasswordRevealDialog
          name={reveal.name}
          email={reveal.email}
          password={reveal.password}
          // Dropping the password here is what "gone once the dialog closes" means.
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}
