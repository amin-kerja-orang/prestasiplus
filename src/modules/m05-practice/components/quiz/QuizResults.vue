<script setup lang="ts">
/**
 * The results state of the quiz (FR-M05-82…85; S7 markup): score card, "Ganjaran Anda" and the
 * collapsible "Semakan Semula Jawapan". Display only: the run state lives in `useQuizRun`.
 */
import {
  ArrowLeft,
  ChartLine,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  Clock,
  Flag,
  Gift,
  Lightbulb,
  ListChecks,
  RotateCw,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import CoinFly from './CoinFly.vue'
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

const band = computed(() => scoreBand(props.percent))
const message = computed(() => resultMessage(props.percent, props.labels.messages))
const expanded = ref(false)

const PERCENT_CLASS = {
  high: 'text-green-600',
  mid: 'text-yellow-600',
  low: 'text-red-600',
} as const
const BAR_CLASS = {
  high: 'bg-gradient-to-r from-green-500 to-emerald-500',
  mid: 'bg-gradient-to-r from-yellow-500 to-orange-500',
  low: 'bg-gradient-to-r from-red-500 to-pink-500',
} as const
</script>

<template>
  <div class="mx-auto" data-testid="quiz-results">
    <div
      class="relative mb-3 overflow-hidden rounded-2xl bg-white p-12 text-center shadow-xl sm:mb-6"
    >
      <div class="relative z-10">
        <div class="mb-4">
          <div
            class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-orange-400"
          >
            <RotateCw class="h-10 w-10 text-white" />
          </div>
        </div>

        <h2 class="mb-2 text-xl font-bold text-slate-800 sm:text-3xl" data-testid="result-title">
          {{ labels.resultTitle }}
        </h2>
        <p class="mb-3 text-slate-500 sm:mb-6" data-testid="result-subject">{{ subjectName }}</p>

        <div class="mb-6">
          <div
            class="mb-2 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-4xl font-bold text-transparent sm:text-7xl"
            data-testid="result-score"
          >
            {{ score }}/{{ total }}
          </div>
          <div
            :class="['text-xl font-semibold sm:text-3xl', PERCENT_CLASS[band]]"
            :data-band="band"
            data-testid="result-percent"
          >
            {{ percent }}%
          </div>
        </div>

        <div class="mb-6">
          <p
            class="mb-2 text-sm font-semibold text-slate-800 sm:text-2xl"
            data-testid="result-message"
          >
            {{ message }}
          </p>
          <p class="text-slate-600" data-testid="result-time">
            <Clock class="mr-2 inline h-4 w-4 align-[-2px]" />Masa diambil: {{ timeText }}
          </p>
        </div>

        <div v-if="correctedLine && percent >= 50" class="mb-6" data-testid="result-corrected">
          <div
            class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
          >
            <ChartLine class="h-4 w-4 shrink-0" />
            <span>{{ score }} soalan salah berjaya diperbetulkan!</span>
          </div>
        </div>

        <div class="mx-auto mb-4 max-w-md sm:mb-8">
          <div class="h-4 overflow-hidden rounded-full bg-gray-200">
            <div
              :class="[
                'h-full rounded-full transition-all duration-1000 ease-out',
                BAR_CLASS[band],
              ]"
              :style="{ width: `${String(percent)}%` }"
              data-testid="result-bar"
            ></div>
          </div>
        </div>

        <div class="flex flex-wrap justify-center gap-4">
          <button
            v-if="!hideRetry"
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-8 py-3 font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
            data-testid="result-retry"
            @click="emit('retry')"
          >
            <RotateCw class="mr-2 h-4 w-4" />{{ labels.retry }}
          </button>
          <RouterLink
            :to="backUrl"
            class="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-300 px-8 py-3 font-semibold text-slate-700 transition-all duration-300 hover:scale-105 hover:border-orange-500 hover:bg-orange-50"
            data-testid="result-back"
          >
            <ArrowLeft class="mr-2 h-4 w-4" />{{ labels.back }}
          </RouterLink>
        </div>
      </div>
    </div>

    <div
      v-if="gamification"
      class="relative mb-3 rounded-2xl bg-white p-4 shadow-xl sm:mb-6 sm:p-8"
      data-testid="result-rewards"
    >
      <CoinFly
        v-if="bonusFly && (bonusFly.coins > 0 || bonusFly.points > 0)"
        :coins="bonusFly.coins"
        :points="bonusFly.points"
      />
      <h3 class="mb-3 text-center text-sm font-bold text-slate-800 sm:mb-6 sm:text-2xl">
        <Gift class="mr-2 inline h-5 w-5 align-[-3px] text-orange-500" />Ganjaran Anda
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <div class="mb-2 text-4xl">🪙</div>
          <div class="text-xl font-bold text-amber-600 sm:text-3xl" data-testid="reward-coins">
            {{ gamification.coinsEarned || 0 }}
          </div>
          <div class="text-sm font-medium text-amber-700">Syiling Diperoleh</div>
        </div>
        <div class="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
          <div class="mb-2 text-4xl">🔥</div>
          <div class="text-xl font-bold text-orange-600 sm:text-3xl" data-testid="reward-streak">
            {{ gamification.streakCount || 0 }} hari
          </div>
          <div class="text-sm font-medium text-orange-700">Kombo Semasa</div>
        </div>
        <div class="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
          <div class="mb-2 text-4xl">⭐</div>
          <div class="text-xl font-bold text-purple-600 sm:text-3xl" data-testid="reward-points">
            {{ gamification.pointsEarned || 0 }}
          </div>
          <div class="text-sm font-medium text-purple-700">Mata Diperoleh</div>
        </div>
      </div>
      <div class="mt-4 text-center text-sm text-slate-600">
        Baki syiling:
        <span class="font-bold text-amber-600" data-testid="reward-balance">{{
          gamification.totalBalance || 0
        }}</span>
        🪙
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-md sm:p-6" data-testid="quiz-review">
      <button
        type="button"
        class="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        data-testid="review-toggle"
        @click="expanded = !expanded"
      >
        <h3 class="text-lg font-bold text-slate-800 sm:text-xl">
          <ListChecks class="mr-2 inline h-5 w-5 align-[-3px] text-orange-600" />Semakan Semula
          Jawapan
        </h3>
        <component
          :is="expanded ? ChevronUp : ChevronDown"
          class="h-5 w-5 shrink-0 text-slate-500"
        />
      </button>

      <div v-show="expanded" class="mt-6 space-y-4" data-testid="review-list">
        <div
          v-for="(answer, i) in answers"
          :key="answer.questionId"
          :class="[
            'rounded-lg border-2 p-4',
            answer.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
          ]"
          :data-correct="answer.isCorrect ? 'true' : 'false'"
          data-testid="review-item"
        >
          <div class="mb-3 flex items-start gap-3">
            <div
              :class="[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                answer.isCorrect ? 'bg-green-500' : 'bg-red-500',
              ]"
            >
              {{ i + 1 }}
            </div>
            <div class="min-w-0 grow">
              <p class="mb-2 font-medium break-words text-slate-800">{{ answer.questionText }}</p>
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="text-slate-600">Jawapan anda:</span>
                <span
                  :class="[
                    'font-semibold break-words',
                    answer.isCorrect ? 'text-green-700' : 'text-red-700',
                  ]"
                  >{{ answer.selectedLabel }}</span
                >
                <span v-if="!answer.isCorrect" class="text-slate-600">
                  | Jawapan betul:
                  <span class="font-semibold break-words text-green-700">{{
                    answer.correctLabel
                  }}</span>
                </span>
              </div>
            </div>
            <div class="shrink-0">
              <CircleCheck v-if="answer.isCorrect" class="h-5 w-5 text-green-500" />
              <CircleX v-else class="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div
            v-if="answer.explanation"
            class="ml-11 rounded border border-gray-200 bg-gray-50 p-3"
          >
            <p class="mb-1 text-sm text-slate-600">
              <Lightbulb class="mr-1 inline h-4 w-4 align-[-3px] text-yellow-500" />Penjelasan:
            </p>
            <p class="text-sm break-words text-slate-700">{{ answer.explanation }}</p>
          </div>
          <div class="mt-2 ml-11">
            <button
              type="button"
              class="inline-flex min-h-11 items-center text-xs text-red-500 transition-colors hover:text-red-700 hover:underline"
              data-testid="review-report"
              @click="emit('report', answer.questionId)"
            >
              <Flag class="mr-1 h-3.5 w-3.5" /> Lapor soalan ini
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
