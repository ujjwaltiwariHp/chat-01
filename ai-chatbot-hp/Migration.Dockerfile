FROM node:24-slim

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

# Copy root config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy ALL packages and services for universal migration access
COPY packages ./packages
COPY services ./services

# Install ALL dependencies (needed for migrations)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# No entrypoint - let compose handle the command
