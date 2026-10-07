FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
# Maintenance and demo scripts (scripts/seed-demo-plants.js and friends) — they
# import from ./src, so they have to ship with it to be runnable in the
# container with `docker compose exec backend node scripts/...`.
COPY scripts ./scripts

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
