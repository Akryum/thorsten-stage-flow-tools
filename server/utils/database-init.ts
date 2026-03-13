import { join } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { InputQuestion } from '~/types'
import { runQuestionMigrations } from './question-migrations'
import { useDrizzle } from './drizzle'
import { processPredefinedQuestions } from './storage'

let databaseReadyPromise: Promise<void> | null = null

async function runPredefinedQuestionImport() {
  try {
    const fs = await import('node:fs').then(m => m.promises)
    const predefinedFile = join(process.cwd(), 'data', 'predefined-questions.json')
    const processingFile = `${predefinedFile}.processing`

    await fs.rename(predefinedFile, processingFile)

    const rawData = await fs.readFile(processingFile, 'utf-8')
    let predefinedQuestions: InputQuestion[]

    try {
      predefinedQuestions = JSON.parse(rawData)
    }
    catch (parseError: unknown) {
      logger_error('Malformed JSON in predefined questions file:', parseError)
      return
    }

    await processPredefinedQuestions(predefinedQuestions, {
      log: logger,
    })
    await fs.unlink(processingFile)
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }

    logger_error('Error loading predefined questions from file:', error)
  }
}

export async function ensureDatabaseReady() {
  if (!databaseReadyPromise) {
    databaseReadyPromise = (async () => {
      await migrate(useDrizzle(), {
        migrationsFolder: join(process.cwd(), 'drizzle'),
      })

      await runQuestionMigrations({
        rootDir: process.cwd(),
        log: logger,
      })

      await runPredefinedQuestionImport()
    })().catch((error) => {
      databaseReadyPromise = null
      throw error
    })
  }

  return databaseReadyPromise
}
