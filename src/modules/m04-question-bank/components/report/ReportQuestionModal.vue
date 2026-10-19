<script setup lang="ts">
/**
 * S14 `ReportQuestionModal` (M04-T6a; FR-M04-64…71, FR-M04-118, FN-M04-3.1.3…3.1.9; XL-09). The report
 * form the practice hosts (M05 quizzes, M06 pools, structured practice) open from their own trigger
 * ("Lapor Soalan" / "Lapor"); the host owns `open` (`v-model:open`), this component owns the form.
 *
 * - Opening resets the reasons, the comment and the state (as live `openReport`).
 * - "Hantar Laporan" is disabled while no reason is ticked or while sending ("Menghantar...").
 * - Sent: "Terima Kasih!" + the server message (fallback "Laporan berjaya dihantar.") + "Tutup".
 *   A failed request shows the same view with `failureText` (live quirk, SRS FR-M04-69 / M05 E2E-35).
 * - Props: `source` (default `spm` for mcq, `structured_attempt` for structured), `failureText`
 *   (default "Ralat. Sila cuba lagi."), `tints` (reason → ticked colour; `tint` is an alias).
 * - Closes on "Batal", the X, the backdrop and Esc without sending (BaseModal "margin", no ARIA, D10).
 */
import { Check, Flag, LoaderCircle, Send, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { BaseModal } from '@/components/overlay'

import { createQuestionReport, type ReportSource } from '../../api/reports'
import {
  REPORT_COMMENT_MAX,
  REPORT_FAILURE_TEXT,
  reasonSet,
  type ReportTint,
  type ReportVariant,
} from '../../lib/report-reasons'
import { REPORT_TINT_CLASS, REPORT_TINT_IDLE_CLASS } from './tints'

const DEFAULT_SUCCESS = 'Laporan berjaya dihantar.'

const props = withDefaults(
  defineProps<{
    open: boolean
    questionId: number
    variant?: ReportVariant
    quizSessionId?: string | null
    source?: ReportSource
    failureText?: string
    tints?: Readonly<Record<string, ReportTint>>
    /** Alias of `tints` (build-plan M04-T6a names the prop `tint`). */
    tint?: Readonly<Record<string, ReportTint>>
  }>(),
  {
    variant: 'mcq',
    quizSessionId: null,
    source: undefined,
    failureText: REPORT_FAILURE_TEXT,
    tints: undefined,
    tint: undefined,
  },
)

const emit = defineEmits<{
  'update:open': [value: false]
  /** After the request settled: `ok` false = the failure view is shown. */
  reported: [result: { ok: boolean; message: string }]
}>()

const reasons = computed(() => reasonSet(props.variant))
const selected = ref<string[]>([])
const comment = ref('')
const loading = ref(false)
const submitted = ref(false)
const message = ref('')

/** Bumped on every reopen and submit; a response of an older request is ignored. */
let requestSeq = 0

function reset(): void {
  requestSeq += 1
  selected.value = []
  comment.value = ''
  loading.value = false
  submitted.value = false
  message.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
  { immediate: true },
)

function tintOf(value: string, own: ReportTint): ReportTint {
  return (props.tints ?? props.tint)?.[value] ?? own
}

function cardClass(value: string, own: ReportTint): string {
  return selected.value.includes(value)
    ? REPORT_TINT_CLASS[tintOf(value, own)]
    : REPORT_TINT_IDLE_CLASS
}

const sourceValue = computed<ReportSource>(
  () => props.source ?? (props.variant === 'mcq' ? 'spm' : 'structured_attempt'),
)

async function submit(): Promise<void> {
  if (selected.value.length === 0 || loading.value) return
  loading.value = true
  const mine = ++requestSeq
  try {
    const res = await createQuestionReport({
      questionId: props.questionId,
      ...(props.variant === 'structured' ? { questionType: 'structured' as const } : {}),
      reasons: [...selected.value],
      comment: comment.value,
      ...(props.quizSessionId ? { quizSessionId: props.quizSessionId } : {}),
      source: sourceValue.value,
    })
    if (mine !== requestSeq) return
    message.value = res.message || DEFAULT_SUCCESS
    emit('reported', { ok: true, message: message.value })
  } catch {
    if (mine !== requestSeq) return
    message.value = props.failureText
    emit('reported', { ok: false, message: message.value })
  } finally {
    if (mine === requestSeq) {
      loading.value = false
      submitted.value = true
    }
  }
}

const SUBTITLE = computed(() =>
  props.variant === 'mcq'
    ? 'Soalan ini akan dinyahaktifkan sementara'
    : 'Soalan ini akan dinyahaktifkan selepas 3 laporan',
)

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2'
</script>

<template>
  <BaseModal :open="open" data-testid="report-modal" @update:open="emit('update:open', false)">
    <template #default="{ close }">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-500"
          >
            <Flag class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <h3 class="font-heading text-lg font-bold text-slate-800" data-testid="report-title">
              Lapor Soalan
            </h3>
            <p class="text-xs text-slate-500" data-testid="report-subtitle">{{ SUBTITLE }}</p>
          </div>
        </div>
        <button
          type="button"
          class="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          data-testid="report-close"
          @click="close"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div v-if="submitted" class="py-6 text-center" data-testid="report-done">
        <div
          class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <Check class="h-7 w-7" aria-hidden="true" />
        </div>
        <h4 class="font-heading text-lg font-bold text-slate-800">Terima Kasih!</h4>
        <p class="mt-1 text-sm text-slate-600" data-testid="report-message">{{ message }}</p>
        <button
          type="button"
          :class="[
            BUTTON,
            'mt-5 bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-300',
          ]"
          data-testid="report-done-close"
          @click="close"
        >
          Tutup
        </button>
      </div>

      <form v-else class="space-y-4" data-testid="report-form" @submit.prevent="submit">
        <div>
          <p class="mb-2 text-sm font-semibold text-slate-700">
            Sebab Laporan <span class="text-red-500">*</span>
          </p>
          <div class="space-y-2">
            <label
              v-for="r in reasons"
              :key="r.value"
              :class="[
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition',
                cardClass(r.value, r.tint),
              ]"
              :data-testid="`report-reason-${r.value}`"
            >
              <input
                v-model="selected"
                type="checkbox"
                :value="r.value"
                class="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-800">{{ r.label }}</span>
                <span class="block text-xs text-slate-500">{{ r.description }}</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label for="report-comment" class="mb-1 block text-sm font-semibold text-slate-700">
            Komen Tambahan <span class="font-normal text-slate-400">(pilihan)</span>
          </label>
          <textarea
            id="report-comment"
            v-model="comment"
            rows="3"
            :maxlength="REPORT_COMMENT_MAX"
            placeholder="Terangkan masalah soalan ini..."
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none"
            data-testid="report-comment"
          ></textarea>
          <p class="mt-1 text-right text-xs text-slate-400" data-testid="report-counter">
            {{ comment.length }}/{{ REPORT_COMMENT_MAX }}
          </p>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            :class="[
              BUTTON,
              'border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:ring-slate-300',
            ]"
            data-testid="report-cancel"
            @click="close"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="selected.length === 0 || loading"
            :class="[
              BUTTON,
              'bg-red-500 text-white shadow hover:bg-red-600 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50',
            ]"
            data-testid="report-submit"
          >
            <template v-if="loading">
              <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
              Menghantar...
            </template>
            <template v-else>
              <Send class="h-4 w-4" aria-hidden="true" />
              Hantar Laporan
            </template>
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
