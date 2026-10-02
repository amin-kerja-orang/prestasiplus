<script setup lang="ts">
/**
 * One S7 report card (M04-T6c; FR-M04-73…77, FR-M04-79…81, FN-M04-3.2.3…3.2.17): badge row, reason
 * pills, the question block, the student comment and the admin note; for `pending` and `reviewed`
 * reports the action column (notes textarea, "Tandakan Selesai", "Tolak & Aktifkan Semula", the
 * question link, "Buka Soalan Sama", "Nyahaktif Segera"). Actions need no confirm; a saved action tells
 * the page, which reloads the tab with the API flash.
 */
import {
  Ban,
  Check,
  CircleQuestionMark,
  CircleX,
  Clock,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Hash,
  Info,
  MessageCircle,
  SquarePen,
  StickyNote,
  X,
} from '@lucide/vue'
import { computed, ref, watch, type Component } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import {
  updateQuestionReport,
  type ReportDisplayStatus,
  type ReportUpdateInput,
  type ReportView,
} from '../../api/reports'
import {
  DEACTIVATE_NOTE,
  DISMISS_NOTE,
  DISPLAY_STATUS_LABEL,
  type ReportCategory,
} from '../../lib/report-reasons'

const props = defineProps<{ report: ReportView }>()
const emit = defineEmits<{ saved: [message: string]; failed: [error: unknown] }>()

const router = useRouter()

