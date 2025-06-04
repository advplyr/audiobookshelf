# Audiobookshelf Deployment Guide

## Prerequisites

- Docker Desktop (for local deployment)
- Portainer (optional, for container management)
- At least 1GB of free RAM
- Sufficient disk space for your audiobooks and metadata

## Directory Structure

```
audiobookshelf/
├── audiobooks/     # Your audiobooks directory
├── podcasts/       # Your podcasts directory
├── metadata/       # Application metadata
├── config/         # Configuration files
├── client/         # Frontend source code
├── server/         # Backend source code
├── Dockerfile      # Docker build instructions
└── docker-compose.prod.yml

External Directories:
/libraries/         # Additional media libraries directory (customizable path)
```

## Deployment Steps

### Using Docker Desktop

1. Create the required directories:

   ```bash
   mkdir -p audiobooks podcasts metadata config
   ```

2. Configure your libraries path: Edit `docker-compose.prod.yml` and modify the libraries volume mount to point to your desired path:

   ```yaml
   volumes:
     - /path/to/your/libraries:/libraries
   ```

3. Build and start the application:

   ```bash
   # Build the image
   docker compose -f docker-compose.prod.yml build

   # Start the containers
   docker compose -f docker-compose.prod.yml up -d
   ```

4. Access the application at `http://localhost:13378`

### Using Portainer

1. In Portainer, go to "Stacks" and click "Add Stack"
2. Give your stack a name (e.g., "audiobookshelf")
3. Copy the contents of `docker-compose.prod.yml` into the web editor
4. Modify the libraries volume mount path to match your system
5. Enable "Build Image" option in Portainer
6. Click "Deploy the stack"

## Configuration

- The application runs on port 13378 by default
- Data is persisted in the mounted volumes:
  - `./audiobooks`: Default audiobooks directory
  - `./podcasts`: Default podcasts directory
  - `./metadata`: Application metadata
  - `./config`: Configuration files
  - `/libraries`: Additional media libraries (customize path in docker-compose.prod.yml)
- Timezone can be configured in the docker-compose file
- User/Group IDs can be set via PUID/PGID environment variables

## Post-Installation

1. On first run, create an admin account
2. Configure your libraries in the web interface:
   - Set up the default audiobooks and podcasts directories
   - Add additional libraries from the `/libraries` mount point
3. Add your media files to the appropriate directories

## Updating

When you make changes to your code:

```bash
# Rebuild the image with your changes
docker compose -f docker-compose.prod.yml build

# Restart the containers with the new image
docker compose -f docker-compose.prod.yml up -d
```

## Backup

Important directories to backup:

- `config/` - Contains application settings and database
- `metadata/` - Contains metadata for your media
- `audiobooks/` and `podcasts/` - Your media files
- Any additional libraries you've configured

## Troubleshooting

- Check container logs: `docker logs audiobookshelf`
- Ensure proper file permissions on mounted volumes
- Verify port 13378 is not in use by another application
- Check resource usage in Docker Desktop dashboard
- Build logs: `docker compose -f docker-compose.prod.yml build --progress=plain`
- Check that all volume mount paths exist and are accessible
- Verify file permissions on the libraries directory
