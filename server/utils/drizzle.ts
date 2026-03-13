import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

type Database = ReturnType<typeof drizzle<typeof schema>>

declare global {
  var __stageFlowSql__: postgres.Sql | undefined
  var __stageFlowDb__: Database | undefined
}

export function useDrizzle(): Database {
  if (!globalThis.__stageFlowDb__) {
    const databaseUrl = process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required')
    }

    globalThis.__stageFlowSql__ = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })

    globalThis.__stageFlowDb__ = drizzle(globalThis.__stageFlowSql__, {
      schema,
    })
  }

  return globalThis.__stageFlowDb__
}

export async function closeDrizzleConnection() {
  if (globalThis.__stageFlowSql__) {
    await globalThis.__stageFlowSql__.end()
    globalThis.__stageFlowSql__ = undefined
    globalThis.__stageFlowDb__ = undefined
  }
}
