# Production Deployment

Guide for deploying the quiz application to production.

## Build Process

### Production Build

```bash
pnpm run build:ssr
```

Creates optimized production bundle in `.output/` directory.

## Deployment Options

### 1. Docker Container

See the [Docker Deployment Guide](deployment-docker.md).

**Dockerfile example:**

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY .output .output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

> The production setup expects PostgreSQL. In Docker Compose, persistence comes from the `postgres-data` volume.

### 2. Node.js Server (VPS/Dedicated)

**Requirements:**

- Node.js 24.x
- PM2 or similar process manager

**Steps:**

1. Build application
2. Copy `.output/` to server
3. Set environment variables
4. Start with PM2:
   ```bash
   pm2 start .output/server/index.mjs --name quiz-app
   ```

### 3. Platform-as-a-Service

**Railway/Render:**

- Full Node.js support
- PostgreSQL add-ons are available

## Environment Configuration

### Production Variables

**Generate a strong JWT secret:**

```bash
openssl rand -base64 48
```

Store the generated secret in your environment management system or secrets manager to fill `NUXT_JWT_SECRET` in production (e.g., AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets, or your platform's environment variable manager).

### Security Considerations

- **Strong Passwords**: Use complex admin credentials
- **JWT Secret**: Generate secure random string using `openssl rand -base64 48` and store it securely
- **Secret Management**: Never commit secrets to source control; use environment management or a secrets manager
- **HTTPS**: Always use SSL in production
- **Firewall**: Configure appropriate rules

## Data Persistence

Data is stored in PostgreSQL. Use regular database backups and monitor connection health in your hosting platform.

## Monitoring

### Health Check Endpoint

Access `/api/questions` to verify API availability.

### Logs

- Application logs to stdout
- Use platform logging services
- Monitor WebSocket connections

## Scaling Considerations

### Single Instance

Current architecture supports:

- ~100-500 concurrent users
- One active question at a time
- PostgreSQL-backed storage

### Multi-Instance

For larger scale:

- Implement Redis for session/WebSocket sync
- Use external database
- Load balancer configuration

## Backup Strategy

### Automated Backups

Schedule cron job (Docker / Node.js):

```bash
0 */6 * * * docker exec stage-flow-tools-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /backups/data-$(date +\%Y\%m\%d-\%H\%M).sql
```

### Manual Backup

Before updates:

```bash
docker exec stage-flow-tools-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > quiz-backup-$(date +%Y%m%d).sql
```
