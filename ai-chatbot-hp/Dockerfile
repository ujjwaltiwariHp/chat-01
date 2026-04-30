# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

# Install all dependencies and build
RUN pnpm install
RUN pnpm build:all

# Stage 2: Runtime
FROM node:24-slim AS runner

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Copy built files from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/packages ./packages
COPY --from=builder /usr/src/app/services ./services

ENV NODE_ENV=production

# Metadata labels
LABEL project="hp-intelligence"

EXPOSE 4000 4001 4002 4010

# Note: CMD should be specified in docker-compose.yml to run specific workspace services
