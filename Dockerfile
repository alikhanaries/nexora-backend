# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - install production dependencies.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2 - minimal runtime image.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

# `tini` is PID 1 so SIGTERM reaches Node and graceful shutdown actually runs.
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
# Override with `node src/workers/main.js` to run a worker replica from the
# same image.
CMD ["node", "src/app/main.js"]
