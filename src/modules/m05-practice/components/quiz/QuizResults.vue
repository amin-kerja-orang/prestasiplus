<script setup lang="ts">
/**
 * The results state of the quiz in the v2 look (FR-M05-82…85; shells 5.3): `DsWinScreen` with the
 * trophy, the score ring and the friend's congratulation dialog below the score, then the figures
 * (score, percent, message, time, rewards) and the collapsible "Semakan Semula Jawapan". Display
 * only: the run state lives in `useQuizRun`.
 */
import { computed, onMounted, ref } from 'vue'

import { useFriend } from '@/composables/useFriend'
import {
  DsFloatScore,
  DsFriendAvatar,
  DsSpeechBubble,
  DsWinScreen,
  type WinSticker,
  DsStack,
  DsCluster,
  DsHeading,
  DsText,
} from '@/ds'

import { resultMessage, scoreBand } from './quiz-lib'
import type { QuizAnswerRecord, QuizLabels } from './quiz-types'

const props = defineProps<{
  labels: QuizLabels
  /** The subject name shown under the heading. */
  subjectName: string
  score: number
  total: number
  percent: number
  /** `MM:SS` taken. */
  timeText: string
  /** "{score} soalan salah berjaya diperbetulkan!" line (S7 only). */
  correctedLine: boolean
  gamification: {
    coinsEarned: number
    streakCount: number
    pointsEarned: number
    totalBalance: number
  } | null
  /** Bonus coins and points to fly over the rewards card (server total − what the questions showed). */
  bonusFly: { coins: number; points: number } | null
  answers: readonly QuizAnswerRecord[]
  backUrl: string
  /** No retry button (a completed test or mission cannot start again). */
  hideRetry?: boolean
}>()

const emit = defineEmits<{ retry: []; report: [questionId: number] }>()

const { friend, friendName } = useFriend()

const band = computed(() => scoreBand(props.percent))
const message = computed(() => resultMessage(props.percent, props.labels.messages))
const strong = computed(() => props.percent >= 60)
const expanded = ref(false)

const subtitle = computed(() =>
  props.subjectName ? `${props.subjectName} · ${message.value}` : message.value,
)

const friendLine = computed(() => {
  if (props.total > 0 && props.score === props.total) return 'Tahniah! Semua betul! 🎉'
  if (strong.value) return `Tahniah! Awak dapat ${props.score}/${props.total}. Hebat!`
  return 'Bagus sebab awak cuba. Jom ulang kaji soalan yang salah, awak pasti boleh! 💪'
})

const rewards = computed(() =>
  props.gamification
    ? [
        {
          id: 'mata',
          value: props.gamification.pointsEarned || 0,
          unit: 'Mata',
          art: 'bolt' as const,
        },
        {
          id: 'koin',
          value: props.gamification.coinsEarned || 0,
          unit: 'Koin',
          art: 'coin' as const,
        },
      ]
    : [],
)
const stickers = computed<WinSticker[]>(() =>
  props.gamification && props.gamification.streakCount > 0
    ? [{ id: 'streak', text: `Streak ${props.gamification.streakCount} hari!`, art: 'fire' }]
    : [],
)

const win = ref<{ focus: () => void } | null>(null)
onMounted(() => win.value?.focus())
</script>

