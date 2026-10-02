<script setup lang="ts">
/**
 * `QuizRunner` — the reusable quiz screen of Q1, Q2, S7, Q4–Q6 and the M06 SPM quiz pages (SRS M05
 * v1.19 §7.1 XL-10, FR-M05-51…56, FR-M05-75…88; build-plan M05-T4). The markup, states and behaviour
 * are those of the captured S7 page; hosts only pass data and labels.
 *
 * Input: either `start` (the request body of §7 #4; the runner starts the session on mount and shows
 * the loading state) or `session` (a session the host already started). Callbacks: `api` replaces the
 * three session calls (#4 start, #5 check, #6 submit; default = the M05 client), `report` configures
 * the M04 `ReportQuestionModal`. Events: `loaded`, `start-error`, `checked`, `completed`, `retry`.
 *
 * `start`, `session`, `api` and `retry` are read once, when the run begins (mount and "retry"): a host
 * that changes them must re-key the component (`:key`) to start a new run. In session mode (`session`
 * without `start`) "retry" only emits `retry`; the host must restart the run (new session, new key).
 *
 * `hideRetry` removes the retry button of the results (Q4 and Q5, where a restart would be a 409).
 *
 * A start failure is handled here (FR-M05-48, 51, 66, 75): 402 → `/pricing` and 409 `CHAPTER_LOCKED`
 * → `lockedUrl` (both without a message), 404 → the global 404 page, anything else `alert(message)`
 * and back to `backUrl`.
 */
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  Flag,
  Lightbulb,
  Presentation,
  RotateCw,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { alertNative } from '@/components/overlay/native-dialogs'
import { ReportQuestionModal } from '@/modules/m04-question-bank'

import { checkAnswer, startSession, submitSession } from '../../api/practice'
import type { StartSessionRequest, StartSessionResponse } from '../../api/types'
import CoinFly from './CoinFly.vue'
import { PRACTICE_LABELS } from './quiz-labels'
import {
  OPTION_BOX_CLASS,
  OPTION_TEXT_CLASS,
  OPTION_TILE_CLASS,
  formatTime,
  optionState,
  planStartError,
  safeHref,
} from './quiz-lib'
import type {
  QuizApi,
  QuizCompletedEvent,
  QuizLabels,
  QuizReportConfig,
  QuizStartErrorEvent,
} from './quiz-types'
import QuizResults from './QuizResults.vue'
import { useQuizRun } from './useQuizRun'

const DEFAULT_API: QuizApi = {
  start: startSession,
  check: checkAnswer,
  submit: submitSession,
}

/** S7 tints of the report reasons when ticked (FR-M05-88; the M04 defaults differ for two reasons). */
const DEFAULT_TINTS: NonNullable<QuizReportConfig['tints']> = {
  wrong_answer: 'red',
  confusing_question: 'amber',
  wrong_options: 'orange',
  missing_options: 'yellow',
  duplicate: 'blue',
  typo: 'indigo',
  other: 'slate',
}

const props = withDefaults(
  defineProps<{
    /** Request body of #4; the runner starts the session on mount. */
    start?: StartSessionRequest | null
    /** A session the host already started (skips #4). */
    session?: StartSessionResponse | null
    /** The title in the header card; a function gets the started session (e.g. the subject name). */
    headerTitle: string | ((session: StartSessionResponse) => string)
    labels?: Partial<QuizLabels>
    /** "Mode Ulang Kaji …" chips and "Salah {n}x" (S7 only). */
    revisionChips?: boolean
    /** "{score} soalan salah berjaya diperbetulkan!" (S7 only). */
    correctedLine?: boolean
    /** The host list ("Senarai Subjek" / "Kembali") and the target after a start error. */
    backUrl: string
    /** Target of 409 `CHAPTER_LOCKED` (default `backUrl`). */
    lockedUrl?: string
    /** `reload` (S7) and `restart` (Q1/Q2) both start a new session in place; `restart` needs `start`. */
    retry?: 'reload' | 'restart'
    report: QuizReportConfig
    api?: QuizApi
    /** Colour of the loading spinner (S7 BM: the subject colour). */
    accentColor?: string
    /** No "Ulang Lagi" button on the results (Q4 remedial, Q5 mission: a restart would be a 409). */
    hideRetry?: boolean
  }>(),
  {
    start: null,
    session: null,
    labels: undefined,
    revisionChips: false,
    correctedLine: false,
    lockedUrl: undefined,
    retry: 'restart',
    api: undefined,
    accentColor: '#3B82F6',
    hideRetry: false,
  },
)

