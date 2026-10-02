# SalesVerse 2.0 API image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t salesverse-api .

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install -g npm@11.21.0 && npm ci --workspace apps/api --include-workspace-root=false

FROM deps AS build
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npx nest build && npx tsc -p tsconfig.seed.json

# One-off job that applies database migrations and reference data before a release.
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && node --import @swc-node/register/esm-register prisma/seed.ts"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/* \
  && groupadd --system salesverse && useradd --system --gid salesverse --home /app salesverse
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install -g npm@11.21.0 && npm ci --workspace apps/api --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
# Compiled seeds, schema and migrations so a release can run
# `npx prisma migrate deploy && node dist-seed/prisma/seed.js` from this image.
COPY --from=build /app/apps/api/dist-seed apps/api/dist-seed
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma/migrations apps/api/prisma/migrations
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN mkdir -p /data/documents && chown -R salesverse:salesverse /data
USER salesverse
WORKDIR /app/apps/api
ENV DOCUMENT_STORAGE_PATH=/data/documents PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
