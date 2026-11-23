"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { listAudit, type AuditFilter, type AuditLogDto, type Paged } from "@/lib/admin-api";
import { formatDate, formatNumber } from "@/lib/numbers";
import {
  actionKey,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  dayEndIso,
  dayStartIso,
  LOGIN_FAIL_REASONS,
  parseDetails,
  parseUtc,
  plainDetails,
} from "@/lib/audit-format";
import { toProblem, type Problem } from "@/lib/problem";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

const PAGE_SIZE = 25;

const control =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-paper px-3 py-2";
const emptyFilter = { userEmail: "", action: "", entityType: "", from: "", to: "" };
type Draft = typeof emptyFilter;

export function AuditPanel() {
  const t = useTranslations("Admin.audit");
  const locale = useLocale();
  const num = (value: number) => formatNumber(value, locale);
  const uid = useId();

  const [draft, setDraft] = useState<Draft>(emptyFilter);
  const [applied, setApplied] = useState<Draft>(emptyFilter);
  const [rangeError, setRangeError] = useState(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  const [result, setResult] = useState<{
    key: string;
    problem: Problem | null;
  } | null>(null);
  const [lastData, setLastData] = useState<Paged<AuditLogDto> | null>(null);

  const key = `${JSON.stringify(applied)}|${page}|${attempt}`;
  useEffect(() => {
    let cancelled = false;
    const filter: AuditFilter = {
      userEmail: applied.userEmail,
      action: applied.action,
      entityType: applied.entityType,
      from: applied.from ? dayStartIso(applied.from) : "",
      to: applied.to ? dayEndIso(applied.to) : "",
      page,
      pageSize: PAGE_SIZE,
    };
    listAudit(filter).then(
      (data) => {
        if (cancelled) return;
        setResult({ key, problem: null });
        setLastData(data);
      },
      (e) => !cancelled && setResult({ key, problem: toProblem(e) }),
    );
    return () => {
      cancelled = true;
    };
    // The filters and the page are all part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result?.key === key ? result : null;
  const loading = current === null;
  const problem = current?.problem ?? null;
  const data = lastData;
  const reload = () => setAttempt((n) => n + 1);

  function onApply(e: FormEvent) {
    e.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    setApplied(draft);
    setPage(1);
  }

  function onClear() {
    setRangeError(false);
    setDraft(emptyFilter);
    setApplied(emptyFilter);
    setPage(1);
  }

  const set = (field: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  const filtered = JSON.stringify(applied) !== JSON.stringify(emptyFilter);
  const when = (iso: string) => parseUtc(iso);

  return (
    <div className="max-w-7xl">
      <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
      <p className="mt-3 max-w-prose text-ink/80">{t("intro")}</p>

      <form
        role="search"
        aria-label={t("filtersLabel")}
        onSubmit={onApply}
        noValidate
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label htmlFor={`${uid}-email`} className="block font-medium">
            {t("fieldUser")}
          </label>
          <input
            id={`${uid}-email`}
            type="search"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={draft.userEmail}
            onChange={set("userEmail")}
            className={control}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-action`} className="block font-medium">
            {t("fieldAction")}
          </label>
          <select
            id={`${uid}-action`}
            value={draft.action}
            onChange={set("action")}
            className={control}
          >
            <option value="">{t("allActions")}</option>
            {Object.entries(AUDIT_ACTIONS).map(([code, k]) => (
              <option key={code} value={code}>
                {t(`actions.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-entity`} className="block font-medium">
            {t("fieldEntity")}
          </label>
          <select
            id={`${uid}-entity`}
            value={draft.entityType}
            onChange={set("entityType")}
            className={control}
          >
            <option value="">{t("allEntities")}</option>
            {AUDIT_ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {t(`entity.${e}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-from`} className="block font-medium">
            {t("fieldFrom")}
          </label>
          <input
            id={`${uid}-from`}
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={set("from")}
            aria-invalid={rangeError || undefined}
            aria-describedby={rangeError ? `${uid}-range` : undefined}
            className={control}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-to`} className="block font-medium">
            {t("fieldTo")}
          </label>
          <input
            id={`${uid}-to`}
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={set("to")}
            aria-invalid={rangeError || undefined}
            aria-describedby={rangeError ? `${uid}-range` : undefined}
            className={control}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-control border border-pine bg-pine px-5 font-semibold text-paper"
          >
            {t("apply")}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!filtered && JSON.stringify(draft) === JSON.stringify(emptyFilter)}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
          >
            {t("clear")}
          </button>
        </div>
        <div aria-live="assertive" className="empty:hidden sm:col-span-2 lg:col-span-3">
          {rangeError && (
            <p
              id={`${uid}-range`}
              className="border-s-4 border-alert-danger bg-stone px-4 py-3 text-alert-danger"
            >
              {t("rangeError")}
            </p>
          )}
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
          <p className="mt-6 text-ink/80">{t("total", { count: data.totalCount, n: num(data.totalCount) })}</p>

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
              <table className="w-full min-w-[58rem] border-collapse text-start text-base">
                <thead>
                  <tr className="border-b border-ink/30 text-sm text-ink/70">
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colWhen")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colUser")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colAction")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colEntity")}</th>
                    <th scope="col" className="py-3 pe-4 text-start font-medium">{t("colIp")}</th>
                    <th scope="col" className="py-3 text-start font-medium">{t("colDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-b border-line align-top">
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <time dateTime={when(row.occurredAt).toISOString()}>
                          {formatDate(when(row.occurredAt), locale, {
                            dateStyle: "medium",
                            timeStyle: "medium",
                          })}
                        </time>
                      </td>
                      <td className="max-w-56 py-3 pe-4 break-all">
                        {row.userEmail ? (
                          <bdi dir="ltr">{row.userEmail}</bdi>
                        ) : (
                          <span className="text-ink/60">{t("noUser")}</span>
                        )}
                      </td>
                      <td className="py-3 pe-4 font-medium">
                        <ActionName code={row.action} />
                      </td>
                      <td className="py-3 pe-4">
                        <Entity type={row.entityType} id={row.entityId} />
                      </td>
                      <td className="py-3 pe-4 whitespace-nowrap">
                        <bdi dir="ltr">{row.ipAddress ?? "—"}</bdi>
                      </td>
                      <td className="max-w-72 py-3 text-sm">
                        <Details action={row.action} raw={row.details} />
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
                {t("page", { page: num(page), total: num(data.totalPages) })}
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
    </div>
  );
}

function ActionName({ code }: { code: string }) {
  const t = useTranslations("Admin.audit");
  const k = actionKey(code);
  // An action this version does not know yet: show its code as is.
  return k ? <>{t(`actions.${k}`)}</> : <code dir="ltr">{code}</code>;
}

function Entity({ type, id }: { type: string | null; id: string | null }) {
  const t = useTranslations("Admin.audit");
  if (!type && !id) return <span className="text-ink/60">—</span>;
  const known = (AUDIT_ENTITY_TYPES as readonly string[]).includes(type ?? "");
  return (
    <>
      {type && <span>{known ? t(`entity.${type as (typeof AUDIT_ENTITY_TYPES)[number]}`) : type}</span>}
      {id && (
        <code dir="ltr" title={id} className="block text-start font-mono text-sm text-ink/70">
          {id.slice(0, 8)}
        </code>
      )}
    </>
  );
}

// "details" is the JSON the API stored with the action. Known shapes get a
// sentence; anything else is listed as plain "name: value" lines. Fields that
// look like secrets are never shown.
function Details({ action, raw }: { action: string; raw: string | null }) {
  const t = useTranslations("Admin.audit.details");
  const tr = useTranslations("Admin.users.role");
  const details = parseDetails(raw);
  if (!details) return <span className="text-ink/60">—</span>;

  const role = (v: unknown) =>
    v === "Admin" || v === "Editor" ? tr(v) : typeof v === "string" ? v : "?";

  if (action === "user.role_changed") {
    return <>{t("roleChanged", { from: role(details.from), to: role(details.to) })}</>;
  }
  if (action === "user.created" && "role" in details) {
    return <>{t("createdAs", { role: role(details.role) })}</>;
  }
  if (action === "auth.login.failed" && typeof details.reason === "string") {
    const k = Object.hasOwn(LOGIN_FAIL_REASONS, details.reason)
      ? LOGIN_FAIL_REASONS[details.reason as keyof typeof LOGIN_FAIL_REASONS]
      : null;
    return <>{k ? t(`reason.${k}`) : details.reason}</>;
  }

  const rows = plainDetails(details);
  if (rows.length === 0) return <span className="text-ink/60">—</span>;
  return (
    <ul>
      {rows.map(([k, v]) => (
        <li key={k}>
          {k}: {v}
        </li>
      ))}
    </ul>
  );
}
