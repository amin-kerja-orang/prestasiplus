<script setup lang="ts">
/**
 * S4a `/pksk/level/:level/domain/:code` (M07-T2; FR-M07-16, FR-M07-65; R1-MUR-19): the batch practice
 * set of one domain, untimed. "Hantar" opens a confirm dialog (unanswered count), a leave dialog
 * guards the header close, the back link and the route while at least one answer exists, and the
 * RESULT view replaces the set in the same page (no redirect): score, mastery, coins, points and the
 * review list. The served questions stay in page state because the result carries ids only.
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

import { fetchPkskPractice, submitPkskPractice } from '../api/pksk'
import type { PkskAnswer, PkskLevel, PkskPracticeResult, PkskServedQuestion } from '../api/types'
import QuestionItem from '../components/QuestionItem.vue'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel; code: string }>()
const router = useRouter()

const { data, error, loading, reload } = usePkskData(
  (signal) => fetchPkskPractice(props.level, props.code, { signal }),
  [() => props.level, () => props.code],
)
const loadFailed = computed(() => isLoadError(error.value))

const answers = reactive<Record<number, PkskAnswer>>({})
const saving = ref(false)
const submitError = ref<string | null>(null)
const result = ref<PkskPracticeResult | null>(null)
/** The served set and the answers at Hantar: the result view reads these, not the live page state. */
const submitted = ref<{ questions: PkskServedQuestion[]; answers: Record<number, PkskAnswer> }>({
  questions: [],
  answers: {},
})

const answerOf = (id: number): PkskAnswer => answers[id] ?? { questionId: id }
const isAnswered = (a: PkskAnswer | undefined): boolean =>
  a !== undefined && (a.optionIndex !== undefined || (a.text ?? '').trim() !== '')

const questions = computed(() => data.value?.questions ?? [])
const answeredCount = computed(
  () => questions.value.filter((q) => isAnswered(answers[q.id])).length,
)
const unanswered = computed(() => questions.value.length - answeredCount.value)
const progress = computed(() =>
  questions.value.length === 0 ? 0 : (answeredCount.value / questions.value.length) * 100,
)

function resetState(): void {
  for (const key of Object.keys(answers)) delete answers[Number(key)]
  result.value = null
  submitError.value = null
  confirmOpen.value = false
  leaveOpen.value = false
}
watch([() => props.level, () => props.code], resetState)

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

const guardActive = computed(
  () => result.value === null && questions.value.some((q) => isAnswered(answers[q.id])),
)
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
  if (!data.value || saving.value) return
  saving.value = true
  submitError.value = null
  const served = [...data.value.questions]
  try {
    const res = await submitPkskPractice(
      props.level,
      props.code,
      served.map((q) => answerOf(q.id)),
    )
    submitted.value = { questions: served, answers: { ...answers } }
    result.value = res
    confirmOpen.value = false
  } catch (err) {
    confirmOpen.value = false
    submitError.value = isApiError(err) ? err.message : LOAD_ERROR
  } finally {
    saving.value = false
  }
}

async function retry(): Promise<void> {
  resetState()
  await reload()
}

