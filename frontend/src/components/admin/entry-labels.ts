"use client";

import { useTranslations } from "next-intl";
import { knownCategory, type EntryKind, type ProjectStatus } from "@/config/entries";

export type CategoryKind = Exclude<EntryKind, "history">;

// Translated names of the kind-specific codes (categories, statuses) and their
// headings, for the admin screens. The wording lives under "Entries" in
// messages/*.json, shared with the public site.
export function useEntryLabels() {
  const t = useTranslations("Entries");

  // An unknown code (should not happen) is shown as it is.
  function category(kind: CategoryKind, code: string): string {
    switch (kind) {
      case "project": {
        const c = knownCategory(kind, code);
        return c ? t(`categories.project.${c}`) : code;
      }
      case "place": {
        const c = knownCategory(kind, code);
        return c ? t(`categories.place.${c}`) : code;
      }
      case "service": {
        const c = knownCategory(kind, code);
        return c ? t(`categories.service.${c}`) : code;
      }
    }
  }

  return {
    category,
    categoryHeading: (kind: CategoryKind) => t(`meta.category.${kind}`),
    status: (code: ProjectStatus) => t(`statuses.${code}`),
    statusHeading: t("meta.status"),
    yearHeading: t("meta.year"),
  };
}
