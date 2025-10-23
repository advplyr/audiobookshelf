# globally defining Arguments and Defaults
ARG NUSQLITE3_DIR="/usr/local/lib/nusqlite3"
ARG NUSQLITE3_PATH="${NUSQLITE3_DIR}/libnusqlite3.so"
# default Process user id and group id
ARG PUID=1000
ARG PGID=1000

### STAGE 0: Build client ###
FROM node:20-alpine AS build-client

WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM node:20-alpine AS build-server

ARG NUSQLITE3_DIR
ARG TARGETPLATFORM

ENV NODE_ENV=production

RUN apk add --no-cache --update \
  curl \
  make \
  python3 \
  g++ \
  unzip

WORKDIR /server
COPY index.js package* /server/
COPY /server /server/server

RUN case "$TARGETPLATFORM" in \
  "linux/amd64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-x64.zip" ;; \
  "linux/arm64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-arm64.zip" ;; \
  *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
  esac && \
  unzip /tmp/library.zip -d $NUSQLITE3_DIR && \
  rm /tmp/library.zip

RUN npm ci --only=production

### STAGE 2: Create minimal runtime image ###
FROM node:20-alpine

ARG NUSQLITE3_DIR
ARG NUSQLITE3_PATH
ARG PUID
ARG PGID

# Install only runtime dependencies
RUN apk add --no-cache --update \
  tzdata \
  ffmpeg \
  tini \
  shadow \
  && groupmod -g ${PGID} -n audiobookshelf node\
  && usermod -u ${PUID} -l audiobookshelf -d /home/audiobookshelf -m node \
  && apk del shadow \
  && mkdir -p /config /metadata \
  && chown -R audiobookshelf:audiobookshelf /config /metadata \
  && chmod a=rwx /config /metadata

WORKDIR /app

# Copy compiled frontend and server from build stages
COPY --chmod=755 --from=build-client /client/dist /app/client/dist
COPY --chmod=755 --from=build-server /server /app
COPY --chmod=755 --from=build-server ${NUSQLITE3_PATH} ${NUSQLITE3_PATH}

EXPOSE 80

ENV PORT=80
ENV NODE_ENV=production
ENV CONFIG_PATH="/config"
ENV METADATA_PATH="/metadata"
ENV SOURCE="docker"
ENV NUSQLITE3_DIR=${NUSQLITE3_DIR}
ENV NUSQLITE3_PATH=${NUSQLITE3_PATH}

USER audiobookshelf
ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
