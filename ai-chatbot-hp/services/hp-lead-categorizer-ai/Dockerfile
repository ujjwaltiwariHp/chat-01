# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /usr/src/app
RUN npm install -g pnpm

# Copy ALL workspace files for deployment
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

# Install and Build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @hp-intelligence/core build
RUN pnpm --filter @hp-intelligence/lead-categorizer-ai build

# Deploy to standalone folder
RUN pnpm --filter @hp-intelligence/lead-categorizer-ai --prod deploy /usr/src/app/out --legacy

# Stage 2: Runtime
FROM node:24-slim AS runner

WORKDIR /usr/src/app
RUN groupadd -r nodejs && useradd -r -g nodejs nodeuser

# Copy ONLY the deployed bundle (includes own node_modules)
COPY --from=builder /usr/src/app/out ./

# Copy built dist files into the out structure
COPY --from=builder /usr/src/app/services/hp-lead-categorizer-ai/dist ./dist

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4002/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

ENV NODE_ENV=production
ENV PORT=4002
USER nodeuser

# Run from the local dist folder
CMD ["node", "dist/server.js"]
