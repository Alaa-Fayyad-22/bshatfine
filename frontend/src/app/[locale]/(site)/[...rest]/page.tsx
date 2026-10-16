import { notFound } from "next/navigation";

// Any unknown URL under /ar or /en lands here and shows the localized 404.
// (Real pages like /ar/news are more specific, so they win over this one.)
// This page never renders content, so there is no instant UI for the dev-time
// instant-navigation check to validate (it would log an error on every 404).
export const instant = false;

export default function CatchAll() {
  notFound();
}
