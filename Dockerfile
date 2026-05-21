# ── Build stage: compile native deps ─────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app

# Copy node_modules with compiled binaries
COPY --from=deps /build/node_modules ./backend/node_modules

# Copy backend source
COPY backend/ ./backend/

# Copy static files into public/ (Express serves ../public relative to backend/)
COPY public/          ./public/
COPY index.html style.css main.js ./public/

# Writable data directory for SQLite
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

EXPOSE 3000
USER node
WORKDIR /app/backend
CMD ["node", "server.js"]
