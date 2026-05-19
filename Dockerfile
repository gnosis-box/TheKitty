# syntax=docker/dockerfile:1.7

# ── builder ──────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

# Lockfile-first install for layer caching.
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# Source + build.
COPY apps ./apps
ENV NODE_ENV=production
RUN bun run --filter @potcommun/web build

# ── runtime (Caddy serves the SPA + sets CSP + SPA fallback) ─────────────────
FROM caddy:2-alpine AS runtime
WORKDIR /srv
COPY --from=builder /app/apps/web/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

# Coolify's reverse proxy injects PORT; Caddy listens on it (default 80).
ENV PORT=80
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
