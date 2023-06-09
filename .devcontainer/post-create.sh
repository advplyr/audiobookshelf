#!/bin/sh

# Mark the working directory as safe for use with git
git config --global --add safe.directory $PWD

# If there is no dev.js file, create it
if [ ! -f dev.js ]; then
  cp .devcontainer/dev.js .
fi

# Update permissions for node_modules folders
# https://code.visualstudio.com/remote/advancedcontainers/improve-performance#_use-a-targeted-named-volume
if [ -d node_modules ]; then
  sudo chown $(id -u):$(id -g) node_modules
fi

if [ -d client/node_modules ]; then
  sudo chown $(id -u):$(id -g) client/node_modules
fi

# Install packages for the server
if [ -f package.json ]; then
    npm ci
fi

# Install packages and build the client
if [ -f client/package.json ]; then
    (cd client; npm ci; npm run generate)
fi