const emit = defineEmits<{
  loaded: [e: { sessionId: string; questionCount: number; session: StartSessionResponse }]
  'start-error': [e: QuizStartErrorEvent]
  checked: [e: { questionId: number; isCorrect: boolean }]
  completed: [e: QuizCompletedEvent]
  retry: []
}>()

const router = useRouter()
const labels = computed<QuizLabels>(() => ({ ...PRACTICE_LABELS, ...props.labels }))

function scrollTop(): void {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    /* no layout engine (unit tests) */
  }
}

function onStartError(err: unknown): void {
  const e = err as { status?: number; code?: string; message?: string }
  emit('start-error', {
    status: typeof e.status === 'number' ? e.status : 0,
    code: typeof e.code === 'string' ? e.code : '',
    message: typeof e.message === 'string' ? e.message : '',
  })
  const plan = planStartError(err, labels.value)
  if (plan.kind === 'pricing') void router.replace('/pricing')
  else if (plan.kind === 'locked') void router.replace(props.lockedUrl ?? props.backUrl)
  else if (plan.kind === 'not-found') setRouteOutcome(404)
  else {
    alertNative(plan.message)
    void router.replace(props.backUrl)
  }
}

const run = useQuizRun({
  api: props.api ?? DEFAULT_API,
  startBody: () => props.start,
  readySession: () => props.session,
  loaded: (e) => emit('loaded', e),
  startError: onStartError,
  checked: (e) => emit('checked', e),
  completed: (e) => emit('completed', e),
  showedResults: scrollTop,
})

const {
  phase,
  session: active,
  index,
  selected,
  result,
  score,
  answers,
  clock,
  elapsed,
  gamification,
  coinsCollected,
  pointsCollected,
  questions,
  current,
  total,
  percent,
  isLast,
} = run

onMounted(() => void run.begin())

function onRetry(): void {
  if (!props.start && !props.session) return
  if (props.start) void run.begin()
  else emit('retry')
}

const title = computed(() =>
  typeof props.headerTitle === 'function'
    ? active.value
      ? props.headerTitle(active.value)
      : ''
    : props.headerTitle,
)
const subjectName = computed(() => active.value?.subject?.name ?? '')
const timeText = computed(() => formatTime(clock.value))
const takenText = computed(() => formatTime(elapsed.value))
const progressPct = computed(() => (total.value > 0 ? ((index.value + 1) / total.value) * 100 : 0))
const revisionMeta = computed(() => active.value?.revisionMeta ?? null)
const contributorHref = computed(() => safeHref(current.value?.contributor?.profileUrl))
const tints = computed(() => props.report.tints ?? DEFAULT_TINTS)

// --- reward animation (live JBCoinFly): +1 syiling / +10 mata 300 ms after a correct check, bonus 400 ms after submit.
const flyKey = ref(0)
const showFly = ref(false)
const bonusFly = ref<{ coins: number; points: number } | null>(null)
const timers: ReturnType<typeof setTimeout>[] = []

watch(result, (r) => {
  showFly.value = false
  if (r?.isCorrect) {
    timers.push(
      setTimeout(() => {
        flyKey.value += 1
        showFly.value = true
      }, 300),
    )
  }
})
watch(gamification, (g) => {
  if (!g) return
  const coins = Math.max(0, (g.coinsEarned || 0) - coinsCollected.value)
  const points = Math.max(0, (g.pointsEarned || 0) - pointsCollected.value)
  timers.push(setTimeout(() => (bonusFly.value = { coins, points }), 400))
})
function clearFly(): void {
  timers.forEach(clearTimeout)
  timers.length = 0
  showFly.value = false
  bonusFly.value = null
}
// A restart goes back to loading: no stale reward animation on the next run.
watch(phase, (p) => {
  if (p === 'loading') clearFly()
})
onBeforeUnmount(() => timers.forEach(clearTimeout))

// --- report modal
const reportOpen = ref(false)
const reportQuestionId = ref<number | null>(null)
function openReport(questionId: number): void {
  reportQuestionId.value = questionId
  reportOpen.value = true
}

