FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma

RUN --mount=type=cache,target=/root/.npm npm ci && npx prisma generate

COPY . .

RUN npm run build

# Workers override this command and must not run migrations.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
