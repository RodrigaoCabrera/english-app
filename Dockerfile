# syntax=docker/dockerfile:1

# ─── Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# postgres-js connects lazily, so a placeholder URL is enough to satisfy the
# db client import during "next build" (no real connection is opened).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─── Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output bundles only the files needed to run the server.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Writable cache dir for generated word images (mount a volume here).
RUN mkdir -p ./public/cache/img && chown -R nextjs:nodejs ./public/cache

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
