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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { DsFeedbackSheet, DsFloatScore, DsQuizHeader, DsQuizOption } from '@/ds'
import { ReportQuestionModal } from '@/modules/m04-question-bank'

import { checkAnswer, startSession, submitSession } from '../../api/practice'
import type { StartSessionRequest, StartSessionResponse } from '../../api/types'
import { PRACTICE_LABELS } from './quiz-labels'
import {
  comboOf,
  dsOptionState,
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
import QuizLoading from './QuizLoading.vue'
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
    window.alert(plan.message)
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
// --- v2 quiz kit: combo chip, exit, the feedback sheet's continue button
const combo = computed(() => comboOf(answers.value))
/** Jawi (rtl) and mixed-script text keeps the Arabic-script font. */
function jawi(q: { textDirection?: string; scriptType?: string }): boolean {
  return q.textDirection === 'rtl' || q.scriptType === 'mixed'
}
function leave(): void {
  void router.push(props.backUrl)
}
const nextLabel = computed(() => (isLast.value ? 'Lihat Keputusan' : 'Soalan Seterusnya'))
const feedbackExplanation = computed(() =>
  result.value?.explanation ? `Penjelasan: ${result.value.explanation}` : undefined,
)
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-muted text-default"
      data-testid="quiz-runner"
      :data-phase="phase"
    >
      <div class="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <!-- Loading -->
        <QuizLoading
          v-if="phase === 'loading'"
          :title="labels.loadingTitle"
          :text="labels.loadingText"
          data-testid="quiz-loading"
        />

        <!-- Quiz -->
        <template v-else-if="phase === 'quiz'">
          <div class="flex flex-col gap-3" data-testid="quiz-body">
            <DsQuizHeader
              close-label="Keluar latihan"
              :progress="progressPct"
              progress-label="Kemajuan latihan"
              :combo="combo"
              combo-label="Kombo"
              data-testid="quiz-header"
              @close="leave"
            />
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 flex-col gap-1">
                <h1 class="text-subheading break-words text-highlighted" data-testid="quiz-title">
                  {{ title }}
                </h1>
                <p class="text-caption text-muted" data-testid="quiz-progress-text">
                  Soalan {{ index + 1 }} daripada {{ total }}
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-end">
                <span class="tabular text-heading text-highlighted" data-testid="quiz-timer">{{
                  timeText
                }}</span>
                <span class="text-caption text-muted">Masa</span>
              </div>
            </div>

            <div v-if="revisionChips" class="flex flex-wrap items-center gap-2">
              <UBadge
                color="warning"
                variant="solid"
                size="lg"
                icon="i-ph-arrow-counter-clockwise-bold"
                data-testid="chip-revision"
                >Mode Ulang Kaji — soalan ini pernah dijawab salah</UBadge
              >
              <UBadge
                v-if="revisionMeta"
                color="error"
                variant="solid"
                size="lg"
                icon="i-ph-warning-circle-bold"
                data-testid="chip-revision-meta"
                >{{ revisionMeta.selected }} daripada {{ revisionMeta.totalWrong }} soalan
                salah</UBadge
              >
            </div>
          </div>

          <UCard v-if="current" data-testid="quiz-question">
            <div class="flex flex-col gap-4">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="primary" variant="solid" size="lg" icon="i-ph-question-bold"
                  >Soalan {{ index + 1 }}</UBadge
                >
                <UBadge
                  v-if="revisionChips && current.wrongTimes > 1"
                  color="error"
                  variant="solid"
                  size="lg"
                  icon="i-ph-x-circle-bold"
                  data-testid="pill-wrong-times"
                  >Salah {{ current.wrongTimes }}x</UBadge
                >
                <UBadge
                  v-if="current.hasDskp"
                  color="success"
                  variant="solid"
                  size="lg"
                  icon="i-ph-check-circle-bold"
                  data-testid="pill-dskp"
                  >Mengikut DSKP</UBadge
                >
                <UBadge
                  v-else
                  color="neutral"
                  variant="soft"
                  size="lg"
                  icon="i-ph-book-open-text-bold"
                  data-testid="pill-extra"
                  >Latihan Tambahan</UBadge
                >
              </div>

              <h2
                class="text-heading break-words text-highlighted"
                :class="jawi(current) && 'font-jawi leading-loose'"
                :dir="current.textDirection || 'ltr'"
                data-testid="question-text"
              >
                {{ current.questionText }}
              </h2>

              <p
                v-if="current.contributor"
                class="flex flex-wrap items-center gap-2 text-caption text-muted"
                data-testid="question-contributor"
              >
                <UIcon name="i-ph-chalkboard-teacher-duotone" class="size-5" aria-hidden="true" />
                <span>
                  Soalan oleh:
                  <a
                    v-if="contributorHref"
                    :href="contributorHref"
                    class="text-highlighted underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ current.contributor.name }}</a
                  >
                  <span v-else class="text-highlighted">{{ current.contributor.name }}</span>
                </span>
              </p>

              <div class="flex flex-col gap-3" data-testid="question-options">
                <DsQuizOption
                  v-for="option in current.options"
                  :key="option.id"
                  :letter="option.label"
                  :state="dsOptionState(optionState(option.id, selected, checkedState))"
                  :class="jawi(current) && 'font-jawi'"
                  :dir="current.textDirection || 'ltr'"
                  :data-testid="`option-${option.label}`"
                  @select="run.select(option.id)"
                  >{{ option.text }}</DsQuizOption
                >
              </div>

              <UButton
                v-if="!result && selected !== null"
                variant="solid"
                size="lg"
                block
                class="min-h-14"
                icon="i-ph-check-bold"
                data-testid="btn-check"
                @click="run.check()"
                >Semak Jawapan</UButton
              >
            </div>
          </UCard>

          <div v-if="result && current" class="relative flex flex-col gap-3">
            <div
              v-if="showFly"
              :key="flyKey"
              class="pointer-events-none absolute -top-8 right-4"
              data-testid="coin-fly"
            >
              <DsFloatScore text="+10" />
            </div>
            <DsFeedbackSheet
              :testids="{
                continue: 'btn-next',
                title: 'feedback-title',
                body: 'feedback-text',
                ai: 'feedback-explanation',
              }"
              :tone="result.isCorrect ? 'good' : 'bad'"
              :title="result.isCorrect ? labels.correctTitle : labels.wrongTitle"
              :body="result.feedback || undefined"
              :ai-line="feedbackExplanation"
              :combo="result.isCorrect ? '+10' : undefined"
              :continue-label="nextLabel"
              :data-correct="result.isCorrect ? 'true' : 'false'"
              data-testid="quiz-feedback"
              @continue="run.next()"
            />
            <UButton
              color="neutral"
              variant="ghost"
              class="min-h-11 self-end"
              icon="i-ph-flag-duotone"
              data-testid="btn-report"
              @click="openReport(current.id)"
              >Lapor Soalan</UButton
            >
          </div>
        </template>

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
      </div>

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
  </Teleport>
</template>
