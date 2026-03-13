import { createId } from '@paralleldrive/cuid2'
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { answers, questionOptions, questions } from '../database/schema'
import { useDrizzle } from './drizzle'
import { getPeers } from './websocket'
import type { Answer, InputQuestion, Question, Results } from '~/types'

const emojiCooldowns = new Map<string, number>()

type QuestionRow = typeof questions.$inferSelect
type QuestionOptionRow = typeof questionOptions.$inferSelect
type AnswerRow = typeof answers.$inferSelect

function nowIso() {
  return new Date().toISOString()
}

function mapOption(row: QuestionOptionRow) {
  return {
    text: row.text,
    emoji: row.emoji || undefined,
  }
}

function mapAnswer(row: AnswerRow): Answer {
  return {
    id: row.id,
    question_id: row.questionId,
    user_id: row.userId,
    user_nickname: row.userNickname,
    selected_answer: row.selectedAnswer,
    timestamp: row.updatedAt,
  }
}

function mapQuestion(row: QuestionRow, optionRows: QuestionOptionRow[]): Question {
  return {
    id: row.id,
    key: row.key,
    question_text: row.questionText,
    answer_options: optionRows.map(mapOption),
    is_active: row.isActive,
    is_locked: row.isLocked,
    createdAt: row.createdAt,
    alreadyPublished: row.alreadyPublished,
    note: row.note || undefined,
  }
}

async function loadQuestionOptions(questionIds: string[]) {
  if (questionIds.length === 0) {
    return new Map<string, QuestionOptionRow[]>()
  }

  const db = useDrizzle()
  const rows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder))

  const optionsByQuestionId = new Map<string, QuestionOptionRow[]>()

  for (const row of rows) {
    const existing = optionsByQuestionId.get(row.questionId)
    if (existing) {
      existing.push(row)
    }
    else {
      optionsByQuestionId.set(row.questionId, [row])
    }
  }

  return optionsByQuestionId
}

async function hydrateQuestions(questionRows: QuestionRow[]): Promise<Question[]> {
  const optionsByQuestionId = await loadQuestionOptions(questionRows.map(row => row.id))
  return questionRows.map(row => mapQuestion(row, optionsByQuestionId.get(row.id) || []))
}

async function getQuestionById(questionId: string) {
  const db = useDrizzle()
  const [questionRow] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1)

  if (!questionRow) {
    return undefined
  }

  const [question] = await hydrateQuestions([questionRow])
  return question
}

export async function processPredefinedQuestions(
  predefinedQuestions: InputQuestion[],
  options: { log?: (message: string) => void } = {},
): Promise<void> {
  if (!Array.isArray(predefinedQuestions) || predefinedQuestions.length === 0) return
  const log = options.log || console.info

  for (const q of predefinedQuestions) {
    if (typeof q.question_text?.en !== 'string' || q.question_text.en.trim() === '') {
      const details = JSON.stringify(q.question_text)
      throw new Error(
        `Invalid question_text in predefined questions (must have non-empty "en" property): ${details}`,
      )
    }
    if (!Array.isArray(q.answer_options) || q.answer_options.length === 0) {
      throw new Error(`Invalid answer_options in predefined questions: ${JSON.stringify(q.answer_options)}`)
    }
  }

  const existingQuestions = await getQuestions()
  const existingQuestionTexts = new Set(existingQuestions.map(q => q.question_text.en))

  let insertedCount = 0
  for (const q of predefinedQuestions) {
    if (!existingQuestionTexts.has(q.question_text.en)) {
      existingQuestionTexts.add(q.question_text.en)
      const id = createId()
      await createQuestion({
        ...q,
        key: q.key || id,
      })
      insertedCount++
    }
  }

  if (insertedCount > 0) {
    log(`${insertedCount} new predefined questions loaded successfully.`)
  }
  else {
    log('No new predefined questions to load.')
  }
}

