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
    tini

COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server

RUN npm ci --only=production

RUN apk del make python3 g++

EXPOSE 80

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
