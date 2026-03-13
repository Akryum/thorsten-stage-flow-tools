# Deployment

This application is designed for a Node.js runtime backed by PostgreSQL. Docker Compose is the primary deployment path for self-hosted setups.

## Deployment Options

### 1. Docker Compose (Primary)

Self-host on any Linux server using Docker Compose with a Traefik reverse proxy and a bundled PostgreSQL service.

- [Docker Deployment Guide](deployment-docker.md)

### 2. Node.js + External PostgreSQL

Build the app with `pnpm run build:ssr`, point `DATABASE_URL` at an existing PostgreSQL instance, and run the generated Nitro server behind your preferred process manager.
