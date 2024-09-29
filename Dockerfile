### STAGE 0: Build client ###
FROM node:20-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM node:20-alpine

ENV NODE_ENV=production

RUN apk update && \
  apk add --no-cache --update \
  curl \
  tzdata \
  ffmpeg \
  make \
  gcompat \
  python3 \
  g++ \
  tini \
  unzip

COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server

ARG TARGETPLATFORM

ENV NUSQLITE3_DIR="/usr/local/lib/nusqlite3"
ENV NUSQLITE3_PATH="${NUSQLITE3_DIR}/libnusqlite3.so"

RUN case "$TARGETPLATFORM" in \
  "linux/amd64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.0/libnusqlite3-linux-x64.zip" ;; \
  "linux/arm64") \
  curl -L -o /tmp/library.zip "https://github.com/mikiher/nunicode-sqlite/releases/download/v1.0/libnusqlite3-linux-arm64.zip" ;; \
  *) echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
  esac && \
  unzip /tmp/library.zip -d $NUSQLITE3_DIR && \
  rm /tmp/library.zip

RUN npm ci --only=production

RUN apk del make python3 g++

EXPOSE 80

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
