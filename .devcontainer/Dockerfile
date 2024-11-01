# [Choice] Node.js version (use -bullseye variants on local arm64/Apple Silicon): 18, 16, 14, 18-bullseye, 16-bullseye, 14-bullseye, 18-buster, 16-buster, 14-buster
ARG VARIANT=20
FROM mcr.microsoft.com/devcontainers/javascript-node:0-${VARIANT} as base

# Setup the node environment
ENV NODE_ENV=development

# Install additional OS packages.
RUN apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get -y install --no-install-recommends \
    curl tzdata ffmpeg && \
  rm -rf /var/lib/apt/lists/*
