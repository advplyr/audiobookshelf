### STAGE 0: Build client ###
FROM node:20-alpine AS build-client
WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM node:20-alpine AS build-server

ENV NODE_ENV=production

RUN apk update && \
  apk add --no-cache --update \
  curl \
  tzdata \
  ffmpeg \
  make \
  python3 \
  g++ \
  tini \
  unzip

WORKDIR /server
COPY index.js package* /server
COPY /server /server/server

ARG TARGETPLATFORM

ENV NUSQLITE3_DIR="/usr/local/lib/nusqlite3"
ENV NUSQLITE3_PATH="${NUSQLITE3_DIR}/libnusqlite3.so"

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

# Install only runtime dependencies
RUN apk add --no-cache \
  tzdata \
  ffmpeg \
  tini

WORKDIR /app

# Copy compiled frontend and server from build stages
COPY --from=build-client /client/dist /app/client/dist
COPY --from=build-server /server /app

EXPOSE 80

ENV PORT=80
ENV CONFIG_PATH="/config"
ENV METADATA_PATH="/metadata"
ENV SOURCE="docker"

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
