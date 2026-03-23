FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN bun install

FROM oven/bun:1-alpine AS builder
WORKDIR /app
ARG APP_SITE_URL
ARG BETTER_AUTH_SECRET
ARG AI_SERVICE_URL
ARG ALLOWED_ORIGINS
ARG DATABASE_HOST
ARG DATABASE_PORT
ARG DATABASE_NAME
ARG DATABASE_USER
ARG DATABASE_PASSWORD
ENV APP_SITE_URL=${APP_SITE_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV AI_SERVICE_URL=${AI_SERVICE_URL}
ENV ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
ENV DATABASE_HOST=${DATABASE_HOST}
ENV DATABASE_PORT=${DATABASE_PORT}
ENV DATABASE_NAME=${DATABASE_NAME}
ENV DATABASE_USER=${DATABASE_USER}
ENV DATABASE_PASSWORD=${DATABASE_PASSWORD}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
