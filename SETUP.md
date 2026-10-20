# Running your own copy

Needs Node 18+ and a free Cloudflare account.

```
npm install
npm run build
```

## Database

1. Create a D1 database named `hirakata` in Cloudflare and put its ID in `wrangler.toml` (`YOUR_D1_DATABASE_ID`).
2. Apply the tables:

```
npx wrangler d1 migrations apply hirakata --remote
```

## Deploy

```
npx wrangler pages deploy dist --project-name hirakata
```

## Protect your data

Every `/api` route (progress, answers, export) checks a shared secret in the `x-hirakata-key` header. Without one set, the API is open to anyone with the link.

1. Pick a long random string and store it as a Pages secret:

```
npx wrangler pages secret put API_SECRET --project-name hirakata
```

2. Open the app once on each device with `#key=<your secret>` on the end of the URL. The app saves it on that device, removes it from the address bar, and sends it with every request. The fragment never goes to the server.
3. Anything else that reads the API (for example the weekly export) sends the same value in the `x-hirakata-key` header.

For local development, leave `API_SECRET` unset and the API stays open.

## Local run with a local database

```
npx wrangler d1 migrations apply hirakata --local
npx wrangler pages dev dist
```
