import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { newsExists } from "./lib/api";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
// It redirects "/" and any path without a locale to /ar/... (default locale).
const intl = createMiddleware(routing);

const ARTICLE_PATH = /^\/(ar|en)\/news\/([^/]+)\/?$/;

export default async function proxy(request: NextRequest) {
  // An unknown article slug must answer with a real 404. The page cannot set
  // that status itself (see newsExists), so check here, before rendering, and
  // rewrite to a path that only the catch-all route matches: it calls notFound()
  // and renders the localized not-found page with a 404 status.
  const match = ARTICLE_PATH.exec(request.nextUrl.pathname);
  if (match && (await newsExists(match[1], decodeURIComponent(match[2]))) === false) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1]}/not-found-article`;
    return NextResponse.rewrite(url);
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts...)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
