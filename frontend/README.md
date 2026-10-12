# Bshatfine Municipality, frontend

Next.js app (App Router, Cache Components, next-intl for Arabic and English).

## Environment variables

Set these in `frontend/.env.local` (git-ignored):

| Variable | Used by | Purpose |
| --- | --- | --- |
| `API_URL` | server code (`src/lib/api.ts`, public pages) | Backend base URL for server-side fetches. Never sent to the browser. |
| `NEXT_PUBLIC_API_URL` | browser code (`src/lib/admin-api.ts`, admin forms) | Backend base URL for requests made from the browser. |

```
API_URL=http://localhost:5246
NEXT_PUBLIC_API_URL=http://localhost:5246
```

Why two variables: the admin forms create, edit, publish and archive news from
client components, so those requests run in the visitor's browser. Next.js only
exposes variables prefixed with `NEXT_PUBLIC_` to browser code (the value is
inlined at build time, so rebuild after changing it). Plain `API_URL` stays
server-only. The backend must allow the frontend origin via CORS
(`http://localhost:3000` in development).

## Scripts

```
npm run dev     # development server
npm run lint
npm run build
npm start
```

The admin area is at `/ar/admin` and `/en/admin` (not linked from the public site).