export async function getQuestions(): Promise<Question[]> {
  const db = useDrizzle()
  const questionRows = await db
    .select()
    .from(questions)
    .orderBy(desc(questions.createdAt), asc(questions.key))

  return hydrateQuestions(questionRows)
}

export async function getActiveQuestion(): Promise<Question | undefined> {
  const db = useDrizzle()
  const [questionRow] = await db
    .select()
    .from(questions)
    .where(eq(questions.isActive, true))
    .limit(1)

  if (!questionRow) {
    return undefined
  }

  const [question] = await hydrateQuestions([questionRow])
  return question
}

export async function createQuestion(
  questionData: Omit<Question, 'id' | 'is_active' | 'is_locked' | 'createdAt' | 'alreadyPublished'>,
): Promise<Question> {
  const db = useDrizzle()
  const id = createId()
  const resolvedKey = questionData.key || id
  const timestamp = nowIso()

  const [existingQuestion] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.key, resolvedKey))
    .limit(1)

  if (existingQuestion) {
    throw new Error(`A question with key "${resolvedKey}" already exists`)
  }

  await db.transaction(async (tx) => {
    await tx.insert(questions).values({
      id,
      key: resolvedKey,
      questionText: questionData.question_text,
      note: questionData.note || null,
      isLocked: false,
      isActive: false,
      alreadyPublished: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    if (questionData.answer_options.length > 0) {
      await tx.insert(questionOptions).values(questionData.answer_options.map((option, index) => ({
        id: createId(),
        questionId: id,
        sortOrder: index,
        text: option.text,
        emoji: option.emoji || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })))
    }
  })

  const createdQuestion = await getQuestionById(id)
  if (!createdQuestion) {
    throw new Error('Failed to create question')
  }

  return createdQuestion
}

export async function publishQuestion(identifier: string): Promise<Question | undefined> {
  const db = useDrizzle()
  const timestamp = nowIso()

  const publishedQuestionId = await db.transaction(async (tx) => {
    const [questionRow] = await tx
      .select()
      .from(questions)
      .where(or(
        eq(questions.id, identifier),
        eq(questions.key, identifier),
      ))
      .limit(1)

    if (!questionRow) {
      return undefined
    }

    await tx
      .update(questions)
      .set({
        isActive: false,
        updatedAt: timestamp,
      })
      .where(eq(questions.isActive, true))

    await tx
      .update(questions)
      .set({
        isActive: true,
        alreadyPublished: true,
        updatedAt: timestamp,
      })
      .where(eq(questions.id, questionRow.id))

    return questionRow.id
  })

  if (!publishedQuestionId) {
    return undefined
  }

  return getQuestionById(publishedQuestionId)
}

export async function unpublishActiveQuestion(): Promise<Question | undefined> {
  const db = useDrizzle()
  const timestamp = nowIso()

  const unpublishedQuestionId = await db.transaction(async (tx) => {
    const [questionRow] = await tx
      .select()
      .from(questions)
      .where(eq(questions.isActive, true))
      .limit(1)

    if (!questionRow) {
      return undefined
    }

    await tx
      .update(questions)
      .set({
        isActive: false,
        updatedAt: timestamp,
      })
      .where(eq(questions.id, questionRow.id))

    return questionRow.id
  })

  if (!unpublishedQuestionId) {
    return undefined
  }

  return getQuestionById(unpublishedQuestionId)
}

export async function toggleQuestionLock(questionId: string): Promise<Question | undefined> {
  const question = await getQuestionById(questionId)
  if (!question) {
    return undefined
  }

  const db = useDrizzle()
  await db
    .update(questions)
    .set({
      isLocked: !question.is_locked,
      updatedAt: nowIso(),
    })
    .where(eq(questions.id, questionId))

  return getQuestionById(questionId)
}

export async function getAnswers(): Promise<Answer[]> {
  const db = useDrizzle()
  const answerRows = await db
    .select()
    .from(answers)
    .orderBy(asc(answers.createdAt), asc(answers.id))

  return answerRows.map(mapAnswer)
}

export async function submitAnswer(answerData: Omit<Answer, 'id' | 'timestamp'>): Promise<Answer[]> {
  const question = await getQuestionById(answerData.question_id)

  if (!question) {
    throw new Error('Question not found')
  }

  if (!question.answer_options.some(option => option.text.en === answerData.selected_answer.en)) {
    throw new Error('Invalid answer option')
  }

  const db = useDrizzle()
  const timestamp = nowIso()

  await db
    .insert(answers)
    .values({
      id: createId(),
      questionId: answerData.question_id,
      userId: answerData.user_id,
      userNickname: answerData.user_nickname,
      selectedAnswer: answerData.selected_answer,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [answers.questionId, answers.userId],
      set: {
        userNickname: answerData.user_nickname,
        selectedAnswer: answerData.selected_answer,
        updatedAt: timestamp,
      },
    })

  return getAnswers()
}

export async function getAnswersForQuestion(questionId: string): Promise<Answer[]> {
  const db = useDrizzle()
  const answerRows = await db
    .select()
    .from(answers)
    .where(eq(answers.questionId, questionId))
    .orderBy(asc(answers.createdAt), asc(answers.id))

  return answerRows.map(mapAnswer)
}

export async function clearAnswersForQuestion(questionId: string): Promise<void> {
  const db = useDrizzle()

  await db
    .delete(answers)
    .where(eq(answers.questionId, questionId))
}

export async function retractAnswer(userId: string, questionId: string): Promise<Answer[]> {
  const db = useDrizzle()

  await db
    .delete(answers)
    .where(and(
      eq(answers.userId, userId),
      eq(answers.questionId, questionId),
    ))

  return getAnswers()
}

export async function validateAdmin(username: string, password: string, event?: H3Event): Promise<boolean> {
  const config = event
    ? useRuntimeConfig(event)
    : useRuntimeConfig()

  return config.adminUsername === username && config.adminPassword === password
}

export async function getResultsForQuestion(
  questionId: string,
  allQuestions?: Question[],
  allAnswers?: Answer[],
): Promise<Results | null> {
  const question = allQuestions
    ? allQuestions.find(q => q.id === questionId)
    : await getQuestionById(questionId)

  if (!question) return null

  const answersForQuestion = allAnswers
    ? allAnswers.filter(answer => answer.question_id === questionId)
    : await getAnswersForQuestion(questionId)

  const results: Record<string, { count: number, emoji?: string }> = {}
  question.answer_options.forEach((option) => {
    if (option.text.en) {
      results[option.text.en] = { count: 0, emoji: option.emoji }
    }
  })

  answersForQuestion.forEach((answer) => {
    if (answer.selected_answer.en && Object.prototype.hasOwnProperty.call(results, answer.selected_answer.en)) {
      const result = results[answer.selected_answer.en]
      if (result) {
        result.count++
      }
    }
  })

  return JSON.parse(JSON.stringify({
    question,
    results,
    totalVotes: answersForQuestion.length,
    totalConnections: (await getPeers()).length,
  }))
}

export async function getCurrentResults(): Promise<Results | null> {
  const activeQuestion = await getActiveQuestion()
  if (!activeQuestion) return null
  return getResultsForQuestion(activeQuestion.id)
}

function pruneExpiredCooldowns(cooldownMs: number): void {
  const now = Date.now()
  for (const [id, timestamp] of emojiCooldowns) {
    if (now - timestamp >= cooldownMs) {
      emojiCooldowns.delete(id)
    }
  }
}

export function checkEmojiCooldown(userId: string): boolean {
  const config = useRuntimeConfig()
  const cooldownMs = config.public.emojiCooldownMs

  pruneExpiredCooldowns(cooldownMs)

  const lastSubmission = emojiCooldowns.get(userId)
  if (lastSubmission) {
    const now = Date.now()
    if (now - lastSubmission < cooldownMs) {
      return true
    }
  }
  return false
}

export function updateEmojiTimestamp(userId: string): void {
  emojiCooldowns.set(userId, Date.now())
}
