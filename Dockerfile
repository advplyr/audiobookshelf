### STAGE 0: Build client ###
FROM node:16-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM sandreas/tone:v0.1.5 AS tone
FROM node:16-alpine

ENV NODE_ENV=production

RUN apk update && \
    apk add --no-cache --update \
    curl \
    tzdata \
    ffmpeg \
    make \
    python3 \
    g++

COPY --from=tone /usr/local/bin/tone /usr/local/bin/
COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server

RUN npm ci --only=production

RUN apk del make python3 g++

EXPOSE 13378

CMD ["node", "index.js"]
