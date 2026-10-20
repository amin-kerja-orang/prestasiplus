<script setup lang="ts">
/**
 * S3 `/admin/questions/:id` "Lihat Soalan" (M04-T3; FR-M04-37..47).
 *
 * Back link, header with "Edit" and "Padam" (native confirm, then the list with the API `status`
 * flash), then 2/3 + 1/3 from `lg`: cards "Soalan", "Pilihan Jawapan" (or the answer card of another
 * type), "Penjelasan", "Penjelasan AI"; sidebar "Maklumat", the usage card and the status quick
 * actions. An unknown id is the standard 404; another load failure is a red box with "Cuba Semula".
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError, isHttpMode } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, useFlash } from '@/composables'
import {
  DsArt3D,
  DsBackLink,
  DsLoadError,
  DsPage,
  DsPanel,
  DsRtlScope,
  DsStatusBadge,
  useConfirm,
} from '@/ds'
import { formatDateTime } from '@/lib/time'

import { bulkQuestionAction, deleteQuestion, fetchQuestion } from '../api'
import AiExplanationCard from '../components/AiExplanationCard.vue'
import {
  cut,
  DELETE_CONFIRM,
  LANGUAGE_LABELS,
  notUpdatedLines,
  QUESTIONS_LIST_PATH,
  questionEditPath,
  STATUS_CONFIRM,
  statusDs,
  statusLabel,
  TYPE_ANSWER_HEADINGS,
} from '../lib/question-list'
import { imageSrc } from '../lib/image-url'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

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
  if (busy.value || !(await confirm({ message: DELETE_CONFIRM, tone: 'error' }))) return
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

/** http mode only: an approved question can be published (mock "Luluskan" already meant live). */
const canPublish = computed(() => isHttpMode() && question.value?.status === 'approved')

