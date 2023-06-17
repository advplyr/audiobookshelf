#!/bin/bash

UMASK=${UMASK:-022}
PUID=${PUID:-1000}
PGID=${PGID:-1000}

umask ${UMASK}

if [ ! -d /config ]; then
    mkdir /config
fi
if [ ! -d /metadata ]; then
    mkdir /metadata
fi
if [ ! -d /audiobooks ]; then
    mkdir /audiobooks
fi
if [ ! -d /podcasts ]; then
    mkdir /podcasts
fi

echo "Change owner to user AudioBookShelf..."
echo "PUID=${PUID}"
echo "PGID=${PGID}"

groupmod -o -g ${PGID} node
usermod -o -u ${PUID} node

chown -R node:node \
    /client \
    /index.js \
    /package* \
    /server
chown -R node:node \
    /config \
    /metadata
chown node:node \
    /audiobooks \
    /podcasts

exec su-exec node:node dumb-init $*