const STATUS_ICON: Record<ReportDisplayStatus, Component> = {
  pending: Clock,
  reviewed: Eye,
  fixed: Check,
  removed: Ban,
  dismissed: X,
}
const STATUS_CLASS: Record<ReportDisplayStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  reviewed: 'bg-blue-100 text-blue-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  removed: 'bg-red-100 text-red-600',
  dismissed: 'bg-slate-100 text-slate-600',
}
const BORDER_CLASS: Record<ReportDisplayStatus, string> = {
  pending: 'border-amber-300',
  reviewed: 'border-slate-300',
  fixed: 'border-emerald-300',
  removed: 'border-emerald-300',
  dismissed: 'border-slate-300',
}
const CATEGORY: Record<ReportCategory, { icon: Component; class: string }> = {
  'Lain-lain': { icon: Info, class: 'bg-slate-100 text-slate-600' },
  'Tak Jelas': { icon: CircleQuestionMark, class: 'bg-amber-100 text-amber-700' },
  'Jawapan Salah': { icon: CircleX, class: 'bg-red-100 text-red-600' },
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const BADGE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold'
const BUTTON =
  'flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60'

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
    ? { to: `/admin/structured-questions/${String(r.value.questionId)}`, icon: Eye }
    : { to: `/admin/questions/${String(r.value.questionId)}/edit`, icon: SquarePen },
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
</script>

<template>
  <article
    :class="[
      'flex min-w-0 flex-col gap-4 rounded-2xl border-2 bg-white p-4 shadow-sm sm:p-5 lg:flex-row',
      BORDER_CLASS[r.displayStatus],
    ]"
    :data-testid="`report-card-${String(r.id)}`"
    data-card="report"
    :data-status="r.displayStatus"
  >
    <div class="min-w-0 flex-1 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span :class="[BADGE, STATUS_CLASS[r.displayStatus]]" data-testid="report-status">
          <component :is="STATUS_ICON[r.displayStatus]" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ DISPLAY_STATUS_LABEL[r.displayStatus] }}
        </span>
        <span :class="[BADGE, CATEGORY[r.category].class]" data-testid="report-category">
          <component :is="CATEGORY[r.category].icon" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ r.category }}
        </span>
        <span
          v-if="inactive"
          :class="[BADGE, 'bg-red-100 text-red-600']"
          data-testid="report-inactive"
        >
          <Ban class="h-3.5 w-3.5" aria-hidden="true" />
          Dinyahaktif
        </span>
        <span
          v-if="r.sourceSet"
          :class="[BADGE, 'bg-slate-100 text-slate-700']"
          data-testid="report-source-set"
        >
          <Database class="h-3.5 w-3.5" aria-hidden="true" />
          {{ r.sourceSet }}
        </span>
        <span class="text-xs text-slate-500" data-testid="report-reporter">
          Oleh: <strong class="font-semibold">{{ r.reporter.name ?? '-' }}</strong>
        </span>
        <span class="text-xs text-slate-500" data-testid="report-time">{{
          diffForHumans(r.createdAt)
        }}</span>
        <span v-if="r.roomCode" class="text-xs text-slate-500" data-testid="report-room">
          Bilik: {{ r.roomCode }}
        </span>
        <span :class="[BADGE, 'bg-violet-100 text-violet-700']" data-testid="report-question-id">
          <Hash class="h-3.5 w-3.5" aria-hidden="true" />
          ID Soalan: {{ r.questionId }}
        </span>
      </div>

      <div class="flex flex-wrap gap-2" data-testid="report-reasons">
        <span
          v-for="(label, i) in r.reasonLabels"
          :key="`${String(i)}-${label}`"
          class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
          data-testid="report-reason"
          >{{ label }}</span
        >
      </div>

      <div class="rounded-xl bg-slate-50 p-3 sm:p-4" data-testid="report-question">
        <p class="flex items-start gap-2 text-sm font-bold text-slate-700">
          <FileText class="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>{{ isStructured ? 'Soalan Struktur' : 'Soalan' }} #{{ r.questionId }}:</span>
        </p>
        <p v-if="!q.exists" class="mt-1 text-sm text-slate-500" data-testid="report-missing">
          Soalan tidak dijumpai
        </p>
        <template v-else>
          <p class="mt-1 text-sm break-words whitespace-pre-line text-slate-700">{{ q.text }}</p>
          <ul v-if="!isStructured && options.length > 0" class="mt-2 grid gap-1 sm:grid-cols-2">
            <li
              v-for="o in options"
              :key="o.letter"
              :class="[
                'flex items-center gap-1 rounded px-2 py-1 text-xs break-words',
                o.correct ? 'bg-emerald-100 font-semibold text-emerald-800' : 'text-slate-600',
              ]"
              :data-correct="o.correct"
            >
              <span>{{ o.letter }}. {{ o.text }}</span>
              <Check v-if="o.correct" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </li>
          </ul>
          <p class="mt-2 text-xs text-slate-500">{{ q.subjectName }} — {{ q.levelName }}</p>
          <p class="text-xs text-slate-500">Compliance: {{ q.complianceStatus }}</p>
        </template>
      </div>

      <div
        v-if="r.comment"
        class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
        data-testid="report-comment"
      >
        <p class="flex items-center gap-2 text-xs font-bold">
          <MessageCircle class="h-3.5 w-3.5" aria-hidden="true" />
          Komen pelajar:
        </p>
        <p class="mt-1 break-words whitespace-pre-line">{{ r.comment }}</p>
      </div>

      <div
        v-if="r.adminNotes"
        class="rounded-xl bg-blue-50 p-3 text-sm text-blue-800"
        data-testid="report-admin-notes"
      >
        <p class="flex items-center gap-2 text-xs font-bold">
          <StickyNote class="h-3.5 w-3.5" aria-hidden="true" />
          Status tindakan admin:
        </p>
        <p class="mt-1 break-words whitespace-pre-line">{{ r.adminNotes }}</p>
      </div>
    </div>

    <div
      v-if="hasActions"
      class="w-full space-y-2 lg:w-64 lg:shrink-0"
      data-testid="report-actions"
    >
      <textarea
        v-model="notes"
        rows="2"
        name="admin_notes"
        placeholder="Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama..."
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
        data-testid="report-notes"
      ></textarea>
      <button
        type="button"
        :disabled="busy"
        :class="[BUTTON, 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-300']"
        data-testid="report-fix"
        @click="markFixed"
      >
        <Check class="h-4 w-4" aria-hidden="true" />
        Tandakan Selesai
      </button>
      <button
        type="button"
        :disabled="busy"
        :class="[BUTTON, 'bg-slate-400 hover:bg-slate-500 focus-visible:ring-slate-300']"
        data-testid="report-dismiss"
        @click="dismiss"
      >
        <X class="h-4 w-4" aria-hidden="true" />
        Tolak &amp; Aktifkan Semula
      </button>
      <RouterLink
        v-if="q.exists"
        :to="questionLink.to"
        :class="[BUTTON, 'bg-violet-500 hover:bg-violet-600 focus-visible:ring-violet-300']"
        data-testid="report-question-link"
      >
        <component :is="questionLink.icon" class="h-4 w-4" aria-hidden="true" />
        {{ isStructured ? 'Lihat Soalan Struktur' : 'Edit Soalan' }} #{{ r.questionId }}
      </RouterLink>
      <a
        v-if="practiceHref"
        :href="practiceHref"
        target="_blank"
        rel="noopener"
        :class="[BUTTON, 'bg-sky-500 hover:bg-sky-600 focus-visible:ring-sky-300']"
        data-testid="report-open"
      >
        <ExternalLink class="h-4 w-4" aria-hidden="true" />
        Buka Soalan Sama
      </a>
      <button
        v-if="q.exists && q.isActive"
        type="button"
        :disabled="busy"
        :class="[BUTTON, 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-300']"
        data-testid="report-deactivate"
        @click="deactivate"
      >
        <Ban class="h-4 w-4" aria-hidden="true" />
        Nyahaktif Segera
      </button>
    </div>
  </article>
</template>
