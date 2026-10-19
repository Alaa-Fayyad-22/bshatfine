"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  AdminApiError,
  COUNCIL_TEXT_MAX,
  COVER_MAX_BYTES,
  COVER_TYPES,
  createCouncilMember,
  getCouncilMember,
  removeCouncilPhoto,
  updateCouncilMember,
  uploadCouncilPhoto,
  type AdminCouncilMemberDto,
  type CouncilMemberInput,
} from "@/lib/admin-api";
import { coverUrl } from "@/lib/cover";
import { rateProblem, type Problem } from "@/lib/problem";
import {
  ConflictNotice,
  dangerOutlineButton,
  inputClass,
  neutralButton,
  outlineButton,
  primaryButton,
} from "./AdminControls";
import { Modal, useModalClose } from "./Modal";
import { isRateLimited, ProblemNotice } from "./ProblemNotice";

// First letters of the first two words, for members without a photo.
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
}

type Values = CouncilMemberInput;
const emptyValues: Values = { nameAr: "", nameEn: "", positionAr: "", positionEn: "" };

function toValues(m: AdminCouncilMemberDto): Values {
  return {
    nameAr: m.nameAr,
    nameEn: m.nameEn ?? "",
    positionAr: m.positionAr,
    positionEn: m.positionEn ?? "",
  };
}

