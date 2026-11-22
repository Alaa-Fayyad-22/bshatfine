import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { entryExists, newsExists } from "./lib/api";
import {
  API_INTERNAL_URL,
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  proxySecret,
} from "./lib/api-upstream";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
// It forwards /api/* to the API, and redirects "/" and any path without a
// locale to /ar/... (default locale).
const intl = createMiddleware(routing);

// Vercel refuses request bodies over 4.5 MB, so nothing larger may pass here
// either (same answer everywhere, not only on Vercel). The admin forms shrink
// photos to at most 4 MB before sending (src/lib/prepare-image.ts), which
// leaves room for the multipart wrapper. Next.js buffers at most
// experimental.proxyClientMaxBodySize (next.config.ts) of a body for this
// proxy, so that must stay above this limit.
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

const tooLarge = () =>
  NextResponse.json(
    {
      title: "Payload Too Large",
      status: 413,
      detail: "The file is too large. The maximum is 4 MB.",
    },
    { status: 413, headers: { "Content-Type": "application/problem+json" } },
  );

// The visitor's IP, only where it can be trusted: Vercel sets x-real-ip and
// x-forwarded-for itself (overwriting whatever the visitor sent). Anywhere
// else (local dev, next start) those headers come from the visitor, so none is
// given and the API counts the request by its connection.
function visitorIp(request: NextRequest): string | null {
  if (process.env.VERCEL !== "1") return null;
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || null;
}

// The browser only talks to this site's origin; /api/* goes on to the API
// with the same method, body, cookies and query, and the API's answer
// (Set-Cookie, Retry-After, Cache-Control...) comes back unchanged.
function forwardToApi(request: NextRequest) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return tooLarge();

  const headers = new Headers(request.headers);
  // Only this proxy may set these: drop whatever the visitor sent.
  headers.delete(PROXY_SECRET_HEADER);
  headers.delete(CLIENT_IP_HEADER);

  const secret = proxySecret();
  if (secret) headers.set(PROXY_SECRET_HEADER, secret);
  const ip = visitorIp(request);
  if (ip) headers.set(CLIENT_IP_HEADER, ip);

  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(`${API_INTERNAL_URL}${pathname}${search}`, {
    request: { headers },
  });
}

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
  if (request.nextUrl.pathname.startsWith("/api/")) return forwardToApi(request);

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
  matcher: [
    // Everything under /api/ (files with an extension too: /api/files/x.jpg).
    "/api/:path+",
    // Pages: skip /api, Next internals and files with an extension (images, fonts...)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
