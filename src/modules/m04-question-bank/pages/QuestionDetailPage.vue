<script setup lang="ts">
/**
 * S3 `/admin/questions/:id` "Lihat Soalan" (M04-T3; FR-M04-37..47).
 *
 * Back link, header with "Edit" and "Padam" (native confirm, then the list with the API `status`
 * flash), then 2/3 + 1/3 from `lg`: cards "Soalan", "Pilihan Jawapan" (or the answer card of another
 * type), "Penjelasan", "Penjelasan AI"; sidebar "Maklumat", the usage card and the status quick
 * actions. An unknown id is the standard 404; another load failure is a red box with "Cuba Semula".
 */
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  CircleCheck,
  CircleQuestionMark,
  Coins,
  GraduationCap,
  Info,
  Languages,
  Layers,
  Lightbulb,
  ListChecks,
  SquarePen,
  Star,
  Tag,
  Trash,
  Book,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox } from '@/components/feedback'
import { confirmNative, useApi, useFlash } from '@/composables'
import { formatDateTime } from '@/lib/time'

import { bulkQuestionAction, deleteQuestion, fetchQuestion } from '../api'
import AiExplanationCard from '../components/AiExplanationCard.vue'
import {
  cut,
  DELETE_CONFIRM,
  LANGUAGE_LABELS,
  QUESTIONS_LIST_PATH,
  questionEditPath,
  STATUS_CONFIRM,
  statusClass,
  statusLabel,
  TYPE_ANSWER_HEADINGS,
} from '../lib/question-list'
import { imageSrc } from '../lib/image-url'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const {
  data: question,
  error,
  reload,
} = useApi(
  (signal) => fetchQuestion(props.id, { signal }),
  () => props.id,
)

/** An unknown id is the standard 404 page (module decision); other load failures keep the red box. */
const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const isPksk = computed(() => question.value?.pkskDomainId != null)
const isMcq = computed(() => question.value?.questionType === 'mcq')
const mcqOptions = computed(() => {
  const q = question.value
  if (!q?.options) return []
  return q.options
    .map((text, i) => ({
      letter: LETTERS[i] ?? '',
      text,
      image: q.optionImages[i] ?? null,
      correct: q.correctAnswer === i,
    }))
    .filter((o) => o.text !== '' || o.image !== null)
})
const pkskOptions = computed(() =>
  (question.value?.pkskOptions ?? []).map((o, i) => ({
    letter: LETTERS[i] ?? '',
    text: o.text,
    image: null as string | null,
    correct: o.isCorrect,
  })),
)
const optionRows = computed(() => (isPksk.value ? pkskOptions.value : mcqOptions.value))

const usageRate = computed(() => {
  const u = question.value?.usage
  return u && u.attempts > 0 ? `${String(Math.round((u.correct / u.attempts) * 100))}%` : '-'
})

const busy = ref(false)

