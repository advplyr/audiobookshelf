FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:16

COPY --from=sandreas/tone:v0.1.2 /usr/local/bin/tone /usr/local/bin/

ENV NODE_ENV=development

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install ffmpeg gnupg curl tzdata -y && \
    rm -rf /var/lib/apt/lists/*
