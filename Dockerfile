### STAGE 0: Build client ###
FROM node:16-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm install
RUN npm run generate

### STAGE 1: Build server ###
FROM node:16-alpine
RUN apk update && apk add --no-cache --update ffmpeg
ENV NODE_ENV=production
COPY --from=build /client/dist /client/dist
COPY index.js index.js
COPY package-lock.json package-lock.json
COPY package.json package.json
COPY server server
RUN npm ci --production
EXPOSE 80
CMD ["npm", "start"]
