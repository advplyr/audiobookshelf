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
    bash \
    jq \
    shadow \
    su-exec \
    dumb-init && \
    usermod --shell /bin/bash node && \
    rm -rf /var/cache/apk/*

COPY --from=tone /usr/local/bin/tone /usr/local/bin/
COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server
COPY --chmod=755 entrypoint.sh /entrypoint.sh

RUN npm ci --only=production

ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["node", "index.js"]

EXPOSE 80