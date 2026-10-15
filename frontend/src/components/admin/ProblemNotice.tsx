"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Problem } from "@/lib/problem";

const box = "border-s-4 border-alert-danger bg-sand px-4 py-3 text-alert-danger";

// "Too many requests, try again in N seconds", counting down. Screen readers get
// the starting sentence once (the live region is announced when it appears); the
// ticking number is for the eyes only, so it does not chatter every second.
function RateNotice({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const t = useTranslations("Admin.errors");
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        done.current();
      } else {
        setLeft(remaining);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);

  return (
    <p role="alert" className={box}>
      <span className="sr-only">
        {t("errorLabel")}: {t("rateLimited", { seconds })}
      </span>
      <span aria-hidden>{t("rateLimited", { seconds: left })}</span>
    </p>
  );
}

// One place that turns a failed action into text. `onRateDone` runs when a
// rate-limit countdown ends: the parent clears the problem and re-enables its
// buttons.
export function ProblemNotice({
  problem,
  onRateDone,
}: {
  problem: Problem | null;
  onRateDone: () => void;
}) {
  const t = useTranslations("Admin.errors");
  if (!problem) return null;
  if (problem.kind === "rate") {
    return <RateNotice key={problem.nonce} seconds={problem.seconds} onDone={onRateDone} />;
  }
  const text =
    problem.kind === "detail"
      ? problem.text
      : problem.kind === "api"
        ? t("apiError", { status: problem.status })
        : t("networkError");
  return (
    <p role="alert" className={box}>
      <span className="sr-only">{t("errorLabel")}: </span>
      {text}
    </p>
  );
}

export function isRateLimited(problem: Problem | null): boolean {
  return problem?.kind === "rate";
}
