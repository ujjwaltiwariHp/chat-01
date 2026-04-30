# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /usr/src/app
RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @hp-intelligence/core build
RUN pnpm --filter @hp-intelligence/chatbot-ai build

RUN pnpm --filter @hp-intelligence/chatbot-ai --prod deploy /usr/src/app/out --legacy

# Stage 2: Runtime
FROM node:24-slim AS runner

WORKDIR /usr/src/app
RUN groupadd -r nodejs && useradd -r -g nodejs nodeuser

COPY --from=builder /usr/src/app/out ./
COPY --from=builder /usr/src/app/services/hp-chatbot-ai/dist ./dist

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4001/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

ENV NODE_ENV=production
ENV PORT=4001
USER nodeuser

CMD ["node", "dist/server.js"]
