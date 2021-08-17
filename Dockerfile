### STAGE 0: FFMPEG ###
FROM jrottenberg/ffmpeg:4.1-alpine AS ffmpeg
# FROM alfg/ffmpeg AS ffmpeg

### STAGE 1: Build client ###
FROM node:12-alpine AS build
WORKDIR /client
COPY /client /client
RUN npm install
RUN npm run generate

### STAGE 2: Build server ###
FROM node:12-alpine
# RUN apk add --no-cache ffmpeg
# RUN apt-get install -y ffmpeg
ENV NODE_ENV=production
ENV LOG_LEVEL=INFO
COPY --from=build /client/dist /client/dist
COPY --from=ffmpeg / /
COPY index.js index.js
COPY package.json package.json
COPY server server
RUN npm install --production
EXPOSE 80
# CMD ["node", "index.js"]
CMD ["npm", "start"]
