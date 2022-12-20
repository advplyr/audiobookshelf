### STAGE 0: Get deps ###
FROM --platform=${TARGETPLATFORM} node:16-alpine AS deps

WORKDIR /client

COPY /client/package* ./

RUN npm ci

### STAGE 1: Build client ###
FROM --platform=${TARGETPLATFORM} node:16-alpine AS build

WORKDIR /client

COPY /client /client

COPY --from=deps /client/node_modules /client/node_modules

RUN npm run generate

### STAGE 2: Build server ###
FROM --platform=${TARGETPLATFORM} ghcr.io/linuxserver/baseimage-alpine:3.15 AS runner

ENV NODE_ENV=production \
    TZ="Etc/UTC"

COPY --from=sandreas/tone:v0.1.2 /usr/local/bin/tone /usr/local/bin/
COPY --from=build /client/dist /app/audiobookshelf/client/dist

COPY index.js package* readme.md LICENSE Dockerfile /app/audiobookshelf/
COPY server /app/audiobookshelf/server

RUN \ 
    apk add --upgrade --no-cache \
        ffmpeg \
        nodejs \
        npm && \
        cd app/audiobookshelf && \
        npm ci --omit-dev

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    CMD curl -f http://127.0.0.1/healthcheck || exit 1

# copy local files
COPY root/ /

# ports and volumes
EXPOSE 80
VOLUME /config /metadata
