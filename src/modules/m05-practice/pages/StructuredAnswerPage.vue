<script setup lang="ts">
/**
 * Q3 `/latihan-berstruktur/:id/jawab[?scope=spm[&track=bahasa]]` — the structured answer page
 * (46 section 4.6, R1-MUR-17; S5-T11 part "answer").
 *
 * - Loads #16 with `scope` / `track`; unknown or non-numeric id → the global 404 page.
 * - The parts are a tree (part, then sub-parts) derived from the label chain of the flat wire
 *   ("(a).(i).(A)"); the stimulus shows once through the shared `StimulusGroup`; the prompts go through
 *   `RichText`. One textarea per leaf with "[{marks} markah]".
 * - Autosave (AC-MUR-17-2): the draft is kept in localStorage per user and question (800 ms debounce),
 *   restored when the page reopens and cleared after a successful submit.
 * - "Hantar & Semak" asks first when a leaf is blank (2.8); leaving with typed answers asks too.
 * - "Hantar & Semak" posts #17 with `scope` / `track` and shows the result placeholder (§8.3): marks per
 *   sub-question, "Skema jawapan:" and "Jumlah: {a}/{b} markah". Field errors (422) are listed.
 * - The back link is the `backUrl` of #16 (plain list or the SPM variant list, FR-M05-137).
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { RichText, StimulusGroup } from '../../../components/question-display'
import type { StimulusData } from '../../../components/question-display'
import { useApi, useSession } from '@/composables'
import { DsCluster, DsDialog, DsHeading, DsLoadError, DsStack, DsStickyActions, DsText } from '@/ds'
import { ReportQuestionModal } from '@/modules/m04-question-bank'

import { fetchStructuredDetail, submitStructuredAttempt } from '../api/practice'
import type { StructuredAttemptResult } from '../api/types'
import { marksLabel, parseVariant, safeImageSrc } from '../components/structured/structured-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const SUBMIT_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const INSTRUCTION = '✍️ Tulis jawapan anda, kemudian tekan Hantar & Semak.'
const SAVE_DEBOUNCE_MS = 800

const route = useRoute()
const { user } = useSession()

// The id is opaque: a string from the API, decimal text for a mock number. An unknown id is a 404
// from the API (both modes), so only an empty param is rejected here.
const id = computed(() => String(route.params.id ?? ''))
const variant = computed(() => parseVariant(route.query))

const { data, error, reload } = useApi(
  (signal) =>
    id.value === ''
      ? Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
      : fetchStructuredDetail(id.value, variant.value, { signal }),
  [id, () => route.query],
)

const notFound = computed(
  () =>
    error.value !== null &&
    ((isApiError(error.value) && error.value.status === 404) ||
      (error.value as { status?: number }).status === 404),
)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const answers = reactive<Record<number, string>>({})
const result = ref<StructuredAttemptResult | null>(null)
const sending = ref(false)
const errors = ref<string[]>([])
const reportOpen = ref(false)
const blankOpen = ref(false)
const leaveOpen = ref(false)

// ---- the part tree (derived from the label chain of the flat wire) --------------------------------

interface Row {
  id: number
  label: string
  text: string
  marks: number
  depth: number
  /** A part that holds sub-parts is stem text, not an answer field (V2: only leaves take answers). */
  leaf: boolean
}
interface Root {
  id: number
  rows: Row[]
}

