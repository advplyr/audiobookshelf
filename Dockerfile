### STAGE 0: Build client ###
FROM node:16-alpine AS build
WORKDIR /client

COPY /client/package*.json /client/
RUN npm ci && npm cache clean --force

COPY /client /client
RUN npm run build

### STAGE 1: Build server ###
FROM sandreas/tone:v0.1.5 AS tone
FROM node:16-alpine

WORKDIR /app

ENV NODE_ENV=production
RUN apk update && \
    apk add --no-cache --update \
    curl \
    tzdata \
    ffmpeg

COPY --from=tone /usr/local/bin/tone /usr/local/bin/
COPY package* ./

RUN npm ci --omit=dev

COPY index.js package* ./
COPY server server
COPY --from=build /client/.output ./client/.output

EXPOSE 80
HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    CMD curl -f http://127.0.0.1/healthcheck || exit 1
CMD ["node", "index.js"]
