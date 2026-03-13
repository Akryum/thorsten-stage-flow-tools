# Storage System

The application stores quiz state in PostgreSQL and accesses it through Drizzle ORM.

## Database Tables

### `questions`

- Stores the question prompt, stable key, note, publish state, and timestamps.
- Uses JSONB for localized text.
- Enforces a unique `key`.
- Enforces at most one active question with a partial unique index on `is_active = true`.

### `question_options`

- Stores ordered answer options per question.
- Uses JSONB for localized option text.
- Keeps display order with `sort_order`.

### `answers`

- Stores one answer per user per question.
- Uses JSONB for the selected localized answer text.
- Enforces uniqueness on `(question_id, user_id)` so repeat submissions overwrite the prior answer.

## Storage Operations

### Initialization

- Drizzle migrations run automatically on server startup.
- Admin credentials remain environment-based and are not stored in PostgreSQL.

### Question Migration Loading

On startup the app checks `data/question-migrations/*.json`:

1. Sorts files lexically.
1. Validates each file as a JSON array of questions.
1. Inserts only unapplied migration files.
1. Tracks each applied file in the `data_migrations` table.

Applied migration files are immutable: if a file's contents change after import, startup fails and a new migration file should be created instead.

### Legacy Predefined Questions Loading

On startup the app checks for `data/predefined-questions.json`:

1. Renames the file to `.processing`.
1. Validates the question batch.
1. Inserts only questions whose `question_text.en` is not already present.
1. Deletes the `.processing` file on success.

If parsing or validation fails, the `.processing` file is left in place for inspection and retry.

## Maintenance

### Backup

```bash
docker exec stage-flow-tools-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/data-$(date +%Y%m%d).sql
```

### Data Reset

```bash
docker compose down -v
docker compose up -d postgres
```

## Performance Characteristics

- PostgreSQL handles durability and transactional writes.
- The current single-instance architecture is a good fit for the app's quiz workload.
- WebSocket peer state is still kept in memory in the app process.
