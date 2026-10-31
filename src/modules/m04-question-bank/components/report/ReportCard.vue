<script setup lang="ts">
/**
 * One S7 report card (M04-T6c; FR-M04-73…77, FR-M04-79…81, FN-M04-3.2.3…3.2.17): badge row, reason
 * pills, the question block, the student comment and the admin note; for `pending` and `reviewed`
 * reports the action column (notes textarea, "Tandakan Selesai", "Tolak & Aktifkan Semula", the
 * question link, "Buka Soalan Sama", "Nyahaktif Segera"). Actions need no confirm; a saved action tells
 * the page, which reloads the tab with the API flash.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { DsStatusBadge } from '@/ds'
import { diffForHumans } from '@/lib/time'

import {
  updateQuestionReport,
  type ReportUpdateInput,
  type ReportView,
} from '../../api/reports'
import {
  ARCHIVE_NOTE,
  DEACTIVATE_NOTE,
  DISMISS_NOTE,
  DISPLAY_STATUS_DS,
  DISPLAY_STATUS_LABEL,
  type ReportCategory,
} from '../../lib/report-reasons'

const props = defineProps<{ report: ReportView }>()
const emit = defineEmits<{ saved: [message: string]; failed: [error: unknown] }>()

const router = useRouter()

const CATEGORY: Record<
  ReportCategory,
  { icon: string; color: 'warning' | 'error' | 'neutral' }
> = {
  'Lain-lain': { icon: 'i-ph-info', color: 'neutral' },
  'Tak Jelas': { icon: 'i-ph-question', color: 'warning' },
  'Jawapan Salah': { icon: 'i-ph-x-circle', color: 'error' },
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const r = computed(() => props.report)
const q = computed(() => r.value.question)
const isStructured = computed(() => r.value.questionType === 'structured')
const hasActions = computed(() => r.value.status === 'pending' || r.value.status === 'reviewed')
const inactive = computed(() => q.value.exists && q.value.isActive === false)
const options = computed(() =>
  (q.value.options ?? []).map((text, i) => ({
    letter: LETTERS[i] ?? '',
    text,
    correct: q.value.correctAnswer === i,
  })),
)
const questionLink = computed(() =>
  isStructured.value
    ? { to: `/admin/structured-questions/${String(r.value.questionId)}`, icon: 'i-ph-eye' }
    : { to: `/admin/questions/${String(r.value.questionId)}/edit`, icon: 'i-ph-pencil-simple' },
)
const practiceHref = computed(() => {
  const url = q.value.practiceUrl
  return url ? router.resolve(url).href : null
})

const notes = ref(r.value.adminNotes ?? '')
watch(
  () => r.value.adminNotes,
  (value) => {
    notes.value = value ?? ''
  },
)
const busy = ref(false)

async function act(input: ReportUpdateInput): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await updateQuestionReport(r.value.id, input)
    emit('saved', result.status)
  } catch (err) {
    emit('failed', err)
  } finally {
    busy.value = false
  }
}

const markFixed = () => act({ status: 'fixed', adminNotes: notes.value })
const dismiss = () => act({ status: 'dismissed', adminNotes: DISMISS_NOTE, reactivate: true })
const deactivate = () =>
  act({ status: 'reviewed', adminNotes: DEACTIVATE_NOTE, forceDeactivate: true })
const archive = () => act({ status: 'reviewed', adminNotes: ARCHIVE_NOTE, archive: true })
</script>

<template>
  <UCard
    :data-testid="`report-card-${String(r.id)}`"
    data-card="report"
    :data-status="r.displayStatus"
  >
    <article class="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <DsStatusBadge
            :status="DISPLAY_STATUS_DS[r.displayStatus]"
            :label="DISPLAY_STATUS_LABEL[r.displayStatus]"
            data-testid="report-status"
          />
          <UBadge
            :color="CATEGORY[r.category].color"
            variant="subtle"
            :icon="CATEGORY[r.category].icon"
            :label="r.category"
            data-testid="report-category"
          />
          <UBadge
            v-if="inactive"
            color="error"
            variant="subtle"
            icon="i-ph-prohibit"
            label="Dinyahaktif"
            data-testid="report-inactive"
          />
          <UBadge
            v-if="r.sourceSet"
            color="neutral"
            variant="subtle"
            icon="i-ph-database"
            :label="r.sourceSet"
            data-testid="report-source-set"
          />
          <span class="text-caption text-muted" data-testid="report-reporter">
            Oleh: <strong class="text-label">{{ r.reporter.name ?? '-' }}</strong>
          </span>
          <span class="text-caption text-muted" data-testid="report-time">{{
            diffForHumans(r.createdAt)
          }}</span>
          <span v-if="r.roomCode" class="text-caption text-muted" data-testid="report-room">
            Bilik: {{ r.roomCode }}
          </span>
          <UBadge
            color="neutral"
            variant="outline"
            icon="i-ph-hash"
            :label="`ID Soalan: ${String(r.questionId)}`"
            data-testid="report-question-id"
          />
        </div>

        <div class="flex flex-wrap gap-2" data-testid="report-reasons">
          <UBadge
            v-for="(label, i) in r.reasonLabels"
            :key="`${String(i)}-${label}`"
            color="neutral"
            variant="soft"
            :label="label"
            data-testid="report-reason"
          />
        </div>

        <UCard variant="subtle" data-testid="report-question">
          <p class="flex items-start gap-2 text-label text-highlighted">
            <UIcon name="i-ph-file-text" class="mt-1 size-4 shrink-0 text-muted" />
            <span>{{ isStructured ? 'Soalan Struktur' : 'Soalan' }} #{{ r.questionId }}:</span>
          </p>
          <p v-if="!q.exists" class="mt-1 text-body text-muted" data-testid="report-missing">
            Soalan tidak dijumpai
          </p>
          <template v-else>
            <p class="mt-1 text-body break-words whitespace-pre-line text-default">{{ q.text }}</p>
            <ul v-if="!isStructured && options.length > 0" class="mt-2 grid gap-1 sm:grid-cols-2">
              <li
                v-for="o in options"
                :key="o.letter"
                class="flex items-center gap-1 text-caption break-words"
                :class="o.correct ? 'text-success' : 'text-muted'"
                :data-correct="o.correct"
              >
                <span :class="o.correct ? 'text-label' : ''">{{ o.letter }}. {{ o.text }}</span>
                <UIcon v-if="o.correct" name="i-ph-check" class="size-4 shrink-0" />
              </li>
            </ul>
            <p class="mt-2 text-caption text-muted">{{ q.subjectName }} — {{ q.levelName }}</p>
            <p class="text-caption text-muted">Compliance: {{ q.complianceStatus }}</p>
          </template>
        </UCard>

        <UAlert
          v-if="r.comment"
          color="warning"
          variant="subtle"
          icon="i-ph-chat-circle"
          title="Komen pelajar:"
          data-testid="report-comment"
        >
          <template #description>
            <span class="break-words whitespace-pre-line">{{ r.comment }}</span>
          </template>
        </UAlert>

        <UAlert
          v-if="r.adminNotes"
          color="info"
          variant="subtle"
          icon="i-ph-note"
          title="Status tindakan admin:"
          data-testid="report-admin-notes"
        >
          <template #description>
            <span class="break-words whitespace-pre-line">{{ r.adminNotes }}</span>
          </template>
        </UAlert>
      </div>

      <div
        v-if="hasActions"
        class="flex w-full flex-col gap-2 lg:w-64 lg:shrink-0"
        data-testid="report-actions"
      >
        <UTextarea
          v-model="notes"
          :rows="2"
          name="admin_notes"
          aria-label="Nota admin"
          placeholder="Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama..."
          class="w-full"
          data-testid="report-notes"
        />
        <UButton
          type="button"
          color="success"
          icon="i-ph-check"
          block
          :disabled="busy"
          class="min-h-11"
          data-testid="report-fix"
          @click="markFixed"
        >
          Tandakan Selesai
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-x"
          block
          :disabled="busy"
          class="min-h-11"
          data-testid="report-dismiss"
          @click="dismiss"
        >
          Tolak &amp; Aktifkan Semula
        </UButton>
        <UButton
          v-if="q.exists"
          :to="questionLink.to"
          color="neutral"
          variant="soft"
          :icon="questionLink.icon"
          block
          class="min-h-11"
          data-testid="report-question-link"
        >
          {{ isStructured ? 'Lihat Soalan Struktur' : 'Edit Soalan' }} #{{ r.questionId }}
        </UButton>
        <UButton
          v-if="practiceHref"
          :to="practiceHref"
          target="_blank"
          rel="noopener"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-square-out"
          block
          class="min-h-11"
          data-testid="report-open"
        >
          Buka Soalan Sama
        </UButton>
        <UButton
          v-if="q.exists && q.isActive"
          type="button"
          color="error"
          variant="soft"
          icon="i-ph-prohibit"
          block
          :disabled="busy"
          class="min-h-11"
          data-testid="report-deactivate"
          @click="deactivate"
        >
          Nyahaktif Segera
        </UButton>
        <UButton
          v-if="q.exists"
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-archive"
          block
          :disabled="busy"
          class="min-h-11"
          data-testid="report-archive"
          @click="archive"
        >
          Arkib
        </UButton>
      </div>
    </article>
  </UCard>
</template>