const checkedState = computed(() =>
  result.value
    ? { correctOptionId: result.value.correctOptionId, isCorrect: result.value.isCorrect }
    : null,
)
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-4 sm:py-8" data-testid="quiz-runner" :data-phase="phase">
    <!-- Loading -->
    <div v-if="phase === 'loading'" class="mx-auto max-w-2xl" data-testid="quiz-loading">
      <div class="rounded-2xl bg-white p-12 text-center shadow-lg">
        <div class="relative mx-auto mb-3 h-16 w-16 sm:mb-6 sm:h-24 sm:w-24">
          <div class="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div
            class="absolute inset-0 animate-spin rounded-full border-4 border-transparent"
            :style="{ borderTopColor: accentColor }"
          ></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <RotateCw class="h-9 w-9" :style="{ color: accentColor }" />
          </div>
        </div>
        <h2 class="mb-2 text-sm font-bold text-slate-800 sm:text-2xl">{{ labels.loadingTitle }}</h2>
        <p class="text-slate-500">{{ labels.loadingText }}</p>
      </div>
    </div>

    <!-- Quiz -->
    <div v-else-if="phase === 'quiz'" class="mx-auto" data-testid="quiz-body">
      <div class="mb-3 rounded-2xl bg-white p-4 shadow-md sm:mb-6 sm:p-6">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-orange-400"
            >
              <RotateCw class="h-5 w-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="text-xl font-bold break-words text-slate-800" data-testid="quiz-title">
                {{ title }}
              </h2>
              <p class="text-sm text-slate-500" data-testid="quiz-progress-text">
                Soalan {{ index + 1 }} daripada {{ total }}
              </p>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div
              class="font-mono text-xl font-bold text-orange-600 sm:text-3xl"
              data-testid="quiz-timer"
            >
              {{ timeText }}
            </div>
            <p class="text-xs text-slate-500">Masa</p>
          </div>
        </div>

        <div class="relative h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 ease-out"
            :style="{ width: `${String(progressPct)}%` }"
            data-testid="quiz-progress-bar"
          ></div>
        </div>

        <div v-if="revisionChips" class="mt-4 space-y-2">
          <div
            class="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700"
            data-testid="chip-revision"
          >
            <RotateCw class="h-3.5 w-3.5 shrink-0" />
            Mode Ulang Kaji — soalan ini pernah dijawab salah
          </div>
          <div v-if="revisionMeta">
            <div
              class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
              data-testid="chip-revision-meta"
            >
              <CircleAlert class="h-3.5 w-3.5 shrink-0" />
              <span
                >{{ revisionMeta.selected }} daripada {{ revisionMeta.totalWrong }} soalan
                salah</span
              >
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="current"
        :class="[
          'mb-3 rounded-2xl bg-white p-4 shadow-md transition-all duration-300 sm:mb-6 sm:p-8',
          result ? 'scale-[0.98]' : 'scale-100',
        ]"
        data-testid="quiz-question"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2 sm:mb-6">
          <div
            class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <RotateCw class="h-4 w-4" />
            <span>Soalan {{ index + 1 }}</span>
          </div>
          <span
            v-if="revisionChips && current.wrongTimes > 1"
            class="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700"
            data-testid="pill-wrong-times"
          >
            <CircleX class="h-3 w-3" />
            Salah {{ current.wrongTimes }}x
          </span>
          <span
            v-if="current.hasDskp"
            class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
            data-testid="pill-dskp"
          >
            <CircleCheck class="h-3.5 w-3.5 text-emerald-500" /> Mengikut DSKP
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500"
            data-testid="pill-extra"
          >
            <BookOpen class="h-3.5 w-3.5 text-slate-400" /> Latihan Tambahan
          </span>
        </div>

        <h3
          :class="[
            'mb-4 text-sm leading-relaxed font-bold break-words text-slate-800 sm:text-2xl',
            current.textDirection === 'rtl' ? 'rtl-content' : '',
            current.scriptType === 'mixed' ? 'mixed-content' : '',
          ]"
          :dir="current.textDirection || 'ltr'"
          data-testid="question-text"
        >
          {{ current.questionText }}
        </h3>

        <div
          v-if="current.contributor"
          class="mb-6 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2"
          data-testid="question-contributor"
        >
          <Presentation class="h-4 w-4 shrink-0 text-teal-500" />
          <span class="text-xs text-teal-700">
            Soalan oleh:
            <a
              v-if="contributorHref"
              :href="contributorHref"
              class="font-bold text-teal-800 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              >{{ current.contributor.name }}</a
            >
            <span v-else class="font-bold text-teal-800">{{ current.contributor.name }}</span>
          </span>
        </div>

        <div class="space-y-4" data-testid="question-options">
          <button
            v-for="option in current.options"
            :key="option.id"
            type="button"
            :disabled="result !== null"
            :class="[
              'relative min-h-11 w-full overflow-hidden rounded-xl border-2 p-5 text-left transition-all duration-300',
              OPTION_BOX_CLASS[optionState(option.id, selected, checkedState)],
            ]"
            :data-state="optionState(option.id, selected, checkedState)"
            :data-testid="`option-${option.label}`"
            @click="run.select(option.id)"
          >
            <div class="relative flex items-center gap-4">
              <div
                :class="[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold',
                  OPTION_TILE_CLASS[optionState(option.id, selected, checkedState)],
                ]"
              >
                {{ option.label }}
              </div>
              <div class="min-w-0 grow">
                <p
                  :class="[
                    'text-sm font-medium break-words sm:text-lg',
                    OPTION_TEXT_CLASS[optionState(option.id, selected, checkedState)],
                  ]"
                >
                  {{ option.text }}
                </p>
              </div>
              <div
                v-if="optionState(option.id, selected, checkedState) === 'correct'"
                class="shrink-0"
              >
                <CircleCheck class="h-6 w-6 text-green-500" />
              </div>
              <div
                v-else-if="optionState(option.id, selected, checkedState) === 'wrong'"
                class="shrink-0"
              >
                <CircleX class="h-6 w-6 text-red-500" />
              </div>
            </div>
          </button>
        </div>

        <div class="mt-8 flex justify-end gap-4">
          <button
            v-if="!result && selected !== null"
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-8 py-3 font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/30"
            data-testid="btn-check"
            @click="run.check()"
          >
            <Check class="mr-2 h-4 w-4" />
            Semak Jawapan
          </button>

          <button
            v-if="result"
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-8 py-3 font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
            data-testid="btn-next"
            @click="run.next()"
          >
            <template v-if="!isLast">
              Soalan Seterusnya
              <ArrowRight class="ml-2 h-4 w-4" />
            </template>
            <template v-else>
              Lihat Keputusan
              <Flag class="ml-2 h-4 w-4" />
            </template>
          </button>
        </div>
      </div>

      <div v-if="result && current" class="mb-4 flex justify-end">
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
          data-testid="btn-report"
          @click="openReport(current.id)"
        >
          <Flag class="h-3.5 w-3.5" /> Lapor Soalan
        </button>
      </div>

      <div
        v-if="result"
        :class="[
          'relative rounded-2xl border-2 p-4 shadow-md sm:p-6',
          result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
        ]"
        :data-correct="result.isCorrect ? 'true' : 'false'"
        data-testid="quiz-feedback"
      >
        <CoinFly v-if="showFly" :key="flyKey" :coins="1" :points="10" />
        <div class="flex items-start gap-4">
          <div
            :class="[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
              result.isCorrect ? 'bg-green-100' : 'bg-red-100',
            ]"
          >
            <Check v-if="result.isCorrect" class="h-6 w-6 text-green-600" />
            <X v-else class="h-6 w-6 text-red-600" />
          </div>
          <div class="min-w-0 grow">
            <h4
              :class="[
                'mb-2 text-xl font-bold',
                result.isCorrect ? 'text-green-700' : 'text-red-700',
              ]"
              data-testid="feedback-title"
            >
              {{ result.isCorrect ? labels.correctTitle : labels.wrongTitle }}
            </h4>
            <p class="mb-3 break-words text-slate-700" data-testid="feedback-text">
              {{ result.feedback }}
            </p>
            <div
              v-if="result.explanation"
              class="rounded-lg border border-gray-200 bg-gray-50 p-4"
              data-testid="feedback-explanation"
            >
              <p class="mb-1 text-sm text-slate-600">
                <Lightbulb class="mr-2 inline h-4 w-4 align-[-3px] text-yellow-500" />Penjelasan:
              </p>
              <p class="break-words text-slate-700">{{ result.explanation }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <QuizResults
      v-else
      :labels="labels"
      :subject-name="subjectName"
      :score="score"
      :total="questions.length"
      :percent="percent"
      :time-text="takenText"
      :corrected-line="correctedLine"
      :gamification="gamification"
      :bonus-fly="bonusFly"
      :answers="answers"
      :back-url="backUrl"
      :hide-retry="hideRetry"
      @retry="onRetry"
      @report="openReport"
    />

    <ReportQuestionModal
      v-if="reportQuestionId !== null && active"
      v-model:open="reportOpen"
      :question-id="reportQuestionId"
      variant="mcq"
      :quiz-session-id="active.sessionId"
      :source="report.source"
      :failure-text="report.failureText"
      :tints="tints"
    />
  </div>
</template>
