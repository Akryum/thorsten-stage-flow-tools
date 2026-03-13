import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join, relative } from 'node:path'
import { createId } from '@paralleldrive/cuid2'
import { asc, eq, inArray } from 'drizzle-orm'
import type { DataMigrationFile, DataMigrationQuestion, LocalizedString } from '../../app/types'
import { dataMigrations, questionOptions, questions } from '../database/schema'
import { useDrizzle } from './drizzle'

type LogFn = (message: string) => void

interface RunQuestionMigrationsOptions {
  rootDir?: string
  log?: LogFn
}

interface ApplyQuestionMigrationOptions {
  log?: LogFn
}

interface ExistingQuestionRecord {
  id: string
  key: string
  question_text: LocalizedString
  answer_options: DataMigrationQuestion['answer_options']
  note?: LocalizedString
}

export interface QuestionMigrationResult {
  migrationName: string
  createdCount: number
  skipped: boolean
}

const QUESTION_MIGRATIONS_DIR = join('data', 'question-migrations')

function defaultLog(message: string) {
  console.info(message)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeRequiredLocalizedString(value: unknown, field: string): LocalizedString {
  if (!isPlainObject(value)) {
    throw new Error(`${field} must be an object of localized strings`)
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    throw new Error(`${field} must not be empty`)
  }

  const normalized = Object.fromEntries(entries.map(([lang, rawValue]) => {
    if (typeof rawValue !== 'string') {
      throw new Error(`${field}.${lang} must be a string`)
    }
    return [lang, rawValue.trim()]
  })) as LocalizedString

  if (!normalized.en) {
    throw new Error(`${field}.en is required`)
  }

  return normalized
}

function normalizeOptionalLocalizedString(value: unknown, field: string): LocalizedString | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!isPlainObject(value)) {
    throw new Error(`${field} must be an object of localized strings`)
  }

  const normalizedEntries = Object.entries(value)
    .map(([lang, rawValue]) => {
      if (typeof rawValue !== 'string') {
        throw new Error(`${field}.${lang} must be a string`)
      }
      return [lang, rawValue.trim()] as const
    })
    .filter(([, rawValue]) => rawValue.length > 0)

  if (normalizedEntries.length === 0) {
    return undefined
  }

  return Object.fromEntries(normalizedEntries) as LocalizedString
}

function normalizeMigrationQuestion(rawQuestion: unknown, index: number): DataMigrationQuestion {
  if (!isPlainObject(rawQuestion)) {
    throw new Error(`Question #${index + 1} must be an object`)
  }

  const key = typeof rawQuestion.key === 'string' ? rawQuestion.key.trim() : ''
  if (!key) {
    throw new Error(`Question #${index + 1} is missing a non-empty "key"`)
  }

  if (!Array.isArray(rawQuestion.answer_options)) {
    throw new Error(`Question "${key}" must have an "answer_options" array`)
  }

  const answer_options = rawQuestion.answer_options.map((rawOption, optionIndex) => {
    if (!isPlainObject(rawOption)) {
      throw new Error(`Question "${key}" answer option #${optionIndex + 1} must be an object`)
    }

    const text = normalizeRequiredLocalizedString(
      rawOption.text,
      `Question "${key}" answer_options[${optionIndex}].text`,
    )
    const emoji = typeof rawOption.emoji === 'string' ? rawOption.emoji.trim() : undefined

    return {
      text,
      emoji: emoji || undefined,
    }
  })

  if (answer_options.length < 2) {
    throw new Error(`Question "${key}" must contain at least 2 answer options`)
  }

  return {
    key,
    question_text: normalizeRequiredLocalizedString(rawQuestion.question_text, `Question "${key}" question_text`),
    answer_options,
    note: normalizeOptionalLocalizedString(rawQuestion.note, `Question "${key}" note`),
  }
}

function normalizeMigrationFile(rawData: unknown, migrationName: string): DataMigrationFile {
  if (!Array.isArray(rawData)) {
    throw new Error(`Question migration "${migrationName}" must be a JSON array`)
  }

  const questions = rawData.map((rawQuestion, index) => normalizeMigrationQuestion(rawQuestion, index))
  const seenKeys = new Set<string>()

  for (const question of questions) {
    if (seenKeys.has(question.key)) {
      throw new Error(`Question migration "${migrationName}" contains duplicate key "${question.key}"`)
    }
    seenKeys.add(question.key)
  }

  return questions
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys(value[key])
        return result
      }, {})
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value))
}

function getComparableQuestion(question: ExistingQuestionRecord | DataMigrationQuestion) {
  return {
    key: question.key,
    question_text: question.question_text,
    answer_options: question.answer_options,
    note: question.note,
  }
}

