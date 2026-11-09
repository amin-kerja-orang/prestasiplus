<script setup lang="ts">
/**
 * `/admin/spm/soalan/:id/pratonton` "Pratonton Soalan" (V2 Panel `spm/soalan-preview`, WA 2026-08-18): the read-only page a reviewer opens
 * from the Pratonton action of the SPM lanes to check a bank question BEFORE it is approved to students. The correct option carries a
 * check mark. Nothing is written and there are no controls. Question text and options are rendered as escaped text (a plain string
 * child, never raw HTML), which is also what pupils see.
 */
import { computed, watch } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsBackLink, DsLoadError, DsPage, DsPanel } from '@/ds'

import { fetchQuestion, type QuestionDetail } from '../api/questions'
import { imageSrc } from '../lib/image-url'
import { LOAD_ERROR, isNotFound } from '../lib/ui-errors'

const props = defineProps<{ id: string | number }>()

const BACK_PATH = '/admin/spm/databank'
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draf',
  review: 'Menunggu Semakan',
  pending_review: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
  archived: 'Diarkibkan',
}
const STATUS_COLOR: Record<string, 'success' | 'neutral' | 'warning' | 'error'> = {
  approved: 'success',
  draft: 'neutral',
  review: 'warning',
  pending_review: 'warning',
  rejected: 'error',
  archived: 'neutral',
}

const { data: q, error, reload } = useApi<QuestionDetail>((signal) => fetchQuestion(Number(props.id), { signal }), () => props.id)
const notFound = computed(() => isNotFound(error.value))
watch(notFound, (is404) => is404 && setRouteOutcome(404), { immediate: true })

const options = computed(() => (q.value?.options ?? []).filter((o) => o !== ''))
const optionLetter = (i: number): string => String.fromCharCode(65 + i)
/** What a non-option question has as its answer: the answer text, else the model answer. */
const answerText = computed(() => q.value?.correctAnswerText ?? q.value?.modelAnswer ?? null)
const info = computed<[string, string][]>(() => {
  const d = q.value
  if (!d) return []
  const rows: [string, string | number | null][] = [
    ['Subjek', d.subject?.name ?? null],
    ['Tingkatan', d.level?.name ?? null],
    ['Kesukaran', d.difficultyLevel],
    ['Markah', d.pointsValue],
  ]
  return rows.filter((r): r is [string, string | number] => r[1] !== null && r[1] !== '').map(([k, v]) => [k, String(v)])
})
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="preview-page">
    <template #breadcrumb>
      <DsBackLink :to="BACK_PATH" label="Kembali ke Databank" data-testid="preview-back" />
    </template>

    <DsLoadError v-if="error && !notFound" :message="LOAD_ERROR" testid="preview-error" retry-testid="preview-retry" @retry="reload()" />

    <div v-else-if="!q" class="flex flex-col gap-4" data-testid="preview-skeleton">
      <USkeleton class="h-56 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <DsPanel data-testid="preview-card">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-subheading text-highlighted" data-testid="preview-title">Soalan #{{ q.id }}</h2>
          <UBadge :color="STATUS_COLOR[q.status] ?? 'neutral'" variant="outline" size="sm" :label="STATUS_LABEL[q.status] ?? q.status" data-testid="preview-status" />
          <UBadge color="info" variant="subtle" size="sm" icon="i-ph-eye" label="Pratonton (baca sahaja)" data-testid="preview-readonly" />
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <img
            v-if="q.questionImage"
            :src="imageSrc(q.questionImage)"
            alt=""
            loading="lazy"
            class="max-h-96 w-full rounded-lg border border-default object-contain"
            data-testid="preview-image"
          />

          <p class="text-body font-semibold break-words whitespace-pre-line text-highlighted" data-testid="preview-body">{{ q.questionText }}</p>

          <ul v-if="options.length > 0" class="flex flex-col gap-2" data-testid="preview-options">
            <li
              v-for="(opt, i) in options"
              :key="i"
              class="flex items-start gap-3 rounded-xl border-2 px-4 py-3"
              :class="i === q.correctAnswer ? 'border-success bg-success/10' : 'border-default'"
              :data-correct="i === q.correctAnswer ? 'true' : 'false'"
              data-testid="preview-option"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-lg text-caption font-bold"
                :class="i === q.correctAnswer ? 'bg-success text-inverted' : 'bg-elevated text-default'"
                >{{ optionLetter(i) }}</span
              >
              <span class="min-w-0 text-body break-words whitespace-pre-line">{{ opt }}</span>
              <span v-if="i === q.correctAnswer" class="ms-auto shrink-0 text-success" title="Jawapan betul" aria-label="Jawapan betul" data-testid="preview-tick">✓</span>
            </li>
          </ul>

          <div v-else-if="answerText" class="rounded-xl border-2 border-success bg-success/10 px-4 py-3" data-testid="preview-answer">
            <p class="text-caption text-success">Jawapan betul ✓</p>
            <p class="text-body break-words whitespace-pre-line">{{ answerText }}</p>
          </div>
        </div>
      </DsPanel>

      <DsPanel v-if="info.length > 0" data-testid="preview-info">
        <h2 class="text-subheading text-highlighted">Maklumat</h2>
        <dl class="mt-2 grid grid-cols-1 gap-2 text-body sm:grid-cols-2">
          <div v-for="[label, value] in info" :key="label" class="flex justify-between gap-3 border-b border-default py-1 last:border-b-0">
            <dt class="text-muted">{{ label }}</dt>
            <dd class="font-medium text-highlighted">{{ value }}</dd>
          </div>
        </dl>
      </DsPanel>
    </template>
  </DsPage>
</template>
