# Implementation Plan - Dockerize Frigate-Guardian-Secure

Enable `Frigate-Guardian-Secure` to run as a Docker container, providing a consistent environment and easy deployment, similar to the `Direct-NVR-Viewer` project.

## User Review Required

> [!IMPORTANT]
> The application uses `Vite` for the frontend and `server.ts` for the backend. In production mode, it expects the frontend to be built into the `dist` directory. The Docker image will handle this build process automatically.

> [!NOTE]
> Like the previous project, we will use `network_mode: host` to ensure the container can easily discover and communicate with Frigate and MQTT brokers on your local network.

## Proposed Changes

### [Server]

#### [MODIFY] [server.ts](file:///Users/jim/Frigate-Guardian-Secure/server.ts)
- Update `DATA_DIR` to support a `DATA_DIR` environment variable. This allows us to easily map a persistent volume for your settings.

### [Docker]

#### [NEW] [Dockerfile](file:///Users/jim/Frigate-Guardian-Secure/Dockerfile)
- Use `node:20-slim` as the base image.
- Install build dependencies (for `npm install` if needed).
- Copy application files.
- Run `npm install` and `npm run build` to generate the production `dist` folder and bundle the server.
- Expose port `3000`.

#### [NEW] [.dockerignore](file:///Users/jim/Frigate-Guardian-Secure/.dockerignore)
- Exclude `node_modules`, `dist`, `.git`, etc., to keep the image slim and prevent host-to-container conflicts.

#### [NEW] [docker-compose.yml](file:///Users/jim/Frigate-Guardian-Secure/docker-compose.yml)
- Define a service for `frigate-guardian`.
- Set `network_mode: host` and `privileged: true`.
- Configure environment variables (`PORT=3000`, `DATA_DIR=/app/data`, `NODE_ENV=production`).
- Map a persistent volume `guardian_data` to `/app/data`.

### [Documentation]

#### [MODIFY] [README.md](file:///Users/jim/Frigate-Guardian-Secure/README.md)
- Add a "Running with Docker" section with quick-start and maintenance instructions.

## Verification Plan

### Manual Verification
- Build and start the container locally using `docker compose up -d --build`.
- Verify the web UI is accessible at `http://localhost:3000`.
- Verify that settings (like MQTT or notifications) persist after a container restart.
