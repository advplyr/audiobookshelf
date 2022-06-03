### STAGE 0: Build client ###
FROM node:16-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM node:16-alpine
ENV NODE_ENV=production
RUN apk update && \
    apk add --no-cache --update \
    curl \
    tzdata \
    ffmpeg

COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server

RUN npm ci --only=production

EXPOSE 80
HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    CMD curl -f http://127.0.0.1/ping || exit 1
CMD ["npm", "start"]
