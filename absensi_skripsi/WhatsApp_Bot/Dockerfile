FROM ghcr.io/puppeteer/puppeteer:24.38.0

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

USER root
WORKDIR /app
RUN mkdir -p /data

COPY package*.json ./
RUN npm ci --omit=dev \
    && npx puppeteer browsers install chrome

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
