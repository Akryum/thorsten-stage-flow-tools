# Predefined Questions

This document explains how to automatically load a set of questions into the application when it starts up.

For repeatable imports, prefer [question migrations](question-migrations.md). This legacy single-file workflow is still supported as a compatibility fallback.

## How It Works

1. Create `data/predefined-questions.json`.
2. Store a JSON array of question objects with `question_text` and `answer_options`.
3. On startup, the app renames the file to `.processing`, imports new questions into PostgreSQL, and deletes the file on success.

Questions are skipped when another stored question already has the same `question_text.en`.

## Example

```json
[
  {
    "key": "fav-color",
    "question_text": {
      "en": "What is your favorite color?",
      "de": "Was ist deine Lieblingsfarbe?"
    },
    "answer_options": [
      { "text": { "en": "Red", "de": "Rot" } },
      { "text": { "en": "Green", "de": "Grün" }, "emoji": "💚" },
      { "text": { "en": "Blue", "de": "Blau" } }
    ]
  }
]
```

## Recommended Workflow

```bash
cp ./my-questions.json ./data/predefined-questions.json
docker compose restart app
```
