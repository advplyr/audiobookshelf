ARG NUSQLITE3_DIR="/usr/local/lib/nusqlite3"
ARG NUSQLITE3_PATH="${NUSQLITE3_DIR}/libnusqlite3.so"

# nunicode-sqlite v1.2 release asset checksums. The release tag is mutable, so
# pin the downloads by SHA256.
ARG NUSQLITE3_MUSL_X64_SHA256="6fdd092b6ba471d9bd1d5c3b01da4ca2bd84f41b03c91ccc0db6d75f1d97e52d"
ARG NUSQLITE3_MUSL_ARM64_SHA256="91e2fc92e473f07c59df9b430e6ff120e1b56cd9a6317e61ea123259669788a7"

### STAGE 0: Build client ###
FROM node:24-alpine AS build-client

WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Compile server on the builder CPU (avoid QEMU SIGILL from tsc on arm64) ###
FROM --platform=$BUILDPLATFORM node:24-alpine AS compile-server

WORKDIR /server
COPY index.js package* tsconfig.server.json /server
COPY /server /server/server
RUN npm ci --include=dev --ignore-scripts && npm run build:server

### STAGE 2: Install native server deps for the target arch ###
FROM node:24-alpine AS build-server

ARG NUSQLITE3_DIR
ARG NUSQLITE3_MUSL_X64_SHA256
ARG NUSQLITE3_MUSL_ARM64_SHA256
ARG TARGETPLATFORM

ENV NODE_ENV=production

RUN apk add --no-cache --update \
  curl \
  make \
  python3 \
  g++ \
  unzip

WORKDIR /server
COPY index.js package* /server
COPY /server /server/server
COPY --from=compile-server /server/dist-server /server/dist-server

RUN case "$TARGETPLATFORM" in \
  "linux/amd64") \
  curl --fail --retry 3 -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-x64.zip" && \
  echo "${NUSQLITE3_MUSL_X64_SHA256}  /tmp/library.zip" | sha256sum -c - ;; \
  "linux/arm64") \
  curl --fail --retry 3 -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-arm64.zip" && \
  echo "${NUSQLITE3_MUSL_ARM64_SHA256}  /tmp/library.zip" | sha256sum -c - ;; \
  *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
  esac && \
  unzip /tmp/library.zip -d $NUSQLITE3_DIR && \
  rm /tmp/library.zip

RUN npm ci --omit=dev

### STAGE 3: Create minimal runtime image ###
FROM node:24-alpine

ARG NUSQLITE3_DIR
ARG NUSQLITE3_PATH

# Install only runtime dependencies
RUN apk add --no-cache --update \
  tzdata \
  ffmpeg \
  tini

WORKDIR /app

# Copy compiled frontend and server from build stages
COPY --from=build-client /client/dist /app/client/dist
COPY --from=build-server /server /app
COPY --from=build-server ${NUSQLITE3_PATH} ${NUSQLITE3_PATH}

EXPOSE 80

ENV PORT=80
ENV NODE_ENV=production
ENV CONFIG_PATH="/config"
ENV METADATA_PATH="/metadata"
ENV SOURCE="docker"
ENV NUSQLITE3_DIR=${NUSQLITE3_DIR}
ENV NUSQLITE3_PATH=${NUSQLITE3_PATH}

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist-server/index.js"]
