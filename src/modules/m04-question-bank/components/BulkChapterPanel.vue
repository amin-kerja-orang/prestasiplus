<script setup lang="ts">
/**
 * Bulk "Tetapkan Bab" (S2-T08, field 03-14, C-05): sets the Bab of the selected rows (`ids`, at most 64) or of all
 * rows of the filter (`filter`) through API-DSKP-09. Choosing the Bab runs a dry run that shows
 * "{n} soalan akan dipautkan ke Bab {nama}" with `matched / eligible / refused`; `Terapkan` sends the same body
 * with `expectedCount` = `matched`. `overwrite` is not exposed in R1 (D115) and is never sent: a question that
 * already has a Bab, or is not approved, is counted as `refused`. Dialog from `sm`, bottom sheet below (`DsDialog`).
 */
import { BULK_CHAPTER_MAX_IDS, type QuestionFilter } from '@pp/contract'
import { computed, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { DsCallout, DsDialog, DsStack, DsStatRow, DsText, type StatItem } from '@/ds'

import { fetchChapters, type ChapterOption } from '../api/lookups'
import { bulkChapter, type BulkChapterBody, type BulkChapterResult } from '../api/studio'
import {
  BULK_CHAPTER_CHOOSE,
  BULK_CHAPTER_MAX_IDS_MESSAGE,
  BULK_CHAPTER_MISMATCH,
  BULK_CHAPTER_NOT_FOUND,
  bulkChapterCapped,
  bulkChapterDryLine,
  bulkChapterResultLine,
  BULK_FILTER_NEEDED,
} from '../lib/bulk-filter'
import { errorLines, GENERIC_ERROR } from '../lib/ui-errors'
import ChapterSelect from './ChapterSelect.vue'

const props = defineProps<{
  subjectId: string
  educationLevelId: string
  /** The selected rows (at most 64). Exactly one of `ids` or `filter`. */
  ids?: string[]
  /** "Semua hasil tapisan": the Studio list filter (the panel adds the Subjek and Tingkatan). */
  filter?: QuestionFilter
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [result: BulkChapterResult]; close: [] }>()

const chapterId = ref('')
const chapterError = ref<string | undefined>(undefined)
const chapters = ref<ChapterOption[]>([])
const preview = ref<BulkChapterResult | null>(null)
const result = ref<BulkChapterResult | null>(null)
const errors = ref<string[]>([])
const dryRunning = ref(false)
const applying = ref(false)
let seq = 0

/** The message that blocks a run, or null when the panel can run. */
const blocked = computed<string | null>(() => {
  if (props.subjectId === '' || props.educationLevelId === '') return BULK_FILTER_NEEDED
  const n = props.ids?.length ?? 0
  if (props.ids === undefined && props.filter === undefined) return BULK_FILTER_NEEDED
  if (props.ids !== undefined && n === 0) return BULK_FILTER_NEEDED
  if (n > BULK_CHAPTER_MAX_IDS) return BULK_CHAPTER_MAX_IDS_MESSAGE
  return null
})

const chapterLabel = computed(() => {
  const c = chapters.value.find((x) => String(x.id) === chapterId.value)
  if (!c) return ''
  return c.chapterNumber === null ? `Bab ${c.name}` : `Bab ${String(c.chapterNumber)}: ${c.name}`
})

function body(extra: { dryRun?: boolean; expectedCount?: number }): BulkChapterBody {
  const base = { chapterId: chapterId.value, ...extra }
  if (props.ids !== undefined) return { ...base, ids: props.ids }
  return { ...base, filter: { ...props.filter, subjectId: props.subjectId, educationLevelId: props.educationLevelId } }
}

function fail(err: unknown): void {
  if (isApiError(err) && err.status === 404) errors.value = [BULK_CHAPTER_NOT_FOUND]
  else if (isApiError(err) && err.status === 422) {
    const lines = errorLines(err)
    errors.value = lines[0] === GENERIC_ERROR ? [BULK_CHAPTER_MISMATCH] : lines
  } else errors.value = errorLines(err)
}

async function dryRun(): Promise<void> {
  const token = ++seq
  preview.value = null
  if (chapterId.value === '' || blocked.value !== null) return
  dryRunning.value = true
  try {
    const r = await bulkChapter(body({ dryRun: true }))
    if (token === seq) preview.value = r
  } catch (err) {
    if (token === seq) fail(err)
  } finally {
    if (token === seq) dryRunning.value = false
  }
}

watch(chapterId, () => {
  errors.value = []
  chapterError.value = undefined
  void dryRun()
})

watch(
  () => [props.subjectId, props.educationLevelId] as const,
  async () => {
    chapters.value = []
    if (props.subjectId === '' || props.educationLevelId === '') return
    try {
      chapters.value = await fetchChapters({ subjectId: props.subjectId, educationLevelId: props.educationLevelId })
    } catch {
      chapters.value = []
    }
  },
  { immediate: true },
)

// Every opening starts clean.
watch(open, (isOpen) => {
  if (isOpen) {
    seq++
    chapterId.value = ''
    chapterError.value = undefined
    preview.value = null
    result.value = null
    errors.value = []
    dryRunning.value = false
  } else emit('close')
})

async function apply(): Promise<void> {
  if (blocked.value !== null) return
  if (chapterId.value === '') {
    chapterError.value = BULK_CHAPTER_CHOOSE
    return
  }
  if (preview.value === null || applying.value) return
  applying.value = true
  errors.value = []
  try {
    const r = await bulkChapter(body({ expectedCount: preview.value.matched }))
    result.value = r
    emit('done', r)
  } catch (err) {
    const stale = isApiError(err) && err.status === 409
    fail(err)
    if (stale) {
      // The live count changed: show the fresh counts so the admin can review them before applying again.
      const keep = errors.value
      await dryRun()
      errors.value = keep
    }
  } finally {
    applying.value = false
  }
}

const counts = computed<StatItem[]>(() =>
  preview.value === null
    ? []
    : [
        { key: 'matched', label: 'Sepadan', value: preview.value.matched },
        { key: 'eligible', label: 'Layak', value: preview.value.eligible },
        { key: 'refused', label: 'Ditolak', value: preview.value.refused },
      ],
)

const closePanel = (): void => {
  open.value = false
}
const canApply = computed(
  () => blocked.value === null && !dryRunning.value && !applying.value && (chapterId.value === '' || (preview.value !== null && preview.value.eligible > 0)),
)
</script>

<template>
  <DsDialog v-model:open="open" title="Tetapkan Bab" :loading="applying" data-testid="bulk-chapter-panel">
    <DsStack gap="md">
      <DsCallout v-if="blocked !== null" tone="error" :description="blocked" data-testid="bulk-chapter-blocked" />

      <template v-else-if="result === null">
        <ChapterSelect v-model="chapterId" :subject-id="subjectId" :level-id="educationLevelId" :error="chapterError" />

        <DsText v-if="dryRunning" variant="body" tone="muted" role="status" data-testid="bulk-chapter-loading">Memuatkan…</DsText>

        <DsStack v-else-if="preview !== null" gap="sm" data-testid="bulk-chapter-preview">
          <DsCallout tone="info" :description="bulkChapterDryLine(preview.eligible, chapterLabel)" data-testid="bulk-chapter-dryline" />
          <DsStatRow :items="counts" :cols="3" prefix="bulk-chapter" />
        </DsStack>
      </template>

      <DsCallout v-else tone="success" data-testid="bulk-chapter-result">
        <DsText variant="body" data-testid="bulk-chapter-result-line">{{ bulkChapterResultLine(result) }}</DsText>
        <DsText v-if="result.capped" variant="body" data-testid="bulk-chapter-capped">{{ bulkChapterCapped(result.remaining) }}</DsText>
      </DsCallout>

      <DsCallout v-if="errors.length > 0" tone="error" data-testid="bulk-chapter-error">
        <DsText v-for="(line, i) in errors" :key="i" variant="body">{{ line }}</DsText>
      </DsCallout>
    </DsStack>

    <template #footer>
      <template v-if="result === null">
        <UButton color="neutral" variant="outline" data-testid="bulk-chapter-cancel" @click="closePanel">Batal</UButton>
        <UButton
          :disabled="!canApply"
          :loading="applying"
          data-testid="bulk-chapter-apply"
          @click="apply"
        >
          Terapkan
        </UButton>
      </template>
      <UButton v-else data-testid="bulk-chapter-close" @click="closePanel">Tutup</UButton>
    </template>
  </DsDialog>
</template>
