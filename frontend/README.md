# Bshatfine Municipality, frontend

Next.js app (App Router, Cache Components, next-intl for Arabic and English).

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and adjust:

| Variable | Purpose |
| --- | --- |
| `API_INTERNAL_URL` | Where the Next.js server reaches the API (default `http://localhost:5246`). Server-side fetches use it, and so does the `/api/*` rewrite. Never sent to the browser. |
| `SITE_URL` | Optional. The site's public `https://` address, for absolute share-image links and the `upgrade-insecure-requests` CSP rule. On Vercel it defaults to the production domain. |

### One public origin

The browser never talks to the API host. Browser code (admin forms, sign-in)
calls relative `/api/...` paths, and `next.config.ts` rewrites `/api/*` to
`API_INTERNAL_URL`. So the whole site works behind a single public URL (a
tunnel, Vercel), the session cookie is first-party, there are no cross-origin
requests (CORS is not involved), and response headers such as `Set-Cookie` and
`Retry-After` reach the browser unchanged. Cover and council photos
(`/api/files/...`) are same-origin paths too, also for `next/image`.

Uploads: Next.js buffers a request body before forwarding it and cuts it at
`experimental.proxyClientMaxBodySize`, set to 11 MB to match the API's own limit.

Rate limits: the rewrite does not add `X-Forwarded-For`, but it passes on the
one a tunnel or hosting proxy sets. The API trusts it from loopback by default
(Next.js and the API on one machine); elsewhere, see the backend's
`ReverseProxy` settings.

## Scripts

```
npm run dev     # development server
npm run lint
npm run build
npm start
```

The admin area is at `/ar/admin` and `/en/admin` (not linked from the public site).
