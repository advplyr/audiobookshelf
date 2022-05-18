FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:16
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install ffmpeg gnupg2 -y
ENV NODE_ENV=development
