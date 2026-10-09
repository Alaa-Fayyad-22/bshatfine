import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
// It redirects "/" and any path without a locale to /ar/... (default locale).
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension (images, fonts...)
  matcher: ["/((?!api|_next|_vercel|.*\..*).*)"],
};
