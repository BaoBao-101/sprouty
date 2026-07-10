FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
