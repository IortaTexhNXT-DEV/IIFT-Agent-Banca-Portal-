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
npx prisma migrate deploy && node dist-seed/prisma/seed.js
```

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

## Keys

```
openssl rand -hex 32      # SESSION_SECRET
openssl rand -base64 32   # FIELD_ENCRYPTION_KEY, FIELD_HASH_KEY, DOCUMENT_ENCRYPTION_KEY
printf '%s' "<inbound api key>" | sha256sum   # INBOUND_API_KEY_SHA256
```

Keep the keys in a vault; rotating the encryption keys requires re-encryption.
