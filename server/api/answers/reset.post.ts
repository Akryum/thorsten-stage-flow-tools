import { WebSocketChannel } from '~/types'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)

  const activeQuestion = await getActiveQuestion()

  if (!activeQuestion) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No active question',
    })
  }

  await clearAnswersForQuestion(activeQuestion.id)

  const results = await getCurrentResults()
  if (results) {
    broadcast('results-update', results, WebSocketChannel.RESULTS)
  }

  broadcast('answers-reset', { questionId: activeQuestion.id }, WebSocketChannel.DEFAULT)

  return { success: true }
})
