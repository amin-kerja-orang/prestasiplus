<script setup lang="ts">
/**
 * S4b `/pksk/level/:level/exam` "Peperiksaan Penuh" (M07-T2; FR-M07-17; R1-MUR-19): 30 Bahagian A +
 * 70 Bahagian B + 1 Bahagian C item grouped A / B / C, each heading with its real question count and
 * an answered counter beside the progress. "Hantar" opens a confirm dialog (unanswered count), a
 * leave dialog guards the header close, the back link and the route while at least one answer
 * exists, and the RESULT view replaces the paper in the same page (score and grade of the attempt,
 * no per-Bahagian breakdown). No time limit in R1.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationNormalized } from 'vue-router'

import { isApiError } from '@/api'
import {
  DsCluster,
  DsDialog,
  DsGrid,
  DsLoadError,
  DsPage,
  DsQuizHeader,
  DsStack,
  DsStatTile,
  DsText,
} from '@/ds'

import { fetchPkskExam, submitPkskExam } from '../api/pksk'
import type { PkskAnswer, PkskExamAttempt, PkskLevel } from '../api/types'
import QuestionItem from '../components/QuestionItem.vue'
import { FORMAT_TILES } from '../lib/levels'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()
const router = useRouter()

const { data, error, loading, reload } = usePkskData(
  (signal) => fetchPkskExam(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))

const answers = reactive<Record<number, PkskAnswer>>({})
const saving = ref(false)
const submitError = ref<string | null>(null)
/** The API refused the answers (422): the served set is stale, so a fresh one is offered. */
const stale = ref(false)
const result = ref<PkskExamAttempt | null>(null)

const answerOf = (id: number): PkskAnswer => answers[id] ?? { questionId: id }
const isAnswered = (a: PkskAnswer | undefined): boolean =>
  a !== undefined && (a.optionIndex !== undefined || (a.text ?? '').trim() !== '')

const allQuestions = computed(() => data.value?.sections.flatMap((s) => s.questions) ?? [])
const total = computed(() => allQuestions.value.length)
const done = computed(() => allQuestions.value.filter((q) => isAnswered(answers[q.id])).length)
const unanswered = computed(() => total.value - done.value)
const progress = computed(() => (total.value === 0 ? 0 : (done.value / total.value) * 100))

const SECTION_TITLE = { A: 'Bahagian A', B: 'Bahagian B', C: 'Bahagian C' } as const
const UNIT = Object.fromEntries(FORMAT_TILES.map((t) => [t.bahagian, t.unit])) as Record<
  'A' | 'B' | 'C',
  string
>

const hasEssay = computed(
  () => data.value?.sections.some((s) => s.bahagian === 'C' && s.questions.length > 0) ?? false,
)

function resetState(): void {
  for (const key of Object.keys(answers)) delete answers[Number(key)]
  result.value = null
  submitError.value = null
  stale.value = false
  confirmOpen.value = false
  leaveOpen.value = false
}
watch(() => props.level, resetState)

// --- "Hantar" confirm dialog (46 s2.8): Batal is the safe button. ---
const confirmOpen = ref(false)
const confirmSafe = ref<{ $el: HTMLElement } | null>(null)
const confirmModel = computed({
  get: () => confirmOpen.value,
  set: (open: boolean) => {
    if (!open) confirmOpen.value = false
  },
})

// --- Leave dialog: Teruskan Kuiz is the safe button. ---
const leaveOpen = ref(false)
const leaveSafe = ref<{ $el: HTMLElement } | null>(null)
const pendingTo = ref<RouteLocationNormalized | null>(null)
let bypassGuard = false
const leaveModel = computed({
  get: () => leaveOpen.value,
  set: (open: boolean) => {
    if (!open) stay()
  },
})

for (const [open, safe] of [
  [confirmOpen, confirmSafe],
  [leaveOpen, leaveSafe],
] as const) {
  watch(open, (isOpen) => {
    if (isOpen) void nextTick(() => setTimeout(() => safe.value?.$el.focus(), 0))
  })
}

const guardActive = computed(() => result.value === null && done.value > 0)
onBeforeRouteLeave((to) => {
  if (bypassGuard || !guardActive.value) return true
  pendingTo.value = to
  leaveOpen.value = true
  return false
})
function stay(): void {
  leaveOpen.value = false
  pendingTo.value = null
}
async function leave(): Promise<void> {
  const to = pendingTo.value
  bypassGuard = true
  leaveOpen.value = false
  pendingTo.value = null
  try {
    if (to) await router.push(to)
  } finally {
    bypassGuard = false
  }
}

async function submit(): Promise<void> {
  if (!data.value || saving.value || stale.value) return
  saving.value = true
  submitError.value = null
  try {
    result.value = await submitPkskExam(
      props.level,
      allQuestions.value.map((q) => answerOf(q.id)),
    )
    confirmOpen.value = false
  } catch (err) {
    confirmOpen.value = false
    submitError.value = isApiError(err) ? err.message : LOAD_ERROR
    stale.value = isApiError(err) && err.status === 422
  } finally {
    saving.value = false
  }
}

