FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

RUN npm run build

CMD ["npm","start"]
