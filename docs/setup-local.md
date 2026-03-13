# Local Development Setup

Complete guide for setting up the quiz application locally.

## Environment Setup

### Required Software

- **Node.js**: Version 24.x
- **pnpm**: Version 10.x
- **Git**: For version control

### Installation Steps

1. **Install pnpm** (if not installed)

   ```bash
   npm install -g pnpm
   ```

2. **Clone and install**
   ```bash
   git clone <repository-url>
   cd stage-flow-tools
   pnpm install
   ```

## Configuration

### Environment Variables

Create `.env` file from template:

```bash
cp .env.example .env
```

**Generate a strong JWT secret:**

```bash
openssl rand -base64 48
```

Copy the generated secret and update `NUXT_JWT_SECRET` in your `.env` file.

### Start PostgreSQL

```bash
docker compose up -d postgres
```

## Development Commands

- `pnpm dev` - Start development server
- `pnpm run build:ssr` - Build for production (server-rendered)
- `pnpm run build:ssg` - Static site generation build
- `pnpm preview` - Preview production build
- `pnpm test` - Run all checks (lint + types)
- `pnpm run test:lint` - Lint and format check via ESLint
- `pnpm run test:types` - Run TypeScript checks
- `pnpm run fix:lint` - Auto-fix lint and format issues

## Data Management

### Storage Location

During local development, data is stored in PostgreSQL via `DATABASE_URL`.

Question sets can be imported from `data/question-migrations/*.json` with `pnpm questions:migrate` (see [question-migrations.md](question-migrations.md)).

`data/predefined-questions.json` is still supported as a legacy fallback (see [predefined-questions.md](predefined-questions.md)).

### Reset Data

```bash
docker compose down -v
docker compose up -d postgres
```

### Backup Data

```bash
docker exec stage-flow-tools-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > data-backup-$(date +%Y%m%d).sql
```

## Troubleshooting

### Port Already in Use

Change port in `.env`:

```
PORT=3001
```

### Database Connection Issues

- Check that PostgreSQL is running: `docker compose ps`
- Verify `DATABASE_URL` in `.env`
- Review app logs for migration or connection errors

### WebSocket Connection Issues

- Check if port 3000 is accessible
- Verify no firewall blocking
- Check browser console for errors

## Next Steps

- [Architecture Overview](architecture.md) - System design
- [API Reference](api.md) - Endpoint documentation
