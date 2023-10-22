# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
ARG VARIANT=16
FROM mcr.microsoft.com/devcontainers/javascript-node:0-${VARIANT} as base

# Setup the node environment
ENV NODE_ENV=development

# Install additional OS packages.
RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get -y install --no-install-recommends \
    curl tzdata ffmpeg && \
  rm -rf /var/lib/apt/lists/*

# Move tone executable to appropriate directory (this doesn't seem to work in devcontainer because it needs musl)
# COPY --from=sandreas/tone:v0.1.5 /usr/local/bin/tone /usr/local/bin/
RUN wget https://github.com/sandreas/tone/releases/download/v0.1.5/tone-0.1.5-linux-x64.tar.gz && \
  tar xzf tone-*.tar.gz && \
  mv tone*/tone /usr/local/bin/

   
