"use client";

import { useRef, useState } from "react";

export const adminButton =
  "inline-flex min-h-11 items-center justify-center rounded-control border px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButton = `${adminButton} border-cedar bg-cedar text-ivory`;
export const outlineButton = `${adminButton} border-cedar bg-ivory text-cedar`;
export const neutralButton = `${adminButton} border-ink/40 bg-ivory`;
export const dangerButton = `${adminButton} border-alert-danger bg-alert-danger text-ivory`;
export const dangerOutlineButton = `${adminButton} border-alert-danger bg-ivory text-alert-danger`;
export const inputClass =
  "mt-1 block min-h-11 w-full rounded-control border border-ink/40 bg-ivory px-3 py-2 read-only:bg-sand aria-[invalid=true]:border-alert-danger";

// Ref callback: focus an element as soon as it appears.
export const focusOnMount = (el: HTMLElement | null) => el?.focus();

// Focus a control after the next render (e.g. back on the button that opened
// an inline confirmation, which disappeared while the panel was open).
export const focusLater = (ref: { current: HTMLElement | null }) =>
  setTimeout(() => ref.current?.focus(), 0);

// Inline confirmation: takes focus when it opens, Escape cancels (unless a
// request is running). The parent puts focus back on the opener in onCancel.
export function ConfirmPanel({
  label,
  message,
  yesLabel,
  cancelLabel,
  tone = "danger",
  busy,
  disabled,
  onYes,
  onCancel,
}: {
  label: string;
  message: string;
  yesLabel: string;
  cancelLabel: string;
  tone?: "danger" | "neutral";
  busy: boolean;
  disabled?: boolean;
  onYes: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      ref={focusOnMount}
      tabIndex={-1}
      role="alertdialog"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || busy) return;
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
      className={`mt-4 max-w-prose border p-4 outline-none ${
        tone === "danger" ? "border-alert-danger" : "border-cedar"
      }`}
    >
      <p>{message}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onYes}
          disabled={busy || disabled}
          className={tone === "danger" ? dangerButton : primaryButton}
        >
          {yesLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={neutralButton}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

// "Someone else saved this first" (the API answered 409). The wrapper is always
// rendered so the live region announces the message when it appears. What the
// person typed stays untouched until they confirm loading the latest version.
export function ConflictNotice({
  open,
  title,
  text,
  loadLatest,
  loadLatestConfirm,
  loadLatestYes,
  loadingLatest,
  cancel,
  reloading,
  onLoadLatest,
}: {
  open: boolean;
  title: string;
  text: string;
  loadLatest: string;
  loadLatestConfirm: string;
  loadLatestYes: string;
  loadingLatest: string;
  cancel: string;
  reloading: boolean;
  onLoadLatest: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div aria-live="assertive" role="alert" className="empty:hidden">
      {open && (
        <div
          ref={focusOnMount}
          tabIndex={-1}
          className="mb-4 border-s-4 border-alert-danger bg-sand px-4 py-3 outline-none"
        >
          <p className="font-medium text-alert-danger">{title}</p>
          <p className="mt-1">{text}</p>
          {!confirming && (
            <button
              ref={openerRef}
              type="button"
              onClick={() => setConfirming(true)}
              disabled={reloading}
              className={`${outlineButton} mt-3`}
            >
              {loadLatest}
            </button>
          )}
          {confirming && (
            <ConfirmPanel
              label={loadLatest}
              message={loadLatestConfirm}
              yesLabel={reloading ? loadingLatest : loadLatestYes}
              cancelLabel={cancel}
              busy={reloading}
              onYes={async () => {
                await onLoadLatest();
                setConfirming(false);
              }}
              onCancel={() => {
                setConfirming(false);
                focusLater(openerRef);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
