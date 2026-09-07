# Walkthrough - Docker Support for Frigate-Guardian-Secure

I have enabled Docker support for the `Frigate-Guardian-Secure` project, allowing it to run in a containerized environment with persistent data and easy network discovery.

## Changes Made

### Core Application
- **[server.ts](file:///Users/jim/Frigate-Guardian-Secure/server.ts)**:
  - Added support for the `DATA_DIR` environment variable. This ensures that notification and MQTT settings are stored in a configurable location, which we now map to a persistent Docker volume.

### Docker Integration
- **[Dockerfile](file:///Users/jim/Frigate-Guardian-Secure/Dockerfile)**:
  - Created a multi-step build process that installs dependencies, builds the React frontend, bundles the TypeScript server, and prepares a lightweight production image.
- **[.dockerignore](file:///Users/jim/Frigate-Guardian-Secure/.dockerignore)**:
  - Added to prevent host files (like `node_modules` or `dist`) from bloating the image or causing conflicts.
- **[docker-compose.yml](file:///Users/jim/Frigate-Guardian-Secure/docker-compose.yml)**:
  - Defined the `frigate-guardian` service.
  - Set `network_mode: host` to allow the app to discover Frigate and MQTT on your local network.
  - Configured a persistent volume `guardian_data` for settings storage.

### Documentation
- **[README.md](file:///Users/jim/Frigate-Guardian-Secure/README.md)**:
  - Added a new **Running with Docker** section with setup, maintenance, and reset instructions.

## Verification Results

The application is now ready to be deployed via:
```bash
docker compose up -d --build
```

> [!NOTE]
> The Docker container will automatically build the project for production on startup, ensuring the latest code changes are always included.
