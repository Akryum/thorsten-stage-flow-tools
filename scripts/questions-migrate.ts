import { join } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { closeDrizzleConnection, useDrizzle } from '../server/utils/drizzle'
import { runQuestionMigrations } from '../server/utils/question-migrations'

async function main() {
  await migrate(useDrizzle(), {
    migrationsFolder: join(process.cwd(), 'drizzle'),
  })

  await runQuestionMigrations({
    rootDir: process.cwd(),
    log: console.info,
  })
}

main()
  .then(async () => {
    await closeDrizzleConnection()
  })
  .catch(async (error) => {
    console.error(error)
    await closeDrizzleConnection()
    process.exitCode = 1
  })