/** The server joins the label chain with dots ("(a).(i)"); V2 and Bijak read "(a)(i)". */
const labelOf = (label: string): string => label.replace(/\)\.\(/g, ')(')
/** "(a).(i).(A)" → ["(a)", "(i)", "(A)"]. */
const chainOf = (label: string): string[] => label.split(/\.(?=\()/)

const tree = computed<Root[]>(() => {
  const subs = data.value?.subQuestions ?? []
  const byChain = new Map<string, (typeof subs)[number]>()
  for (const s of subs) byChain.set(s.label, s)
  const hasChildren = new Set<string>()
  const parentOf = (label: string): string | null => {
    const c = chainOf(label)
    return c.length > 1 ? c.slice(0, -1).join('.') : null
  }
  for (const s of subs) {
    const p = parentOf(s.label)
    if (p !== null && byChain.has(p)) hasChildren.add(p)
  }
  const roots: Root[] = []
  let current: Root | undefined
  for (const s of subs) {
    const p = parentOf(s.label)
    const nested = p !== null && byChain.has(p)
    const row: Row = {
      id: s.id,
      label: s.label,
      text: s.text,
      marks: s.marks,
      depth: nested ? Math.min(chainOf(s.label).length - 1, 4) : 0,
      leaf: !hasChildren.has(s.label),
    }
    if (!nested || current === undefined) {
      current = { id: s.id, rows: [row] }
      roots.push(current)
    } else current.rows.push(row)
  }
  return roots
})
const leaves = computed(() => tree.value.flatMap((r) => r.rows).filter((r) => r.leaf))
const totalMarks = computed(() => leaves.value.reduce((n, r) => n + r.marks, 0))
const blankCount = computed(
  () => leaves.value.filter((r) => (answers[r.id] ?? '').trim() === '').length,
)
const hasTyped = computed(() => leaves.value.some((r) => (answers[r.id] ?? '').trim() !== ''))

// ---- stimulus (shown once) -----------------------------------------------------------------------

const image = computed(() => safeImageSrc(data.value?.stimulusImage))
const stimuli = computed<StimulusData[]>(() => {
  const out: StimulusData[] = []
  const text = data.value?.stimulus ?? ''
  if (text.trim() !== '') out.push({ id: 'stimulus', kind: 'passage', text })
  if (image.value) out.push({ id: 'figure', kind: 'image', src: image.value, alt: 'Rajah soalan' })
  return out
})

const marksOf = (subId: number) => result.value?.marks.find((m) => m.subQuestionId === subId)
const modelOf = (subId: number) =>
  result.value?.modelAnswers.find((m) => m.subQuestionId === subId)?.text ?? ''

// ---- autosave and restore (AC-MUR-17-2) -------------------------------------------------------------

const draftKey = computed(
  () =>
    `pp:structured-draft:${String(user.value?.id ?? 'anon')}:${id.value}${
      variant.value.scope ? `:spm${variant.value.track ? ':bahasa' : ''}` : ''
    }`,
)

function readDraft(key: string): Record<number, string> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<number, string> = {}
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[Number(k)] = v
    return out
  } catch {
    return {}
  }
}
function writeDraft(key: string): void {
  try {
    const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== ''))
    if (Object.keys(filled).length === 0) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(filled))
  } catch {
    // Storage full or blocked (private mode): the page works without a draft.
  }
}
function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
let dirtyKey: string | null = null
function flushDraft(): void {
  clearTimeout(timer)
  if (dirtyKey !== null && result.value === null) writeDraft(dirtyKey)
  dirtyKey = null
}
function scheduleSave(): void {
  dirtyKey = draftKey.value
  clearTimeout(timer)
  timer = setTimeout(flushDraft, SAVE_DEBOUNCE_MS)
}

// A new set starts with its own saved draft (or empty answers) and no result.
watch(
  [() => data.value?.id, draftKey],
  () => {
    flushDraft()
    for (const k of Object.keys(answers)) delete answers[Number(k)]
    result.value = null
    errors.value = []
    if (!data.value) return
    const saved = readDraft(draftKey.value)
    for (const r of leaves.value) if (saved[r.id] !== undefined) answers[r.id] = saved[r.id] ?? ''
  },
  { immediate: true, flush: 'post' },
)
function onInput(subId: number, value: string): void {
  answers[subId] = value
  scheduleSave()
}
onBeforeUnmount(() => {
  flushDraft()
  clearTimeout(timer)
  window.visualViewport?.removeEventListener('resize', keepFocusedVisible)
})

// ---- submit ---------------------------------------------------------------------------------------

/** "Hantar & Semak": a blank leaf asks first (2.8), otherwise it goes straight through. */
function press(): void {
  if (!data.value || sending.value || result.value) return
  if (blankCount.value > 0) blankOpen.value = true
  else void submit()
}

async function submit(): Promise<void> {
  if (!data.value || sending.value || result.value) return
  sending.value = true
  errors.value = []
  try {
    result.value = await submitStructuredAttempt(id.value, {
      answers: data.value.subQuestions.map((s) => ({
        subQuestionId: s.id,
        text: answers[s.id] ?? '',
      })),
      scope: variant.value.scope,
      track: variant.value.track,
    })
    clearTimeout(timer)
    dirtyKey = null
    clearDraft(draftKey.value)
    blankOpen.value = false
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  } catch (e) {
    blankOpen.value = false
    const fields = isApiError(e) ? e.fields : undefined
    errors.value = fields && Object.keys(fields).length > 0 ? Object.values(fields) : [SUBMIT_ERROR]
  } finally {
    sending.value = false
  }
}