async function changeStatus(action: 'pending_review' | 'approve' | 'publish'): Promise<void> {
  if (busy.value || !(await confirm({ message: STATUS_CONFIRM }))) return
  busy.value = true
  try {
    const result = await bulkQuestionAction(action, [props.id])
    await reload()
    if (result.notUpdated && result.notUpdated.length > 0) {
      flash.show({
        type: 'error',
        message: notUpdatedLines(result.data.affected, result.notUpdated, 'dikemaskini'),
      })
    } else {
      flash.show({ type: 'success', message: result.status })
    }
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

/** Arabic / Jawi question text is shown right-to-left in the Jawi face. */
const isRtlText = (text: string): boolean => /[\u0600-\u06FF]/.test(text)
</script>

<template>
  <DsPage
    :subtitle="`Soalan #${String(id)}`"
    subtitle-testid="question-subtitle"
    data-testid="question-detail-page"
  >
    <template #breadcrumb>
      <DsBackLink :to="QUESTIONS_LIST_PATH" data-testid="question-back" />
    </template>
    <template v-if="question" #actions>
      <UButton
        :to="questionEditPath(id)"
        color="neutral"
        variant="soft"
        icon="i-ph-pencil-simple"
        class="min-h-11"
        data-testid="question-edit"
      >
        Edit
      </UButton>
      <UButton
        type="button"
        color="error"
        variant="soft"
        icon="i-ph-trash"
        :disabled="busy"
        class="min-h-11"
        data-testid="question-delete"
        @click="remove"
      >
        Padam
      </UButton>
    </template>

    <DsLoadError
      v-if="error && !notFound"
      :message="LOAD_ERROR"
      testid="question-error"
      retry-testid="question-retry"
      @retry="reload()"
    />

    <div v-else-if="!question && !error" class="flex flex-col gap-4" data-testid="question-skeleton">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <div v-else-if="question" class="grid min-w-0 gap-4 md:gap-6 lg:grid-cols-3">
      <!-- Main column -->
      <div class="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-2">
        <DsPanel title="Soalan" icon="i-ph-question" data-testid="question-card">
          <template #actions>
            <DsStatusBadge
              :status="statusDs(question.status)"
              :label="statusLabel(question.status)"
              data-testid="question-status"
            />
          </template>
          <DsRtlScope :rtl="isRtlText(question.questionText)">
            <p class="text-body break-words whitespace-pre-line text-highlighted" data-testid="question-text">
              {{ question.questionText }}
            </p>
          </DsRtlScope>
          <div v-if="question.questionImage" class="mt-3 max-w-md">
            <DsArt3D
              variant="plain"
              :src="imageSrc(question.questionImage)"
              alt=""
              data-testid="question-image"
            />
          </div>
        </DsPanel>

        <DsPanel
          v-if="optionRows.length > 0"
          title="Pilihan Jawapan"
          icon="i-ph-list-checks"
          data-testid="options-card"
        >
          <ul class="flex flex-col gap-3">
            <li v-for="o in optionRows" :key="o.letter" data-testid="question-option" :data-correct="o.correct">
              <UCard :color="o.correct ? 'success' : 'neutral'" variant="subtle" :ui="{ body: 'p-3 sm:p-3' }">
              <div class="flex items-start gap-3">
              <UBadge
                :color="o.correct ? 'success' : 'neutral'"
                :variant="o.correct ? 'solid' : 'subtle'"
                size="lg"
                :label="o.letter"
                class="shrink-0"
              />
              <div class="min-w-0">
                <p class="text-body break-words text-highlighted" :class="o.correct ? 'text-label' : ''">
                  {{ o.text }}
                </p>
                <div v-if="o.image" class="mt-2 max-w-xs">
                  <DsArt3D variant="plain" :src="imageSrc(o.image)" alt="" />
                </div>
                <p
                  v-if="o.correct"
                  class="mt-1 inline-flex items-center gap-2 text-label text-success"
                  data-testid="question-correct-label"
                >
                  <UIcon name="i-ph-check-circle" class="size-4" />
                  Jawapan Betul
                </p>
              </div>
              </div>
              </UCard>
            </li>
          </ul>
        </DsPanel>

        <!-- INFERRED (FR-M04-43): the answer card of the other types, with the create-form headings. -->
        <DsPanel
          v-else-if="!isMcq && !isPksk"
          :title="TYPE_ANSWER_HEADINGS[question.questionType as keyof typeof TYPE_ANSWER_HEADINGS]"
          icon="i-ph-list-checks"
          data-testid="answer-card"
        >
          <div v-if="question.questionType === 'true_false'" class="flex gap-3">
            <UBadge
              v-for="v in [true, false]"
              :key="String(v)"
              :color="question.tfAnswer === v ? 'success' : 'neutral'"
              :variant="question.tfAnswer === v ? 'solid' : 'subtle'"
              size="lg"
              :label="v ? 'Betul' : 'Salah'"
              :data-correct="question.tfAnswer === v"
            />
          </div>
          <template
            v-else-if="
              question.questionType === 'short_answer' || question.questionType === 'fill_blank'
            "
          >
            <p class="text-body break-words text-highlighted">{{ question.correctAnswerText || '-' }}</p>
            <p v-if="question.altAnswers.length > 0" class="mt-1 text-caption break-words text-muted">
              {{ question.altAnswers.join(', ') }}
            </p>
          </template>
          <p v-else class="text-body break-words whitespace-pre-line text-highlighted">
            {{ question.modelAnswer || '-' }}
          </p>
        </DsPanel>

        <DsPanel
          v-if="question.explanation"
          title="Penjelasan"
          icon="i-ph-lightbulb"
          data-testid="explanation-card"
        >
          <p class="text-body break-words whitespace-pre-line text-default">{{ question.explanation }}</p>
        </DsPanel>

        <AiExplanationCard
          :question-id="id"
          :explanation="question.aiExplanation"
          @generated="reload()"
        />
      </div>

      <!-- Sidebar -->
      <div class="flex min-w-0 flex-col gap-4 md:gap-6">
        <DsPanel title="Maklumat" icon="i-ph-info" data-testid="info-card">
          <dl class="flex flex-col gap-4">
            <div>
              <dt class="text-overline text-muted">Subjek</dt>
              <dd class="mt-1 flex items-center gap-2 break-words text-highlighted" data-testid="info-subject">
                <UIcon name="i-ph-book" class="size-4 shrink-0 text-muted" />{{ question.subject?.name ?? '-' }}
              </dd>
            </div>
            <div>
              <dt class="text-overline text-muted">Tahap Pendidikan</dt>
              <dd class="mt-1 flex items-center gap-2 break-words text-highlighted" data-testid="info-level">
                <UIcon name="i-ph-graduation-cap" class="size-4 shrink-0 text-muted" />{{ question.level?.name ?? '-' }}
              </dd>
            </div>
            <div>
              <dt class="text-overline text-muted">Tahap Kesukaran</dt>
              <dd class="mt-1 flex items-center gap-2 text-highlighted" data-testid="info-difficulty">
                <span class="inline-flex gap-1">
                  <UIcon
                    v-for="n in 5"
                    :key="n"
                    :name="n <= question.difficultyLevel ? 'i-ph-star-fill' : 'i-ph-star'"
                    class="size-4"
                    :class="n <= question.difficultyLevel ? 'text-warning' : 'text-dimmed'"
                  />
                </span>
                <span class="tabular text-caption text-muted">({{ question.difficultyLevel }}/5)</span>
              </dd>
            </div>
            <div>
              <dt class="text-overline text-muted">DSKP</dt>
              <dd v-if="question.dskp" class="mt-1 flex flex-col gap-1 text-body text-default" data-testid="info-dskp">
                <p class="flex items-start gap-2 break-words">
                  <UIcon name="i-ph-stack" class="mt-1 size-4 shrink-0 text-muted" />{{ cut(question.dskp.bidang.name) }}
                </p>
                <p class="flex items-start gap-2 break-words">
                  <UIcon name="i-ph-bookmark-simple" class="mt-1 size-4 shrink-0 text-muted" />{{
                    cut(`${question.dskp.sk.code} - ${question.dskp.sk.description}`, 70)
                  }}
                </p>
                <p class="flex items-start gap-2 break-words">
                  <UIcon name="i-ph-tag" class="mt-1 size-4 shrink-0 text-muted" />{{
                    cut(`${question.dskp.sp.code} - ${question.dskp.sp.description}`, 70)
                  }}
                </p>
              </dd>
              <dd v-else class="mt-1 text-body text-muted" data-testid="info-dskp">Belum ditag</dd>
            </div>
            <div>
              <dt class="text-overline text-muted">Bahasa</dt>
              <dd class="mt-1 flex items-center gap-2 text-highlighted" data-testid="info-language">
                <UIcon name="i-ph-translate" class="size-4 shrink-0 text-muted" />{{
                  LANGUAGE_LABELS[question.language] ?? question.language
                }}
              </dd>
            </div>
            <div>
              <dt class="text-overline text-muted">Nilai Mata</dt>
              <dd class="mt-1 flex items-center gap-2 text-highlighted" data-testid="info-points">
                <UIcon name="i-ph-coins" class="size-4 shrink-0 text-muted" />{{ question.pointsValue }} mata
              </dd>
            </div>
            <div>
              <dt class="text-overline text-muted">Dicipta Pada</dt>
              <dd class="mt-1 flex items-center gap-2 text-highlighted" data-testid="info-created">
                <UIcon name="i-ph-calendar" class="size-4 shrink-0 text-muted" />{{
                  formatDateTime(question.createdAt)
                }}
              </dd>
            </div>
          </dl>
        </DsPanel>

        <DsPanel
          v-if="question.usage.attempts === 0"
          title="Soalan Baharu"
          icon="i-ph-info"
          accent="heat"
          data-testid="usage-new"
        >
          <p class="text-body text-muted">
            Soalan ini belum digunakan dalam sebarang kuiz atau latihan.
          </p>
        </DsPanel>
        <!-- INFERRED (FR-M04-41): statistics of a used question, UNVERIFIED COPY. -->
        <DsPanel v-else data-testid="usage-stats">
          <dl class="flex flex-col gap-2 text-body">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Jumlah Cubaan</dt>
              <dd class="tabular text-label text-highlighted" data-testid="usage-attempts">
                {{ question.usage.attempts }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Jawapan Betul</dt>
              <dd class="tabular text-label text-highlighted" data-testid="usage-correct">
                {{ question.usage.correct }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Kadar Betul</dt>
              <dd class="tabular text-label text-highlighted" data-testid="usage-rate">{{ usageRate }}</dd>
            </div>
          </dl>
        </DsPanel>

        <!-- INFERRED (FR-M04-42): the "Quick Actions" slot, only for draft and pending questions. -->
        <div
          v-if="question.status === 'draft' ||
            question.status === 'pending_review' ||
            question.status === 'review' ||
            canPublish"
          class="flex flex-wrap gap-2"
          data-testid="quick-actions"
        >
          <UButton
            v-if="question.status === 'draft'"
            type="button"
            color="warning"
            variant="soft"
            :disabled="busy"
            class="min-h-11"
            data-testid="status-pending-review"
            @click="changeStatus('pending_review')"
          >
            Hantar untuk Semakan
          </UButton>
          <UButton
            v-if="canPublish"
            type="button"
            color="success"
            :disabled="busy"
            class="min-h-11"
            data-testid="status-publish"
            @click="changeStatus('publish')"
          >
            Terbitkan
          </UButton>
          <UButton
            v-if="!canPublish"
            type="button"
            color="success"
            :disabled="busy"
            class="min-h-11"
            data-testid="status-approve"
            @click="changeStatus('approve')"
          >
            Luluskan
          </UButton>
        </div>
      </div>
    </div>
  </DsPage>
</template>
