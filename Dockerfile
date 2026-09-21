# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - install full dependencies (including dev) for the build.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2 - compile TypeScript to dist/.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 - production dependencies only.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 4 - minimal runtime image.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

# `tini` is PID 1 so SIGTERM reaches Node and graceful shutdown actually runs.
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# SQL migrations are data, not compiled output, so they are copied separately.
COPY --chown=node:node src/infrastructure/postgres/migrations ./dist/infrastructure/postgres/migrations

# `node` is an unprivileged user that already exists in the base image.
USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
# Override with `node dist/workers/main.js` to run a worker replica from the
# same image.
CMD ["node", "dist/app/main.js"]
