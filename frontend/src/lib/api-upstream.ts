// Server-only: how this site's SERVER reaches the API. Used by the proxy (which
// forwards the browser's /api/* requests) and by ./api.ts (server components).
// Nothing here may be imported by client components: API_PROXY_SECRET must
// never reach a browser bundle, a response or a log.

// The API as the Next.js server reaches it (never sent to the browser).
// No trailing slash.
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://localhost:5246").replace(
  /\/+$/,
  "",
);

// Must match backend Security/TrustedProxy.cs.
export const PROXY_SECRET_HEADER = "x-bsh-proxy-secret";
export const CLIENT_IP_HEADER = "x-bsh-client-ip";

// The shared secret proving to the API that a request came through this site
// (same value as ReverseProxy__SharedSecret on the API). Optional locally.
export function proxySecret(): string | undefined {
  return process.env.API_PROXY_SECRET || undefined;
}

// Headers for the server's own fetches to the API (server components, the
// proxy's existence checks). They carry no visitor IP: the API counts them as
// coming from this server.
export function upstreamHeaders(): HeadersInit | undefined {
  const secret = proxySecret();
  return secret ? { [PROXY_SECRET_HEADER]: secret } : undefined;
}
