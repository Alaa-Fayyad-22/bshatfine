import { notFound } from "next/navigation";

// Any unknown URL under /ar or /en lands here and shows the localized 404.
// (Real pages like /ar/news are more specific, so they win over this one.)
export default function CatchAll() {
  notFound();
}
