#!/bin/sh
set -e

# --- PUID/PGID Check and Defaults ---
# Set default PUID/PGID to 1000 if not provided
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting with PUID: $PUID, PGID: $PGID"

# --- User/Group Setup ---
# Create or modify the 'appuser' group to match the PGID
if [ -z "$(getent group "${PGID}")" ]; then
    addgroup -g "${PGID}" appgroup
else
    # Group exists, ensure the name is correct for the PUID/PGID
    group_name=$(getent group "${PGID}" | cut -d: -f1)
    if [ "$group_name" != "appgroup" ]; then
        echo "WARNING: PGID ${PGID} already exists with name ${group_name}. Using existing group."
        app_group_name="${group_name}"
    else
        app_group_name="appgroup"
    fi
fi

# Create or modify the 'appuser' user to match the PUID and assign to the PGID
if [ -z "$(getent passwd "${PUID}")" ]; then
    adduser -u "${PUID}" -G "${app_group_name:-appgroup}" -D -s /bin/sh appuser
else
    # User exists, ensure the name is correct for the PUID/PGID
    user_name=$(getent passwd "${PUID}" | cut -d: -f1)
    if [ "$user_name" != "appuser" ]; then
        echo "WARNING: PUID ${PUID} already exists with name ${user_name}. Using existing user."
        app_user_name="${user_name}"
    else
        app_user_name="appuser"
    fi
fi

# --- Permission Fix (Crucial Step) ---
# This fixes permissions on directories meant for bind mounts (volumes)
# CONFIG_PATH and METADATA_PATH are the likely mount points
echo "Fixing permissions on volume paths (${CONFIG_PATH} and ${METADATA_PATH})..."
chown -R "${PUID}":"${PGID}" "${CONFIG_PATH}" || true
chown -R "${PUID}":"${PGID}" "${METADATA_PATH}" || true

# --- Execute Main Command ---
# Use 'gosu' to securely drop privileges and run the main command
# Pass all arguments ($@) to the final application command
echo "Executing CMD as user ${PUID}..."
exec gosu "${PUID}":"${PGID}" "$@"