<template>
  <DsStack data-testid="quiz-results">
    <DsWinScreen
      ref="win"
      title-testid="result-title"
      :art="strong ? 'trophy' : 'rocket'"
      :title="labels.resultTitle"
      :subtitle="subtitle"
      :score="score"
      :max="total"
      :ring-label="`Skor ${score} daripada ${total}`"
      :ring-unit="`daripada ${total}`"
      :rewards="rewards"
      :stickers="stickers"
      data-testid="result-win"
    >
      <template #friend>
        <DsFriendAvatar :friend="friend" :mood="strong ? 'celebrating' : 'encouraging'" size="md" />
        <DsSpeechBubble :name="friendName" live data-testid="result-friend">{{
          friendLine
        }}</DsSpeechBubble>
      </template>
      <template #actions>
        <UButton
          v-if="!hideRetry"
          variant="solid"
          size="lg"
          block
          icon="i-ph-arrow-counter-clockwise-bold"
          data-testid="result-retry"
          @click="emit('retry')"
          >{{ labels.retry }}</UButton
        >
        <UButton
          color="neutral"
          size="lg"
          block
          :to="backUrl"
          icon="i-ph-arrow-left-bold"
          data-testid="result-back"
          >{{ labels.back }}</UButton
        >
      </template>
    </DsWinScreen>

    <UCard>
      <DsStack gap="sm">
        <DsHeading :level="2" variant="subheading" data-testid="result-subject">
          {{ subjectName || labels.resultTitle }}
        </DsHeading>
        <DsCluster align="baseline">
          <DsText variant="title" as="span" tabular data-testid="result-score"
            >{{ score }}/{{ total }}</DsText
          >
          <span
            class="tabular text-heading"
            :class="
              band === 'high' ? 'text-success' : band === 'mid' ? 'text-warning' : 'text-error'
            "
            :data-band="band"
            data-testid="result-percent"
            >{{ percent }}%</span
          >
        </DsCluster>
        <UProgress
          :model-value="percent"
          :max="100"
          :aria-label="`Peratus betul ${percent}%`"
          data-testid="result-bar"
        />
        <DsText variant="body" tone="highlighted" data-testid="result-message">{{
          message
        }}</DsText>
        <p class="flex items-center gap-2 text-body text-muted" data-testid="result-time">
          <UIcon name="i-ph-clock-duotone" class="size-5" aria-hidden="true" />Masa diambil:
          {{ timeText }}
        </p>
        <p
          v-if="correctedLine && percent >= 50"
          class="flex items-center gap-2 text-body text-success"
          data-testid="result-corrected"
        >
          <UIcon name="i-ph-chart-line-up-duotone" class="size-5" aria-hidden="true" />
          <span>{{ score }} soalan salah berjaya diperbetulkan!</span>
        </p>
      </DsStack>
    </UCard>

    <UCard v-if="gamification" data-testid="result-rewards">
      <DsStack gap="sm" class="relative">
        <div
          v-if="bonusFly && (bonusFly.coins > 0 || bonusFly.points > 0)"
          class="absolute top-0 right-0 flex flex-col items-end gap-1"
          data-testid="coin-fly"
        >
          <DsFloatScore v-if="bonusFly.coins > 0" :text="`+${bonusFly.coins} Syiling`" />
          <DsFloatScore v-if="bonusFly.points > 0" :text="`+${bonusFly.points} Mata`" />
        </div>
        <DsHeading :level="2" variant="subheading">Ganjaran Anda</DsHeading>
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1 rounded-card bg-elevated p-3">
            <DsText variant="caption" as="dt">Syiling Diperoleh</DsText>
            <DsText variant="heading" as="dd" tabular data-testid="reward-coins">
              {{ gamification.coinsEarned || 0 }}
            </DsText>
          </div>
          <div class="flex flex-col gap-1 rounded-card bg-elevated p-3">
            <DsText variant="caption" as="dt">Kombo Semasa</DsText>
            <DsText variant="heading" as="dd" tabular data-testid="reward-streak">
              {{ gamification.streakCount || 0 }} hari
            </DsText>
          </div>
          <div class="flex flex-col gap-1 rounded-card bg-elevated p-3">
            <DsText variant="caption" as="dt">Mata Diperoleh</DsText>
            <DsText variant="heading" as="dd" tabular data-testid="reward-points">
              {{ gamification.pointsEarned || 0 }}
            </DsText>
          </div>
        </dl>
        <DsText variant="body" tone="muted">
          Baki syiling:
          <span class="tabular text-highlighted" data-testid="reward-balance">{{
            gamification.totalBalance || 0
          }}</span>
        </DsText>
      </DsStack>
    </UCard>

    <UCard data-testid="quiz-review">
      <DsStack gap="sm">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="min-h-11 justify-between"
          :trailing-icon="expanded ? 'i-ph-caret-up-bold' : 'i-ph-caret-down-bold'"
          icon="i-ph-list-checks-duotone"
          :aria-expanded="expanded ? 'true' : 'false'"
          data-testid="review-toggle"
          @click="expanded = !expanded"
          >Semakan Semula Jawapan</UButton
        >

        <DsStack v-show="expanded" gap="sm" data-testid="review-list">
          <article
            v-for="(answer, i) in answers"
            :key="answer.questionId"
            class="relative flex flex-col gap-2 overflow-hidden rounded-card bg-elevated p-3"
            :data-correct="answer.isCorrect ? 'true' : 'false'"
            data-testid="review-item"
          >
            <span
              class="pointer-events-none absolute inset-0"
              :class="answer.isCorrect ? 'bg-success-soft' : 'bg-error-soft'"
              aria-hidden="true"
            />
            <DsCluster align="start" :wrap="false" class="relative">
              <span
                class="inline-grid size-8 shrink-0 place-items-center rounded-full text-label font-extrabold text-on-sem"
                :class="answer.isCorrect ? 'bg-success' : 'bg-error'"
                >{{ i + 1 }}</span
              >
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <DsText variant="body" tone="highlighted" wrap="anywhere">{{
                  answer.questionText
                }}</DsText>
                <DsText variant="body">
                  <span class="text-muted">Jawapan anda:{{ ' ' }}</span>
                  <span class="break-words text-highlighted">{{ answer.selectedLabel }}</span>
                  <span class="sr-only">{{ answer.isCorrect ? ' (betul)' : ' (salah)' }}</span>
                </DsText>
                <DsText v-if="!answer.isCorrect" variant="body">
                  <span class="text-muted">Jawapan betul:{{ ' ' }}</span>
                  <span class="break-words text-highlighted">{{ answer.correctLabel }}</span>
                </DsText>
                <DsText v-if="answer.explanation" variant="body">
                  <span class="text-muted">Penjelasan:</span> {{ answer.explanation }}
                </DsText>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="min-h-11 self-start"
                  icon="i-ph-flag-duotone"
                  data-testid="review-report"
                  @click="emit('report', answer.questionId)"
                  >Lapor soalan ini</UButton
                >
              </div>
              <UIcon
                :name="answer.isCorrect ? 'i-ph-check-circle-duotone' : 'i-ph-x-circle-duotone'"
                class="size-6 shrink-0"
                :class="answer.isCorrect ? 'text-success' : 'text-error'"
                aria-hidden="true"
              />
            </DsCluster>
          </article>
        </DsStack>
      </DsStack>
    </UCard>
  </DsStack>
</template>
