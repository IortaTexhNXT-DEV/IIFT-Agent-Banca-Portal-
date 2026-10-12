# Hosting SalesVerse 2.0 on Railway

The same images used for Docker Compose run on Railway. One project holds five
services on the private network; only `web` has a public domain.

| Service | Source | Notes |
|---|---|---|
| `Postgres` | Railway PostgreSQL template | `DATABASE_URL` is referenced by the API |
| `clamav` | `deploy/clamav/Dockerfile` | clamd on port 3310, both IP families |
| `api` | `apps/api/Dockerfile` (root directory `/`) | pre-deploy: migrations and seeds; volume at `/data/documents` |
| `web` | `apps/web/Dockerfile` (root directory `/`) | `API_UPSTREAM=api.railway.internal:3000`; public domain |

## API service

Pre-deploy command (runs from the production image before each release):

```
node /app/node_modules/prisma/build/index.js migrate deploy && node dist-seed/prisma/seed.js
```

The Prisma CLI is called through `node` because `npx` is not available in the
runtime image.

Add `&& node dist-seed/prisma/seed-demo.js` with `ALLOW_DEMO_DATA=true` and
`DEMO_PASSWORD` for a demonstration environment only.

Variables: `NODE_ENV=production`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
`TRUST_PROXY_HOPS=2` (Railway edge and the web tier), `SESSION_COOKIE_SECURE=true`,
`API_DOCS_ENABLED=false`, `CLAMAV_HOST=clamav.railway.internal`,
`PUBLIC_BASE_URL=https://<web domain>`, `SEED_ADMIN_PASSWORD`, `SESSION_SECRET`,
`FIELD_ENCRYPTION_KEY`, `FIELD_HASH_KEY`, `DOCUMENT_ENCRYPTION_KEY`,
`INBOUND_API_KEY_SHA256`, `INTEGRATION_MODE=simulated` until IIFT endpoints exist.
`RAILWAY_RUN_UID=0` is required because Railway mounts volumes as root and the
image runs as a non-root user.

Health check path: `/health/ready`.

## Web service

`API_UPSTREAM=api.railway.internal:3000`. The nginx entrypoint reads the
container's name server for `DNS_RESOLVER`, so the API address is looked up at
request time and survives API redeploys. The browser only ever talks to the web
domain: `/api` is proxied over the private network, so no CORS configuration is
needed and the session cookie stays first-party.

## Custom domain

The public address is `https://www.salesverse.cloud`; the generated Railway
address stays as a fallback. The zone is hosted at the registrar (GoDaddy),
which cannot hold a CNAME at the apex, so the bare domain is forwarded:

| Host | Type | Value |
| --- | --- | --- |
| `www` | CNAME | `5euymbsw.up.railway.app` |
| `_railway-verify` | TXT | `railway-verify=897aa97a69bfacff73403555edc7e094648c20f7d10869e6faf3db251bffb23d` |
| `_railway-verify.www` | TXT | `railway-verify=628140cc3657b81aa6b6568ad8f3d10a60d5e28d1f38385ef4cc0aa71adc3d59` |
| `salesverse.cloud` | Registrar forwarding, 301 | `https://www.salesverse.cloud` |

Railway issues and renews the certificate for `www`. To serve the bare domain
directly instead, move the zone to a DNS provider with CNAME flattening
(Cloudflare with the proxy switched off) and point the apex at
`yljhjyj1.up.railway.app`. The API's `PUBLIC_BASE_URL` is
`https://www.salesverse.cloud`, so e-signature links e-mailed to participants
use the custom domain.

## Keys

```
openssl rand -hex 32      # SESSION_SECRET
openssl rand -base64 32   # FIELD_ENCRYPTION_KEY, FIELD_HASH_KEY, DOCUMENT_ENCRYPTION_KEY
printf '%s' "<inbound api key>" | sha256sum   # INBOUND_API_KEY_SHA256
```

Keep the keys in a vault; rotating the encryption keys requires re-encryption.
