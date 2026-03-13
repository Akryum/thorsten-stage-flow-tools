import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'
import type { LocalizedString } from '../../app/types'

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  questionText: jsonb('question_text').$type<LocalizedString>().notNull(),
  note: jsonb('note').$type<LocalizedString | null>(),
  isLocked: boolean('is_locked').notNull().default(false),
  isActive: boolean('is_active').notNull().default(false),
  alreadyPublished: boolean('already_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, table => [
  uniqueIndex('questions_key_idx').on(table.key),
  uniqueIndex('questions_single_active_idx').on(table.isActive).where(sql`${table.isActive} = true`),
  index('questions_created_at_idx').on(table.createdAt),
])

export const questionOptions = pgTable('question_options', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  text: jsonb('text').$type<LocalizedString>().notNull(),
  emoji: text('emoji'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, table => [
  unique('question_options_question_order_unique').on(table.questionId, table.sortOrder),
  index('question_options_question_idx').on(table.questionId),
])

export const answers = pgTable('answers', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  userNickname: text('user_nickname').notNull(),
  selectedAnswer: jsonb('selected_answer').$type<LocalizedString>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
}, table => [
  unique('answers_question_user_unique').on(table.questionId, table.userId),
  index('answers_question_idx').on(table.questionId),
  index('answers_user_idx').on(table.userId),
])

export const dataMigrations = pgTable('data_migrations', {
  name: text('name').primaryKey(),
  checksum: text('checksum').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }).notNull().default(sql`now()`),
})
