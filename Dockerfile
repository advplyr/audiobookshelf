ARG NUSQLITE3_DIR="/usr/local/lib/nusqlite3"
ARG NUSQLITE3_PATH="${NUSQLITE3_DIR}/libnusqlite3.so"

### STAGE 0: Build the Vue client. It is what the server serves unless REACT_CLIENT_PATH is set. ###
FROM node:24-alpine AS build-client

WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Fetch the pinned React client runtime so an operator can point REACT_CLIENT_PATH at it. ###
FROM --platform=$BUILDPLATFORM node:24-alpine AS fetch-client

WORKDIR /fetch
COPY package.json /fetch/package.json
COPY scripts/fetch-client-react-runtime.js /fetch/scripts/fetch-client-react-runtime.js
RUN node scripts/fetch-client-react-runtime.js --out /out/client-react

### STAGE 2: Compile server on the builder CPU (avoid QEMU SIGILL from tsc on arm64) ###
FROM --platform=$BUILDPLATFORM node:24-alpine AS compile-server

WORKDIR /server
COPY index.js package* tsconfig.server.json /server
COPY /server /server/server
RUN npm ci --include=dev --ignore-scripts && npm run build:server

### STAGE 3: Install native server deps for the target arch ###
FROM node:24-alpine AS build-server

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
COPY index.js package* /server
COPY /server /server/server
COPY --from=compile-server /server/dist-server /server/dist-server

RUN case "$TARGETPLATFORM" in \
  "linux/amd64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-x64.zip" ;; \
  "linux/arm64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.2/libnusqlite3-linux-musl-arm64.zip" ;; \
  *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
  esac && \
  unzip /tmp/library.zip -d $NUSQLITE3_DIR && \
  rm /tmp/library.zip

RUN npm ci --omit=dev

### STAGE 4: Create minimal runtime image ###
FROM node:24-alpine

ARG NUSQLITE3_DIR
ARG NUSQLITE3_PATH

# Install only runtime dependencies
RUN apk add --no-cache --update \
  tzdata \
  ffmpeg \
  tini

WORKDIR /app

# Vue client is served by default. client-react is unused until REACT_CLIENT_PATH points at it.
# .next must be writable: startup rewrites the base-path placeholder and Next writes its cache there.
COPY --from=build-client /client/dist /app/client/dist
COPY --from=fetch-client /out/client-react /app/client-react
RUN chmod -R a+rwX /app/client-react/.next
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