async function retry(): Promise<void> {
  resetState()
  await reload()
}
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}`"
    back-label="Kembali ke Dashboard"
    class="max-w-2xl"
    data-testid="pksk-exam"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <DsStack v-else-if="data && result" gap="lg" data-testid="exam-result">
      <h2 data-testid="result-title">
        <DsText variant="title" as="span">Keputusan Peperiksaan</DsText>
      </h2>
      <DsGrid :cols="{ base: 1, sm: 2 }" data-testid="result-tiles">
        <DsStatTile
          :value="`${Math.round(result.scorePct)}%`"
          unit="Markah"
          icon="target"
          accent="action"
          data-testid="tile-markah"
        />
        <DsStatTile
          :value="result.grade"
          unit="Gred"
          icon="medal"
          accent="win"
          data-testid="tile-gred"
        />
      </DsGrid>
      <DsCluster v-if="hasEssay" gap="xs" data-testid="essay-note">
        <UBadge color="neutral" variant="outline" data-testid="result-indicative"
          >Keputusan indikatif</UBadge
        >
        <DsText variant="caption" tone="muted">Markah esei ialah penilaian indikatif.</DsText>
      </DsCluster>
      <DsCluster stack-below="sm">
        <UButton
          :to="`/pksk/level/${level}`"
          size="xl"
          block
          class="min-h-12"
          data-testid="result-dashboard"
          >Kembali ke Dashboard</UButton
        >
        <UButton
          :to="`/pksk/level/${level}/history`"
          color="neutral"
          variant="soft"
          size="xl"
          block
          class="min-h-12"
          data-testid="result-history"
          >Sejarah</UButton
        >
      </DsCluster>
    </DsStack>

    <form
      v-else-if="data && !loading"
      class="flex flex-col gap-6"
      novalidate
      @submit.prevent="stale || (confirmOpen = true)"
    >
      <DsQuizHeader
        close-label="Kembali ke Dashboard"
        :progress="progress"
        progress-label="Kemajuan peperiksaan"
        @close="router.push(`/pksk/level/${level}`)"
      />
      <DsCluster justify="between">
        <h2 class="text-heading text-highlighted" data-testid="exam-title">Peperiksaan Penuh</h2>
        <DsText variant="label" tone="muted" tabular data-testid="exam-counter"
          >{{ done }}/{{ total }}</DsText
        >
      </DsCluster>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="submitError"
        data-testid="submit-error"
      />
      <UButton
        v-if="stale"
        size="xl"
        block
        class="min-h-12"
        data-testid="stale-retry"
        @click="retry"
        >↻ Cuba Lagi</UButton
      >
      <section
        v-for="s in data.sections"
        :key="s.bahagian"
        class="flex flex-col gap-3"
        :data-testid="`exam-section-${s.bahagian}`"
      >
        <h3 class="text-subheading text-highlighted" data-testid="exam-section-title">
          {{ SECTION_TITLE[s.bahagian] }} ({{ s.questions.length }} {{ UNIT[s.bahagian] }})
        </h3>
        <QuestionItem
          v-for="(q, i) in s.questions"
          :key="q.id"
          :question="q"
          :index="i + 1"
          :model-value="answerOf(q.id)"
          @update:model-value="answers[q.id] = $event"
        />
      </section>
      <UButton
        type="submit"
        size="xl"
        block
        icon="i-ph-paper-plane-tilt-duotone"
        class="min-h-12"
        data-testid="exam-submit"
        :disabled="stale"
        >Hantar</UButton
      >
    </form>
  </DsPage>

  <DsDialog
    v-model:open="confirmModel"
    :title="
      unanswered > 0 ? `Anda belum menjawab ${unanswered} soalan.` : 'Hantar jawapan anda sekarang?'
    "
    :description="unanswered > 0 ? 'Hantar jawapan anda sekarang?' : undefined"
    :loading="saving"
  >
    <template #footer>
      <UButton
        ref="confirmSafe"
        color="neutral"
        variant="soft"
        class="min-h-11"
        :disabled="saving"
        data-testid="confirm-cancel"
        @click="confirmOpen = false"
        >Batal</UButton
      >
      <UButton class="min-h-11" :loading="saving" data-testid="confirm-submit" @click="submit">{{
        saving ? 'Menghantar...' : 'Hantar'
      }}</UButton>
    </template>
  </DsDialog>

  <DsDialog
    v-model:open="leaveModel"
    title="Keluar daripada kuiz?"
    description="Jawapan anda belum dihantar dan akan hilang."
  >
    <template #footer>
      <UButton ref="leaveSafe" class="min-h-11" data-testid="leave-stay" @click="stay"
        >Teruskan Kuiz</UButton
      >
      <UButton
        color="neutral"
        variant="soft"
        class="min-h-11"
        data-testid="leave-confirm"
        @click="leave"
        >Keluar</UButton
      >
    </template>
  </DsDialog>
</template>