// Add / edit one member in a native <dialog> (focus is trapped, Escape closes,
// focus returns to the button that opened it). Adding saves the member and then
// stays open in edit mode, because a photo needs a saved member.
export function CouncilMemberDialog({
  initial,
  onChange,
  onClose,
}: {
  // null: add a new member.
  initial: AdminCouncilMemberDto | null;
  // Called with every up-to-date member the API returns, to refresh the list.
  onChange: (member: AdminCouncilMemberDto) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.council");
  const [saved, setSaved] = useState(initial !== null);
  return (
    <Modal title={saved ? t("editTitle") : t("addTitle")} onClose={onClose}>
      <Body initial={initial} onChange={onChange} onCreated={() => setSaved(true)} />
    </Modal>
  );
}

function Body({
  initial,
  onChange,
  onCreated,
}: {
  initial: AdminCouncilMemberDto | null;
  onChange: (member: AdminCouncilMemberDto) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("Admin.council");
  const tf = useTranslations("Admin.form");
  const close = useModalClose();
  const uid = useId();

  const [member, setMember] = useState<AdminCouncilMemberDto | null>(initial);
  const [values, setValues] = useState<Values>(initial ? toValues(initial) : emptyValues);
  const [baseline, setBaseline] = useState(JSON.stringify(values));
  const [busy, setBusy] = useState<"save" | "upload" | "removePhoto" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rate, setRate] = useState<Problem | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [missing, setMissing] = useState<{ nameAr?: true; positionAr?: true }>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameArRef = useRef<HTMLInputElement | null>(null);
  const positionArRef = useRef<HTMLInputElement | null>(null);

  const waiting = isRateLimited(rate);
  const locked = busy !== null;
  const dirty = JSON.stringify(values) !== baseline;

  // The dialog is opened by the parent's effect, which runs after this one.
  useEffect(() => {
    const timer = setTimeout(() => nameArRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  function adopt(dto: AdminCouncilMemberDto, { resetForm }: { resetForm: boolean }) {
    setMember(dto);
    onChange(dto);
    if (resetForm) {
      const v = toValues(dto);
      setValues(v);
      setBaseline(JSON.stringify(v));
      setConflict(false);
    }
  }

  function describe(e: unknown): string {
    if (e instanceof AdminApiError) return e.detail ?? tf("apiError", { status: e.status });
    return tf("networkError");
  }

  async function run(kind: "save" | "upload" | "removePhoto", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setRate(null);
    setSuccess(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 429) setRate(rateProblem(e.retryAfter));
      else if (e instanceof AdminApiError && e.status === 409) setConflict(true);
      else setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  function save() {
    const missingNow = {
      ...(values.nameAr.trim() ? {} : { nameAr: true as const }),
      ...(values.positionAr.trim() ? {} : { positionAr: true as const }),
    };
    setMissing(missingNow);
    if (missingNow.nameAr) {
      setError(t("nameArRequired"));
      return nameArRef.current?.focus();
    }
    if (missingNow.positionAr) {
      setError(t("positionArRequired"));
      return positionArRef.current?.focus();
    }
    return run("save", async () => {
      if (member) {
        adopt(await updateCouncilMember(member.id, values, member.version), { resetForm: true });
        setSuccess(t("savedOk"));
      } else {
        const created = await createCouncilMember(values);
        adopt(created, { resetForm: true });
        onCreated();
        setSuccess(t("createdOk", { name: created.nameAr }));
      }
    });
  }

  async function loadLatest() {
    if (!member) return;
    setReloading(true);
    try {
      const latest = await getCouncilMember(member.id);
      if (!latest) {
        setError(t("gone"));
        setConflict(false);
        return;
      }
      adopt(latest, { resetForm: true });
      setError(null);
      setSuccess(t("latestLoadedOk"));
    } catch (e) {
      setError(describe(e));
    } finally {
      setReloading(false);
    }
  }

  function onPhotoPicked(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !member) return;
    if (!(COVER_TYPES as readonly string[]).includes(file.type)) {
      setSuccess(null);
      return setError(t("photoTypeError"));
    }
    if (file.size > COVER_MAX_BYTES) {
      setSuccess(null);
      return setError(t("photoSizeError", { max: COVER_MAX_BYTES / (1024 * 1024) }));
    }
    return run("upload", async () => {
      // Only the photo changes: keep whatever is typed, but adopt the new version.
      adopt(await uploadCouncilPhoto(member.id, file), { resetForm: false });
      setSuccess(t("photoUploadedOk"));
    });
  }

  function removePhoto() {
    if (!member) return;
    return run("removePhoto", async () => {
      adopt(await removeCouncilPhoto(member.id), { resetForm: false });
      setSuccess(t("photoRemovedOk"));
    });
  }

  const text = (
    name: keyof Values,
    label: string,
    lang: "ar" | "en",
    opts: { required?: boolean; inputRef?: React.RefObject<HTMLInputElement | null> } = {},
  ) => {
    const id = `${uid}-${name}`;
    return (
      <div>
        <label htmlFor={id} className="block font-medium">
          {label}
        </label>
        <input
          id={id}
          ref={opts.inputRef}
          type="text"
          lang={lang}
          dir={lang === "ar" ? "rtl" : "ltr"}
          maxLength={COUNCIL_TEXT_MAX}
          readOnly={locked}
          required={opts.required}
          aria-required={opts.required || undefined}
          aria-invalid={(name === "nameAr" && missing.nameAr) || (name === "positionAr" && missing.positionAr) || undefined}
          aria-describedby={`${id}-hint`}
          value={values[name]}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
          className={inputClass}
        />
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink/70">
          {opts.required ? `${t("requiredHint")} ` : lang === "en" && name === "nameEn" ? `${t("englishOptional")} ` : ""}
          {t("chars", { count: values[name].length, max: COUNCIL_TEXT_MAX })}
        </p>
      </div>
    );
  };

  const photo = coverUrl(member?.photoUrl);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && !waiting) void save();
      }}
      className="mt-4 grid gap-5"
    >
      {text("nameAr", t("nameAr"), "ar", { required: true, inputRef: nameArRef })}
      {text("positionAr", t("positionAr"), "ar", { required: true, inputRef: positionArRef })}
      {text("nameEn", t("nameEn"), "en")}
      {text("positionEn", t("positionEn"), "en")}

      <section aria-labelledby={`${uid}-photo`} className="border-t border-hairline pt-4">
        <h3 id={`${uid}-photo`} className="font-medium">
          {t("photoTitle")}
        </h3>
        {member ? (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-card bg-sand">
              {photo ? (
                <Image src={photo} alt={t("photoOf", { name: member.nameAr })} fill sizes="8rem" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center px-2 text-center text-sm text-ink/70">
                  {t("photoNone")}
                </span>
              )}
              {(busy === "upload" || busy === "removePhoto") && (
                <p role="status" className="absolute inset-0 grid place-items-center bg-ivory/80 px-2 text-center text-sm font-medium">
                  {busy === "upload" ? t("photoUploading") : t("photoRemoving")}
                </p>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-3">
              <p id={`${uid}-photo-hint`} className="text-sm text-ink/70">
                {t("photoHint")}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={COVER_TYPES.join(",")}
                hidden
                tabIndex={-1}
                onChange={(e) => onPhotoPicked(e.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={locked || waiting}
                  aria-describedby={`${uid}-photo-hint`}
                  onClick={() => fileRef.current?.click()}
                  className={outlineButton}
                >
                  {photo ? t("photoReplace") : t("photoChoose")}
                </button>
                {photo && (
                  <button
                    type="button"
                    disabled={locked || waiting}
                    onClick={removePhoto}
                    className={dangerOutlineButton}
                  >
                    {t("photoRemove")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/70">{t("photoAfterSave")}</p>
        )}
      </section>

      <div aria-live="polite" role="status" className="empty:hidden">
        {success && <p className="font-medium text-cedar">{success}</p>}
        {dirty && !success && !error && <p className="text-sm text-ink/70">{tf("unsaved")}</p>}
      </div>
      {error && (
        <p role="alert" className="border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger">
          <span className="sr-only">{tf("errorTitle")}: </span>
          {error}
        </p>
      )}
      {rate && <ProblemNotice problem={rate} onRateDone={() => setRate(null)} />}
      <ConflictNotice
        open={conflict}
        title={t("conflictTitle")}
        text={t("conflictText")}
        loadLatest={t("loadLatest")}
        loadLatestConfirm={t("loadLatestConfirm")}
        loadLatestYes={t("loadLatestYes")}
        loadingLatest={t("loadingLatest")}
        cancel={t("cancel")}
        reloading={reloading}
        onLoadLatest={loadLatest}
      />

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={locked || waiting || conflict} className={primaryButton}>
          {busy === "save" ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={close} disabled={locked} className={neutralButton}>
          {t("close")}
        </button>
      </div>
    </form>
  );
}
