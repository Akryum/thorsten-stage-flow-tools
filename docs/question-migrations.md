# Question Migrations

This project can import question sets from JSON files in a tracked, repeatable way.

## Folder Layout

Create JSON files in `data/question-migrations/`:

```text
data/
  question-migrations/
    001-opening-questions.json
    002-vuejs-amsterdam.json
```

Files are applied in lexical order, so numeric prefixes like `001-`, `002-`, `003-` are recommended.

## JSON Format

Each file uses the same top-level array format as the existing predefined question file:

```json
[
  {
    "key": "favorite-js-meta-framework",
    "question_text": {
      "en": "What is your favorite JS Meta-Framework?"
    },
    "note": {
      "en": "There's no wrong answer, but Nuxt is a fantastic choice! 😉"
    },
    "answer_options": [
      { "text": { "en": "Next.js" } },
      { "emoji": "💚", "text": { "en": "Nuxt" } }
    ]
  }
]
```

## Rules

- Every question must have a non-empty `key`.
- Every question must have a non-empty `question_text.en`.
- Every question must have at least 2 `answer_options`.
- Every answer option must have a non-empty `text.en`.

## How Tracking Works

- Applied files are recorded in the `data_migrations` table.
- Re-running the same file is safe: it is skipped after the first successful import.
- Editing an already applied migration file is treated as an error. Create a new file instead.
- If a question already exists with the same `key` and identical content, the migration reuses it.
- If the `key` already exists with different content, the migration stops with an error.

## Import Commands

Run migrations manually:

```bash
pnpm questions:migrate
```

They also run automatically when the app starts.

From the live app, admins can also open `/admin/questions` and use the import form to upload or paste the same JSON format directly.

## Legacy Import

`data/predefined-questions.json` still works as a compatibility fallback, but `data/question-migrations/*.json` is now the recommended workflow.
