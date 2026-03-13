import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://stage_flow:stage_flow@localhost:5432/stage_flow_tools',
  },
  strict: true,
  verbose: true,
})