function mapExistingQuestions(
  questionRows: typeof questions.$inferSelect[],
  optionRows: typeof questionOptions.$inferSelect[],
): Map<string, ExistingQuestionRecord> {
  const optionsByQuestionId = new Map<string, typeof questionOptions.$inferSelect[]>()

  for (const optionRow of optionRows) {
    const existingOptions = optionsByQuestionId.get(optionRow.questionId)
    if (existingOptions) {
      existingOptions.push(optionRow)
    }
    else {
      optionsByQuestionId.set(optionRow.questionId, [optionRow])
    }
  }

  return new Map(questionRows.map(questionRow => [
    questionRow.key,
    {
      id: questionRow.id,
      key: questionRow.key,
      question_text: questionRow.questionText,
      answer_options: (optionsByQuestionId.get(questionRow.id) || []).map(optionRow => ({
        text: optionRow.text,
        emoji: optionRow.emoji || undefined,
      })),
      note: questionRow.note || undefined,
    },
  ]))
}

async function loadExistingQuestionsByKey(keys: string[]) {
  if (keys.length === 0) {
    return new Map<string, ExistingQuestionRecord>()
  }

  const db = useDrizzle()
  const questionRows = await db
    .select()
    .from(questions)
    .where(inArray(questions.key, keys))

  if (questionRows.length === 0) {
    return new Map<string, ExistingQuestionRecord>()
  }

  const optionRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionRows.map(questionRow => questionRow.id)))
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder))

  return mapExistingQuestions(questionRows, optionRows)
}

export async function applyQuestionMigration(
  migrationName: string,
  rawData: string,
  options: ApplyQuestionMigrationOptions = {},
): Promise<QuestionMigrationResult> {
  const checksum = createHash('sha256').update(rawData).digest('hex')
  const db = useDrizzle()
  const log = options.log || defaultLog

  const [appliedMigration] = await db
    .select()
    .from(dataMigrations)
    .where(eq(dataMigrations.name, migrationName))
    .limit(1)

  if (appliedMigration) {
    if (appliedMigration.checksum !== checksum) {
      throw new Error(
        `Question migration "${migrationName}" was already applied with different contents. `
        + `Create a new file instead of editing an applied migration.`,
      )
    }

    log(`Skipped question migration "${migrationName}" (already applied).`)
    return {
      migrationName,
      createdCount: 0,
      skipped: true,
    }
  }

  const normalizedQuestions = normalizeMigrationFile(JSON.parse(rawData) as unknown, migrationName)
  const existingQuestionsByKey = await loadExistingQuestionsByKey(normalizedQuestions.map(question => question.key))
  let createdCount = 0

  await db.transaction(async (tx) => {
    for (const question of normalizedQuestions) {
      const existingQuestion = existingQuestionsByKey.get(question.key)

      if (existingQuestion) {
        const existingComparable = stableStringify(getComparableQuestion(existingQuestion))
        const incomingComparable = stableStringify(getComparableQuestion(question))

        if (existingComparable !== incomingComparable) {
          throw new Error(
            `Question migration "${migrationName}" conflicts with existing question "${question.key}".`,
          )
        }

        continue
      }

      const timestamp = new Date().toISOString()
      const questionId = createId()

      await tx.insert(questions).values({
        id: questionId,
        key: question.key,
        questionText: question.question_text,
        note: question.note || null,
        isLocked: false,
        isActive: false,
        alreadyPublished: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await tx.insert(questionOptions).values(question.answer_options.map((option, optionIndex) => ({
        id: createId(),
        questionId,
        sortOrder: optionIndex,
        text: option.text,
        emoji: option.emoji || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })))

      createdCount++
    }

    await tx.insert(dataMigrations).values({
      name: migrationName,
      checksum,
      appliedAt: new Date().toISOString(),
    })
  })

  log(`Applied question migration "${migrationName}" (${createdCount} new question(s)).`)
  return {
    migrationName,
    createdCount,
    skipped: false,
  }
}

async function applyQuestionMigrationFile(filePath: string, migrationName: string, log: LogFn) {
  const rawData = await fs.readFile(filePath, 'utf-8')
  await applyQuestionMigration(migrationName, rawData, { log })
}

export async function runQuestionMigrations(options: RunQuestionMigrationsOptions = {}) {
  const rootDir = options.rootDir || process.cwd()
  const log = options.log || defaultLog
  const migrationsDir = join(rootDir, QUESTION_MIGRATIONS_DIR)

  let entries
  try {
    entries = await fs.readdir(migrationsDir, { withFileTypes: true, encoding: 'utf8' })
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }

  const migrationFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))

  for (const fileName of migrationFiles) {
    const filePath = join(migrationsDir, fileName)
    const migrationName = relative(rootDir, filePath)
    await applyQuestionMigrationFile(filePath, migrationName, log)
  }
}
