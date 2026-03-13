<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
  footer: true,
  background: true,
  localeSwitcher: true,
})

const { t } = useI18n()

interface LeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  correctAnswers: number
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  totalQuestionsWithCorrectAnswers: number
}

const isLoading = ref(false)
const hasError = ref(false)
const leaderboard = ref<LeaderboardEntry[]>([])
const totalQuestionsWithCorrectAnswers = ref(0)
const isWinnerModalOpen = ref(false)
const selectedWinner = ref<LeaderboardEntry | null>(null)

const topRankedEntries = computed(() => leaderboard.value.filter(entry => entry.rank === 1))

/** Fetch leaderboard data from the API. */
async function fetchLeaderboard() {
  isLoading.value = true
  hasError.value = false
  isWinnerModalOpen.value = false
  selectedWinner.value = null
  try {
    const data = await $fetch<LeaderboardResponse>('/api/results/leaderboard')
    leaderboard.value = data.leaderboard
    totalQuestionsWithCorrectAnswers.value = data.totalQuestionsWithCorrectAnswers
  }
  catch (error: unknown) {
    logger_error('Failed to fetch leaderboard', error)
    hasError.value = true
    leaderboard.value = []
    totalQuestionsWithCorrectAnswers.value = 0
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchLeaderboard()
})

function openWinnerModal() {
  if (topRankedEntries.value.length === 0) return

  const randomIndex = Math.floor(Math.random() * topRankedEntries.value.length)
  selectedWinner.value = topRankedEntries.value[randomIndex] ?? null
  isWinnerModalOpen.value = selectedWinner.value !== null
}

function closeWinnerModal() {
  isWinnerModalOpen.value = false
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-5">
    <UiPageTitle>{{ t('title') }}</UiPageTitle>

    <div class="mb-5 flex items-center justify-between">
      <p class="text-sm text-gray-500">
        {{ t('scoredQuestions', { count: totalQuestionsWithCorrectAnswers }) }}
      </p>
      <div class="flex gap-2">
        <UiButton
          :disabled="isLoading || leaderboard.length === 0"
          size="small"
          @click="openWinnerModal"
        >
          {{ t('pickWinner') }}
        </UiButton>
        <UiButton
          :disabled="isLoading"
          size="small"
          variant="secondary"
          @click="fetchLeaderboard"
        >
          {{ t('refresh') }}
        </UiButton>
      </div>
    </div>

    <UiSection>
      <p v-if="isLoading" class="status-message">
        {{ t('loading') }}
      </p>

      <p
        v-else-if="hasError"
        class="status-message"
      >
        {{ t('error') }}
      </p>

      <p
        v-else-if="leaderboard.length === 0"
        class="status-message"
      >
        {{ t('empty') }}
      </p>

      <table v-else class="w-full border-collapse">
        <thead>
          <tr class="border-b-[3px] border-black text-left uppercase tracking-wide">
            <th class="p-3 text-center">
              {{ t('rank') }}
            </th>
            <th class="p-3">
              {{ t('player') }}
            </th>
            <th class="p-3 text-center">
              {{ t('correctAnswers') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in leaderboard"
            :key="entry.userId"
            class="border-b border-gray-300"
          >
            <td class="p-3 text-center text-xl font-bold">
              {{ entry.rank }}
            </td>
            <td class="p-3">
              {{ entry.nickname }}
              <span class="ml-1 text-xs text-gray-400">({{ entry.userId }})</span>
            </td>
            <td class="p-3 text-center text-xl font-bold">
              {{ entry.correctAnswers }}
            </td>
          </tr>
        </tbody>
      </table>
    </UiSection>

    <div
      v-if="isWinnerModalOpen && selectedWinner"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
      @click.self="closeWinnerModal"
    >
      <UiSection class="w-full max-w-md">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm uppercase tracking-wide text-gray-500">
              🏆
              {{ t('winnerTitle') }}
            </p>
            <h2 class="mt-2 text-3xl font-bold uppercase">
              {{ selectedWinner.nickname }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ selectedWinner.userId }}
            </p>
          </div>

          <UiButton
            size="small"
            variant="secondary"
            @click="closeWinnerModal"
          >
            {{ t('close') }}
          </UiButton>
        </div>

        <p class="mt-6 text-lg">
          {{ t('winnerScore', { count: selectedWinner.correctAnswers }) }}
        </p>
      </UiSection>
    </div>
  </div>
</template>

<i18n lang="yaml">
en:
  title: Leaderboard
  rank: Rank
  player: Player
  correctAnswers: Correct
  refresh: Refresh
  loading: Loading...
  empty: No answers submitted yet.
  error: Failed to load leaderboard. Please try again.
  scoredQuestions: "Questions with correct answers: {count}"
  pickWinner: Pick winner
  winnerTitle: Winner
  winnerScore: "Correct answers: {count}"
  close: Close
de:
  title: Bestenliste
  rank: Rang
  player: Spieler
  correctAnswers: Richtig
  refresh: Aktualisieren
  loading: Laden...
  empty: Noch keine Antworten eingereicht.
  error: Bestenliste konnte nicht geladen werden. Bitte erneut versuchen.
  scoredQuestions: "Fragen mit richtigen Antworten: {count}"
  pickWinner: Gewinner ziehen
  winnerTitle: Gewinner
  winnerScore: "Richtige Antworten: {count}"
  close: Schließen
ja:
  title: リーダーボード
  rank: 順位
  player: プレイヤー
  correctAnswers: 正解
  refresh: 更新
  loading: 読み込み中...
  empty: まだ回答が提出されていません。
  error: リーダーボードの読み込みに失敗しました。もう一度お試しください。
  scoredQuestions: "正解のある質問数: {count}"
  pickWinner: 勝者を選ぶ
  winnerTitle: 勝者
  winnerScore: "正解数: {count}"
  close: 閉じる
</i18n>

<style scoped>
@reference "tailwindcss";

.status-message {
  @apply py-10 text-center text-lg uppercase tracking-wide text-gray-400;
}
</style>
