### STAGE 0: Build client ###
FROM node:12-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm install
RUN npm run generate

### STAGE 1: Build server ###
FROM node:12-alpine
RUN apk update && apk add --no-cache --update ffmpeg
ENV NODE_ENV=production
COPY --from=build /client/dist /client/dist
COPY index.js index.js
COPY package.json package.json
COPY server server
RUN npm install --production
EXPOSE 80
CMD ["npm", "start"]
