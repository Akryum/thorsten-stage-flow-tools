import { applyQuestionMigration } from '../../utils/question-migrations'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)

  const body = await readBody(event) as {
    migrationName?: string
    json?: string
  }

  const migrationName = typeof body.migrationName === 'string' ? body.migrationName.trim() : ''
  const json = typeof body.json === 'string' ? body.json.trim() : ''

  if (!migrationName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Migration name is required',
    })
  }

  if (!json) {
    throw createError({
      statusCode: 400,
      statusMessage: 'JSON payload is required',
    })
  }

  try {
    return await applyQuestionMigration(migrationName, json, {
      log: logger,
    })
  }
  catch (error: unknown) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Failed to import question migration',
    })
  }
})
