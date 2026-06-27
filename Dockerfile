FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
COPY start.js /start.js

EXPOSE 7000

CMD ["node", "/start.js"]
