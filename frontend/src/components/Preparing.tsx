import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

// Calm "this content is being prepared" notice in the site's panel style: for
// a page that is missing or unpublished, or an empty council. Not an error.
export function Preparing({ style }: { style?: CSSProperties }) {
  const t = useTranslations("Pages");
  return (
    <div
      role="status"
      className="panel"
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620, ...style }}
    >
      <span className="label ph">{t("preparingTitle")}</span>
      <p className="lead">{t("preparingText")}</p>
    </div>
  );
}
