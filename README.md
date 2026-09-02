```txt
npm install
npm run dev
```

```txt
npm run deploy
```

Set `115_COOKIE` and `115_CID_LIST` as Worker secrets/variables. `115_CID_LIST` accepts the list format shown in `.env.example` or comma-separated folder CIDs. For local Wrangler development, copy `.env.example` to `.dev.vars` and fill in the real values.

`GET /pic` recursively searches the configured 115 folders, chooses a random picture, and streams it back. The endpoint returns only image bytes; it does not expose the 115 cookie or download URL.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