// ---- dialogs: focus starts on the safe button; Esc / outside tap = the safe button -------------------

const blankSafe = ref<{ $el: HTMLElement } | null>(null)
const leaveSafe = ref<{ $el: HTMLElement } | null>(null)
/** Passed to the dialog's modal / sheet: focus starts on the safe button, not the close icon. */
const safeFocus = (el: () => { $el: HTMLElement } | null) => ({
  onOpenAutoFocus: (e: Event): void => {
    e.preventDefault()
    el()?.$el.focus()
  },
})
const blankContent = safeFocus(() => blankSafe.value)
const leaveContent = safeFocus(() => leaveSafe.value)

let leaveDecision: ((stay: boolean) => void) | null = null
function decideLeave(leave: boolean): void {
  const d = leaveDecision
  leaveDecision = null
  leaveOpen.value = false
  d?.(!leave)
}
watch(leaveOpen, (o) => {
  // Esc or an outside tap closes the dialog: that is the safe choice ("Kekal").
  if (!o && leaveDecision) decideLeave(false)
})
onBeforeRouteLeave(() => {
  if (!hasTyped.value || result.value !== null) return true
  flushDraft()
  return new Promise<boolean>((resolve) => {
    leaveDecision = (stay) => resolve(!stay)
    leaveOpen.value = true
  })
})

// ---- keyboard and viewport (AC-MUR-17-4) ------------------------------------------------------------

/** Keeps the focused textarea inside the visual viewport when the on-screen keyboard opens. */
function keepFocusedVisible(): void {
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement) el.scrollIntoView?.({ block: 'center', behavior: 'auto' })
}
function onFocusIn(e: FocusEvent): void {
  if (e.target instanceof HTMLTextAreaElement) setTimeout(keepFocusedVisible, 300)
}
onMounted(() => window.visualViewport?.addEventListener('resize', keepFocusedVisible))
</script>

