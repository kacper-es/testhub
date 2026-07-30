# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# openssl + libc6-compat wymagane przez silniki Prisma na alpine
RUN apk add --no-cache openssl libc6-compat

# --- deps: instalacja node_modules (postinstall uruchamia `prisma generate`,
#     dlatego prisma/ musi być obecne przed `npm ci`) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- builder: build Next w trybie standalone ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner: minimalny runtime, użytkownik non-root ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma CLI + silniki + schema — potrzebne do `migrate deploy` w entrypoincie
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