const LETTERS = 'ABCDEFGH'
const reviewRows = computed(() =>
  (result.value?.review ?? []).map((r, i) => {
    const q = submitted.value.questions.find((x) => x.id === r.questionId)
    const essay = !q || q.options.length === 0
    const optionLabel = (idx: number | null): string | null =>
      idx === null || !q?.options[idx]
        ? null
        : `${LETTERS[idx] ?? String(idx + 1)}. ${q.options[idx].text}`
    const typed = (submitted.value.answers[r.questionId]?.text ?? '').trim()
    return {
      ...r,
      n: i + 1,
      text: q?.questionText ?? '',
      essay,
      chosen: essay ? (typed === '' ? null : typed) : optionLabel(r.selectedIndex),
      correctText: optionLabel(r.correctIndex),
    }
  }),
)
const hasEssay = computed(() => reviewRows.value.some((r) => r.essay))
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}/domains`"
    back-label="Kembali ke Domain"
    class="max-w-2xl"
    data-testid="pksk-practice"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <DsStack v-else-if="data && result" gap="lg" data-testid="practice-result">
      <DsStack gap="xs">
        <h2 data-testid="result-title"><DsText variant="title" as="span">Kuiz Selesai!</DsText></h2>
        <DsText variant="body" tone="muted" data-testid="result-sub"
          >Tahniah, anda telah lengkapkan {{ data.domain.name }}.</DsText
        >
      </DsStack>
      <DsGrid :cols="{ base: 1, sm: 2, lg: 4 }" data-testid="result-tiles">
        <DsStatTile
          :value="`${result.correct}/${result.total}`"
          unit="Markah"
          icon="target"
          accent="action"
          data-testid="tile-markah"
        />
        <DsStatTile
          :value="`${result.masteryPct}%`"
          unit="Ketepatan"
          icon="seal-check"
          accent="friend"
          data-testid="tile-ketepatan"
        />
        <DsStatTile
          :value="`+${result.gamification.coinsEarned}`"
          unit="Syiling"
          icon="coins"
          accent="heat"
          data-testid="tile-syiling"
        />
        <DsStatTile
          :value="`+${result.gamification.pointsEarned}`"
          unit="Mata"
          icon="star"
          accent="win"
          data-testid="tile-mata"
        />
      </DsGrid>

      <DsStack as="ul" gap="sm" data-testid="review-list">
        <li v-for="r in reviewRows" :key="r.questionId" data-testid="review-item">
          <UCard>
            <DsStack gap="sm">
              <DsCluster justify="between" align="start">
                <DsText variant="label" wrap="anywhere">{{ r.n }}. {{ r.text }}</DsText>
                <DsCluster gap="xs">
                  <UBadge
                    :color="r.isCorrect ? 'success' : 'error'"
                    variant="soft"
                    data-testid="review-verdict"
                    >{{ r.isCorrect ? 'Betul' : 'Salah' }}</UBadge
                  >
                  <UBadge
                    v-if="r.essay"
                    color="neutral"
                    variant="outline"
                    data-testid="review-indicative"
                    >Keputusan indikatif</UBadge
                  >
                </DsCluster>
              </DsCluster>
              <DsText variant="body" tone="muted" wrap="anywhere" data-testid="review-chosen"
                >Jawapan anda: {{ r.chosen ?? 'Tiada jawapan' }}</DsText
              >
              <DsText
                v-if="r.correctText"
                variant="body"
                tone="muted"
                wrap="anywhere"
                data-testid="review-correct"
                >Jawapan betul: {{ r.correctText }}</DsText
              >
              <DsText
                v-if="r.explanation"
                variant="body"
                tone="muted"
                wrap="anywhere"
                data-testid="review-explanation"
                >Penjelasan: {{ r.explanation }}</DsText
              >
            </DsStack>
          </UCard>
        </li>
      </DsStack>
      <DsText v-if="hasEssay" variant="caption" tone="muted" data-testid="essay-note"
        >Markah esei ialah penilaian indikatif.</DsText
      >

      <DsCluster stack-below="sm">
        <UButton size="xl" block class="min-h-12" data-testid="result-retry" @click="retry"
          >↻ Cuba Lagi</UButton
        >
        <UButton
          :to="`/pksk/level/${level}/domains`"
          color="neutral"
          variant="soft"
          size="xl"
          block
          class="min-h-12"
          data-testid="result-domains"
          >Senarai Domain</UButton
        >
      </DsCluster>
    </DsStack>

    <form
      v-else-if="data && !loading"
      class="flex flex-col gap-4"
      novalidate
      @submit.prevent="confirmOpen = true"
    >
      <DsQuizHeader
        close-label="Kembali ke Domain"
        :progress="progress"
        progress-label="Kemajuan latihan"
        @close="router.push(`/pksk/level/${level}/domains`)"
      />
      <h2 class="text-heading text-highlighted" data-testid="practice-title">
        {{ data.domain.name }}
      </h2>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="submitError"
        data-testid="submit-error"
      />
      <QuestionItem
        v-for="(q, i) in data.questions"
        :key="q.id"
        :question="q"
        :index="i + 1"
        :model-value="answerOf(q.id)"
        @update:model-value="answers[q.id] = $event"
      />
      <UButton
        type="submit"
        size="xl"
        block
        icon="i-ph-paper-plane-tilt-duotone"
        class="min-h-12"
        data-testid="practice-submit"
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