<template>
  <DsStack gap="md" data-testid="answer-page" @focusin="onFocusIn">
    <DsHeading v-if="!data" :level="1" variant="heading">Soalan Berstruktur — Jawab</DsHeading>
    <template v-if="data">
      <UButton
        :to="data.backUrl"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="answer-back"
        >Kembali</UButton
      >

      <DsStack gap="2xs">
        <DsHeading :level="1" variant="heading" data-testid="answer-h1"
          >Soalan Berstruktur — Jawab</DsHeading
        >
        <DsCluster gap="xs">
          <UBadge color="neutral" variant="soft">{{ data.subjectName }}</UBadge>
          <UBadge color="primary" variant="solid">{{ data.levelName }}</UBadge>
          <DsText variant="caption" data-testid="answer-summary"
            >{{ tree.length }} bahagian · {{ totalMarks }} markah</DsText
          >
        </DsCluster>
      </DsStack>

      <component
        :is="stimuli.length > 0 ? StimulusGroup : DsStack"
        v-bind="stimuli.length > 0 ? { stimuli, hint: false } : { gap: 'md' }"
      >
        <form class="min-w-0" novalidate @submit.prevent="press">
          <DsStack gap="md">
            <UCard v-for="r in tree" :key="r.id" :data-testid="`part-${String(r.id)}`">
              <DsStack gap="md">
                <div
                  v-for="s in r.rows"
                  :key="s.id"
                  class="min-w-0"
                  :class="{
                    'ps-3': s.depth === 1,
                    'ps-6': s.depth === 2,

                    'ps-8': s.depth >= 3,
                  }"
                  :data-testid="`sub-${String(s.id)}`"
                >
                  <DsStack gap="xs">
                    <DsCluster gap="xs" align="baseline" justify="between">
                      <DsText variant="body" wrap="anywhere">
                        <span class="text-label" data-testid="sub-label">{{
                          labelOf(s.label)
                        }}</span>
                        <RichText class="ms-1 whitespace-pre-line" :text="s.text" />
                      </DsText>
                      <DsText v-if="s.leaf" as="span" variant="caption" data-testid="sub-marks">{{
                        marksLabel(s.marks)
                      }}</DsText>
                    </DsCluster>
                    <UTextarea
                      v-if="s.leaf"
                      :model-value="answers[s.id] ?? ''"
                      :rows="6"
                      :disabled="result !== null"
                      :aria-label="`Jawapan ${labelOf(s.label)}`"
                      class="w-full"
                      data-testid="sub-answer"
                      @update:model-value="onInput(s.id, String($event ?? ''))"
                    />

                    <UAlert
                      v-if="result && s.leaf"
                      color="neutral"
                      variant="soft"
                      data-testid="sub-result"
                    >
                      <template #title>
                        <span data-testid="sub-awarded"
                          >{{ marksOf(s.id)?.awarded ?? 0 }}/{{
                            marksOf(s.id)?.max ?? s.marks
                          }}
                          markah</span
                        >
                      </template>
                      <template #description>
                        <span class="text-default">Skema jawapan:</span>
                        <span
                          class="ms-1 break-words whitespace-pre-line"
                          data-testid="sub-model"
                          >{{ modelOf(s.id) }}</span
                        >
                      </template>
                    </UAlert>
                  </DsStack>
                </div>
              </DsStack>
            </UCard>

            <UCard v-if="result" data-testid="answer-total-card">
              <DsText variant="heading" align="center" data-testid="answer-total">
                Jumlah: {{ result.totalAwarded }}/{{ result.totalMax }} markah
              </DsText>
            </UCard>

            <UAlert
              v-if="errors.length > 0"
              color="error"
              variant="soft"
              icon="i-ph-warning-circle-duotone"
              data-testid="answer-errors"
            >
              <template #description>
                <ul class="flex flex-col gap-1">
                  <li v-for="m in errors" :key="m">{{ m }}</li>
                </ul>
              </template>
            </UAlert>

            <DsText v-if="!result" variant="body" tone="muted" data-testid="answer-hint">{{
              INSTRUCTION
            }}</DsText>

            <DsStickyActions v-if="!result">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                size="lg"
                icon="i-ph-flag-duotone"
                title="Lapor soalan ini"
                class="min-h-11"
                data-testid="answer-report"
                @click="reportOpen = true"
                >Lapor</UButton
              >
              <UButton
                type="submit"
                size="lg"
                :disabled="sending"
                :aria-busy="sending ? 'true' : undefined"
                class="min-h-14 flex-1 justify-center md:flex-none md:px-8"
                data-testid="answer-submit"
                >{{ sending ? 'Menyemak…' : 'Hantar & Semak' }}</UButton
              >
            </DsStickyActions>
          </DsStack>
        </form>
      </component>

      <ReportQuestionModal
        v-model:open="reportOpen"
        :question-id="data.id"
        variant="structured"
        source="structured_attempt"
      />

      <DsDialog
        v-model:open="blankOpen"
        title="Hantar & Semak sekarang?"
        :description="`Anda belum menjawab ${String(blankCount)} bahagian.`"
        size="sm"
        :content="blankContent"
        :loading="sending"
        data-testid="blank-dialog"
      >
        <template #footer>
          <DsCluster gap="xs" justify="end" stack-below="sm" align="stretch">
            <UButton
              ref="blankSafe"
              color="neutral"
              variant="soft"
              class="min-h-11 justify-center"
              :disabled="sending"
              data-testid="blank-back"
              @click="blankOpen = false"
              >Kembali</UButton
            >
            <UButton
              class="min-h-11 justify-center"
              :loading="sending"
              data-testid="blank-submit"
              @click="submit"
              >{{ sending ? 'Menyemak…' : 'Hantar & Semak' }}</UButton
            >
          </DsCluster>
        </template>
      </DsDialog>
    </template>

    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="answer-retry"
      testid="answer-error"
      @retry="reload()"
    />

    <DsDialog
      v-model:open="leaveOpen"
      title="Keluar daripada percubaan?"
      description="Jawapan anda disimpan."
      size="sm"
      :content="leaveContent"
      data-testid="leave-dialog"
    >
      <template #footer>
        <DsCluster gap="xs" justify="end" stack-below="sm" align="stretch">
          <UButton
            ref="leaveSafe"
            color="neutral"
            variant="soft"
            class="min-h-11 justify-center"
            data-testid="leave-stay"
            @click="decideLeave(false)"
            >Kekal</UButton
          >
          <UButton
            class="min-h-11 justify-center"
            data-testid="leave-exit"
            @click="decideLeave(true)"
            >Keluar</UButton
          >
        </DsCluster>
      </template>
    </DsDialog>
  </DsStack>
</template>