async function remove(): Promise<void> {
  if (!confirmNative(DELETE_CONFIRM) || busy.value) return
  busy.value = true
  try {
    const result = await deleteQuestion(props.id)
    flash.success(result.status)
    await router.push(QUESTIONS_LIST_PATH)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function changeStatus(action: 'pending_review' | 'approve'): Promise<void> {
  if (!confirmNative(STATUS_CONFIRM) || busy.value) return
  busy.value = true
  try {
    const result = await bulkQuestionAction(action, [props.id])
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

const CARD = 'rounded-2xl bg-white p-4 shadow sm:p-6'
const CARD_TITLE = 'flex items-center gap-2 text-base font-bold text-slate-800'
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase'
const ROW = 'border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0'
const HEADER_BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="question-detail-page">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <RouterLink
          :to="QUESTIONS_LIST_PATH"
          class="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="question-back"
        >
          <ArrowLeft class="h-5 w-5" aria-hidden="true" />
        </RouterLink>
        <div class="min-w-0">
          <h1 class="text-xl font-bold text-slate-800 sm:text-2xl">📝 Detail Soalan</h1>
          <p class="text-sm text-slate-500" data-testid="question-subtitle">Soalan #{{ id }}</p>
        </div>
      </div>
      <div v-if="question" class="flex gap-2">
        <RouterLink
          :to="questionEditPath(id)"
          :class="[HEADER_BTN, 'bg-emerald-600 hover:bg-emerald-700']"
          data-testid="question-edit"
        >
          <SquarePen class="h-4 w-4" aria-hidden="true" />
          Edit
        </RouterLink>
        <form method="post" @submit.prevent="remove">
          <button
            type="submit"
            :disabled="busy"
            :class="[HEADER_BTN, 'bg-red-600 hover:bg-red-700 disabled:opacity-60']"
            data-testid="question-delete"
          >
            <Trash class="h-4 w-4" aria-hidden="true" />
            Padam
          </button>
        </form>
      </div>
    </div>

    <div v-if="error && !notFound" class="space-y-3" data-testid="question-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="question-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="!question && !error" class="space-y-4" data-testid="question-skeleton">
      <div class="h-32 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-48 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <div v-else-if="question" class="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
      <!-- Main column -->
      <div class="min-w-0 space-y-4 sm:space-y-6 lg:col-span-2">
        <section :class="CARD" data-testid="question-card">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 :class="CARD_TITLE">
              <CircleQuestionMark class="h-5 w-5 text-indigo-600" aria-hidden="true" />
              Soalan
            </h2>
            <span :class="statusClass(question.status)" data-testid="question-status">{{
              statusLabel(question.status)
            }}</span>
          </div>
          <p
            class="text-base break-words whitespace-pre-line text-slate-800"
            data-testid="question-text"
          >
            {{ question.questionText }}
          </p>
          <img
            v-if="question.questionImage"
            :src="imageSrc(question.questionImage)"
            alt=""
            class="mt-3 max-h-80 max-w-full rounded-lg"
            data-testid="question-image"
          />
        </section>

        <section v-if="optionRows.length > 0" :class="CARD" data-testid="options-card">
          <h2 :class="[CARD_TITLE, 'mb-3']">
            <ListChecks class="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Pilihan Jawapan
          </h2>
          <ul class="space-y-3">
            <li
              v-for="o in optionRows"
              :key="o.letter"
              class="flex items-start gap-3 rounded-xl border-2 p-3"
              :class="
                o.correct ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              "
              data-testid="question-option"
              :data-correct="o.correct"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                :class="o.correct ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'"
                >{{ o.letter }}</span
              >
              <div class="min-w-0">
                <p class="break-words text-slate-800" :class="o.correct ? 'font-semibold' : ''">
                  {{ o.text }}
                </p>
                <img
                  v-if="o.image"
                  :src="imageSrc(o.image)"
                  alt=""
                  class="mt-2 max-h-40 max-w-full rounded-lg"
                />
                <p
                  v-if="o.correct"
                  class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"
                  data-testid="question-correct-label"
                >
                  <CircleCheck class="h-4 w-4" aria-hidden="true" />
                  Jawapan Betul
                </p>
              </div>
            </li>
          </ul>
        </section>

        <!-- INFERRED (FR-M04-43): the answer card of the other types, with the create-form headings. -->
        <section v-else-if="!isMcq && !isPksk" :class="CARD" data-testid="answer-card">
          <h2 :class="[CARD_TITLE, 'mb-3']">
            <ListChecks class="h-5 w-5 text-emerald-600" aria-hidden="true" />
            {{ TYPE_ANSWER_HEADINGS[question.questionType as keyof typeof TYPE_ANSWER_HEADINGS] }}
          </h2>
          <div v-if="question.questionType === 'true_false'" class="flex gap-3">
            <span
              v-for="v in [true, false]"
              :key="String(v)"
              class="rounded-xl border-2 px-4 py-2 text-sm font-semibold"
              :class="
                question.tfAnswer === v
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              "
              :data-correct="question.tfAnswer === v"
              >{{ v ? 'Betul' : 'Salah' }}</span
            >
          </div>
          <template
            v-else-if="
              question.questionType === 'short_answer' || question.questionType === 'fill_blank'
            "
          >
            <p class="break-words text-slate-800">{{ question.correctAnswerText || '-' }}</p>
            <p
              v-if="question.altAnswers.length > 0"
              class="mt-1 text-sm break-words text-slate-500"
            >
              {{ question.altAnswers.join(', ') }}
            </p>
          </template>
          <p v-else class="break-words whitespace-pre-line text-slate-800">
            {{ question.modelAnswer || '-' }}
          </p>
        </section>

        <section
          v-if="question.explanation"
          class="rounded-2xl border-l-4 border-blue-500 bg-white p-4 shadow sm:p-6"
          data-testid="explanation-card"
        >
          <h2 :class="[CARD_TITLE, 'mb-2']">
            <Lightbulb class="h-5 w-5 text-blue-500" aria-hidden="true" />
            Penjelasan
          </h2>
          <p class="break-words whitespace-pre-line text-slate-700">{{ question.explanation }}</p>
        </section>

        <AiExplanationCard
          :question-id="id"
          :explanation="question.aiExplanation"
          @generated="reload()"
        />
      </div>

      <!-- Sidebar -->
      <div class="min-w-0 space-y-4 sm:space-y-6">
        <section :class="CARD" data-testid="info-card">
          <h2 :class="[CARD_TITLE, 'mb-3']">
            <Info class="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Maklumat
          </h2>
          <div :class="ROW">
            <p :class="LABEL">Subjek</p>
            <p
              class="mt-1 flex items-center gap-2 break-words text-slate-800"
              data-testid="info-subject"
            >
              <Book class="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />{{
                question.subject?.name ?? '-'
              }}
            </p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">Tahap Pendidikan</p>
            <p
              class="mt-1 flex items-center gap-2 break-words text-slate-800"
              data-testid="info-level"
            >
              <GraduationCap class="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{{
                question.level?.name ?? '-'
              }}
            </p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">Tahap Kesukaran</p>
            <p class="mt-1 flex items-center gap-2 text-slate-800" data-testid="info-difficulty">
              <span class="inline-flex gap-0.5">
                <Star
                  v-for="n in 5"
                  :key="n"
                  class="h-4 w-4"
                  :class="
                    n <= question.difficultyLevel
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-slate-200 text-slate-200'
                  "
                  aria-hidden="true"
                />
              </span>
              <span class="text-sm text-slate-500">({{ question.difficultyLevel }}/5)</span>
            </p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">DSKP</p>
            <div
              v-if="question.dskp"
              class="mt-1 space-y-1 text-sm text-slate-700"
              data-testid="info-dskp"
            >
              <p class="flex items-start gap-2 break-words">
                <Layers class="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />{{
                  cut(question.dskp.bidang.name)
                }}
              </p>
              <p class="flex items-start gap-2 break-words">
                <Bookmark class="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />{{
                  cut(`${question.dskp.sk.code} - ${question.dskp.sk.description}`, 70)
                }}
              </p>
              <p class="flex items-start gap-2 break-words">
                <Tag class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{{
                  cut(`${question.dskp.sp.code} - ${question.dskp.sp.description}`, 70)
                }}
              </p>
            </div>
            <p v-else class="mt-1 text-sm text-slate-500" data-testid="info-dskp">Belum ditag</p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">Bahasa</p>
            <p class="mt-1 flex items-center gap-2 text-slate-800" data-testid="info-language">
              <Languages class="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />{{
                LANGUAGE_LABELS[question.language] ?? question.language
              }}
            </p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">Nilai Mata</p>
            <p class="mt-1 flex items-center gap-2 text-slate-800" data-testid="info-points">
              <Coins class="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />{{
                question.pointsValue
              }}
              mata
            </p>
          </div>
          <div :class="ROW">
            <p :class="LABEL">Dicipta Pada</p>
            <p class="mt-1 flex items-center gap-2 text-slate-800" data-testid="info-created">
              <Calendar class="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />{{
                formatDateTime(question.createdAt)
              }}
            </p>
          </div>
        </section>

        <section
          v-if="question.usage.attempts === 0"
          class="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow sm:p-5"
          data-testid="usage-new"
        >
          <h2 class="flex items-center gap-2 text-base font-bold text-amber-700">
            <Info class="h-5 w-5" aria-hidden="true" />
            Soalan Baharu
          </h2>
          <p class="mt-1 text-sm text-amber-700">
            Soalan ini belum digunakan dalam sebarang kuiz atau latihan.
          </p>
        </section>
        <!-- INFERRED (FR-M04-41): statistics of a used question, UNVERIFIED COPY. -->
        <section v-else :class="CARD" data-testid="usage-stats">
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">Jumlah Cubaan</dt>
              <dd class="font-semibold text-slate-800" data-testid="usage-attempts">
                {{ question.usage.attempts }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">Jawapan Betul</dt>
              <dd class="font-semibold text-slate-800" data-testid="usage-correct">
                {{ question.usage.correct }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">Kadar Betul</dt>
              <dd class="font-semibold text-slate-800" data-testid="usage-rate">{{ usageRate }}</dd>
            </div>
          </dl>
        </section>

        <!-- INFERRED (FR-M04-42): the "Quick Actions" slot, only for draft and pending questions. -->
        <div
          v-if="question.status === 'draft' || question.status === 'pending_review'"
          class="flex flex-wrap gap-2"
          data-testid="quick-actions"
        >
          <button
            v-if="question.status === 'draft'"
            type="button"
            :disabled="busy"
            :class="[HEADER_BTN, 'bg-amber-500 hover:bg-amber-600 disabled:opacity-60']"
            data-testid="status-pending-review"
            @click="changeStatus('pending_review')"
          >
            Hantar untuk Semakan
          </button>
          <button
            type="button"
            :disabled="busy"
            :class="[HEADER_BTN, 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60']"
            data-testid="status-approve"
            @click="changeStatus('approve')"
          >
            Luluskan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
