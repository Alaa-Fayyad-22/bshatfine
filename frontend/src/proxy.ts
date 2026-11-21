import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { entryExists, newsExists } from "./lib/api";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
// It redirects "/" and any path without a locale to /ar/... (default locale).
const intl = createMiddleware(routing);

const ARTICLE_PATH = /^\/(ar|en)\/news\/([^/]+)\/?$/;
const ENTRY_PATH = /^\/(ar|en)\/entries\/([^/]+)\/?$/;

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null; // malformed %-escape: can never be a real article or entry
  }
}

export default async function proxy(request: NextRequest) {
  // An unknown article slug or entry id (or an unpublished entry) must answer
  // with a real 404. The page cannot set that status itself (see newsExists),
  // so check here, before rendering, and rewrite to a path that only the
  // catch-all route matches: it calls notFound() and renders the localized
  // not-found page with a 404 status.
  const { pathname } = request.nextUrl;
  const article = ARTICLE_PATH.exec(pathname);
  const entry = article ? null : ENTRY_PATH.exec(pathname);
  const match = article ?? entry;
  if (match) {
    const key = safeDecode(match[2]);
    const exists =
      key === null
        ? false
        : article
          ? await newsExists(match[1], key)
          : await entryExists(match[1], key);
    if (exists === false) {
      const url = request.nextUrl.clone();
      url.pathname = `/${match[1]}/not-found-${article ? "article" : "entry"}`;
      return NextResponse.rewrite(url);
    }
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts...)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
