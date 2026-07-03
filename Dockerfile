# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
# The app now has a backend (Gemini proxy), so we run Node instead of nginx.
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Production deps only (express, dotenv).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Built SPA + server.
COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 8080

# GEMINI_API_KEY must be provided at runtime (e.g. Cloud Run secret), never baked in.
CMD ["node", "server/index.mjs"]
