FROM node:20-slim AS builder
WORKDIR /app
# build tools only needed if a native module has no prebuilt binary
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
# Mount durable storage at /data (SQLite database + avatars live here)
ENV DATA_DIR=/data
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
