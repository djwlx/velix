```txt
npm install
npm run dev
```

```txt
npm run deploy
```

Set `COOKIE_115` and `CID_LIST_115` as Worker secrets/variables. `CID_LIST_115` accepts the list format shown in `.env.example` or comma-separated folder CIDs. For local Wrangler development, copy `.env.example` to `.dev.vars` and fill in the real values.

`GET /pic` recursively searches the configured 115 folders, chooses a random picture, and streams it back. The endpoint returns only image bytes; it does not expose the 115 cookie or download URL.

## Deploy to Vercel

The same `src/index.ts` app is also a valid Vercel Hono entry: Vercel detects the default export and runs every route as a Vercel Function, so no adapter or extra entrypoint file is needed.

1. Push this repository to GitHub/GitLab/Bitbucket and import it at [vercel.com/new](https://vercel.com/new). Vercel auto-detects the project (framework: Hono); no build/output overrides are required.
2. Add the environment variables in the Vercel project dashboard (**Settings → Environment Variables**), same names/values as the Cloudflare secrets:

   - `COOKIE_115` — the 115 account cookie used by the SDK.
   - `CID_LIST_115` — the same JSON-array or comma-separated folder CID list from `.env.example`.

3. Deploy and visit `https://<your-project>.vercel.app/` and `https://<your-project>.vercel.app/pic`.

The route table stays identical to Cloudflare Workers (`GET /` and `GET /pic`), so you can run both platforms side by side. The code reads configuration through Hono's runtime-agnostic `env()` helper: bindings on Cloudflare, `process.env` on Vercel.

To preview locally with Vercel's runtime:

```txt
npm i -g vercel
vercel link
vercel pull
vercel dev
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
