# syntax=docker/dockerfile:1.7
# Pinned alpine for reproducibility. Update by bumping the tag.
FROM node:20.18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,id=sentinelnav-frontend-npm,target=/root/.npm \
    npm ci --no-audit --no-fund


FROM node:20.18-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


# Standalone runtime — only the trace-resolved server bundle ships.
# No npm, no devDependencies, no full node_modules tree.
FROM node:20.18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user (alpine has nodejs/node group already; reuse them).
RUN addgroup --system --gid 1001 nextjs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Liveness probe. Honors Railway's $PORT (defaults to the value of
# the ENV PORT directive above when not overridden).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "const p=process.env.PORT||3000;require('http').get('http://127.0.0.1:'+p+'/',r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
