# SalesVerse 2.0 web image (static SPA on nginx). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t salesverse-web .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install -g npm@11.21.0 && npm ci --workspace apps/web --include-workspace-root=false
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM nginxinc/nginx-unprivileged:1.29-alpine
# The API host is a variable so the same image serves Docker Compose (api:3000)
# and platforms with their own service DNS, e.g. api.railway.internal:3000.
ENV API_UPSTREAM=api:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/nginx/10-resolver.envsh /docker-entrypoint.d/10-resolver.envsh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
