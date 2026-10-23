<script setup lang="ts">
/**
 * Attempt screen (US-04..US-13). Exam mode: timer, sections ("Jawab N daripada M"), question map,
 * flag for review, one Hantar. Latihan mode: untimed, "Semak" per question with instant feedback.
 * One question per screen; a shared Rajah stays pinned (left panel from `lg`, sticky chip + bottom
 * sheet below). Answers autosave (device first, then the mock server) and submit flushes them.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsFeedbackSheet, DsQuizHeader, DsLoadError } from '@/ds'

import AttemptShell from '../components/AttemptShell.vue'
import NavigatorPanel, { type NavState } from '../components/NavigatorPanel.vue'
import QuestionBlock from '../components/QuestionBlock.vue'
import StimulusView from '../components/StimulusView.vue'
import { formatClock, isAnswered, sectionRuleLine } from '../domain/paper-model'
import type { AttemptPaperView, PartAnswer, QuestionResult } from '../domain/types'
import { createAutosave, clearLocal, type Autosave, type SaveStatus } from '../lib/autosave'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { browserStorage, bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const router = useRouter()
const user = useBijakUser()
const server = bijakServer()
const attemptId = computed(() => String(route.params.attemptId))

const view = ref<AttemptPaperView | null>(null)
const loadError = ref('')
const answers = ref<Record<string, PartAnswer>>({})
const flags = ref<string[]>([])
const picks = ref<Record<string, string[]>>({})
const index = ref(0)
const saveStatus = ref<SaveStatus>('idle')
const checks = ref<Record<string, QuestionResult>>({})
const combo = ref(0)
const submitError = ref('')
const submitting = ref(false)
const confirmSubmit = ref(false)
const confirmExit = ref(false)
const navOpen = ref(false)
const stimOpen = ref(false)
const now = ref(Date.now())
const clockOffset = ref(0)
const warned = ref(false)
const questionRef = ref<{ focus: () => void } | null>(null)
let autosave: Autosave | null = null
let tick: ReturnType<typeof setInterval> | undefined
let retryTimer: ReturnType<typeof setInterval> | undefined
/** A submit (or the auto-submit at 0) that could not reach the server yet. */
const submitPending = ref<{ auto: boolean } | null>(null)
const RETRY_MS = 30_000

const isExam = computed(() => view.value?.attempt.mode === 'exam')
const questions = computed(() => view.value?.questions ?? [])
const current = computed(() => questions.value[index.value])
const section = computed(() => view.value?.sections.find((s) => s.id === current.value?.sectionId))
const group = computed(() =>
  view.value?.groups.find((g) => g.questionIds.includes(current.value?.id ?? '')),
)
const isLast = computed(() => index.value >= questions.value.length - 1)
const currentCheck = computed(() => (current.value ? checks.value[current.value.id] : undefined))
const answeredCount = computed(() => questions.value.filter((q) => questionAnswered(q.id)).length)
const progress = computed(() =>
  questions.value.length ? (answeredCount.value / questions.value.length) * 100 : 0,
)

function leafIds(qid: string): string[] {
  const q = questions.value.find((x) => x.id === qid)
  if (!q) return []
  if (q.mcq) return [q.id]
  const out: string[] = []
  const walk = (parts: NonNullable<typeof q.parts>): void => {
    for (const p of parts) {
      if (p.children?.length) walk(p.children)
      else out.push(p.id)
    }
  }
  walk(q.parts ?? [])
  return out
}
function questionAnswered(qid: string): boolean {
  return leafIds(qid).some((id) => isAnswered(answers.value[id]))
}

const navStates = computed(() => {
  const out: Record<string, NavState> = {}
  for (const q of questions.value) {
    out[q.id] = flags.value.includes(q.id)
      ? 'flagged'
      : questionAnswered(q.id)
        ? 'answered'
        : 'none'
  }
  return out
})

function chosenCount(sectionId: string): number {
  return picks.value[sectionId]?.length ?? 0
}
const counters = computed(() => {
  const out: Record<string, string> = {}
  for (const s of view.value?.sections ?? []) {
    if (s.rule.type === 'choose') out[s.id] = `${chosenCount(s.id)} / ${s.rule.n} soalan dipilih`
  }
  return out
})
const choose = computed(() => {
  const s = section.value
  const q = current.value
  if (!s || !q || s.rule.type !== 'choose') return undefined
  const chosen = picks.value[s.id]?.includes(q.id) ?? false
  const full = chosenCount(s.id) >= s.rule.n
  return { chosen, dimmed: full && !chosen, blocked: full }
})

/* ----------------------------------------------------------------------------- timer */
const remaining = computed(() => {
  const d = view.value?.attempt.deadline
  if (!d) return null
  return Math.max(0, Math.ceil((d - (now.value + clockOffset.value)) / 1000))
})
const elapsed = computed(() =>
  view.value
    ? Math.max(0, Math.floor((now.value + clockOffset.value - view.value.attempt.startedAt) / 1000))
    : 0,
)
const clockText = computed(() => formatClock(remaining.value ?? elapsed.value))
const lowTime = computed(() => remaining.value !== null && remaining.value <= 300)

watch(remaining, (r) => {
  if (r === null) return
  if (r <= 300 && r > 0) warned.value = true
  if (r === 0 && !submitting.value && view.value?.attempt.status === 'in_progress')
    void submit(true)
})

/* ------------------------------------------------------------------------------ load */
async function load(): Promise<void> {
  loadError.value = ''
  try {
    const v = await server.getAttemptView(user.value, attemptId.value)
    if (v.attempt.status !== 'in_progress') {
      await router.replace({ name: 'm28.bijak.result', params: { attemptId: attemptId.value } })
      return
    }
    autosave?.dispose()
    autosave = createAutosave({
      attemptId: attemptId.value,
      storage: browserStorage(),
      api: { save: (p) => server.saveAnswers(user.value, attemptId.value, p) },
      onStatus: (s) => (saveStatus.value = s),
      onClosed: () => void goResult(),
    })
    autosave.init({
      answers: v.attempt.answers,
      flags: v.attempt.flags,
      picks: v.attempt.picks,
      position: v.attempt.position,
    })
    answers.value = autosave.answers()
    flags.value = [...autosave.flags()]
    picks.value = { ...autosave.picks() }
    index.value = Math.min(autosave.position(), Math.max(0, v.questions.length - 1))
    checks.value = Object.fromEntries(v.checks.map((c) => [c.questionId, c]))
    clockOffset.value = server.serverNow() - Date.now()
    view.value = v
  } catch (e) {
    loadError.value =
      (e as { code?: string }).code === 'not_found'
        ? 'Percubaan tidak ditemui.'
        : 'Percubaan tidak dapat dimuatkan.'
  }
}

onMounted(() => {
  void load()
  tick = setInterval(() => (now.value = Date.now()), 1000)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', onOnline)
})
onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
  stopRetry()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('online', onOnline)
  void autosave?.flush()
  autosave?.dispose()
})
function onVisibility(): void {
  if (document.visibilityState === 'hidden') void autosave?.flush()
}
function onOnline(): void {
  if (submitPending.value) void retrySubmit()
  else void autosave?.flush()
}

function startRetry(): void {
  retryTimer ??= setInterval(() => void retrySubmit(), RETRY_MS)
}
function stopRetry(): void {
  if (retryTimer) clearInterval(retryTimer)
  retryTimer = undefined
}
/** Offline submit: try again on "online" and every 30 s until it succeeds or the server says closed. */
async function retrySubmit(): Promise<void> {
  if (!submitPending.value || submitting.value) return
  await submit(submitPending.value.auto)
}
async function goResult(): Promise<void> {
  stopRetry()
  submitPending.value = null
  clearLocal(browserStorage(), attemptId.value)
  autosave?.dispose()
  await router.replace({ name: 'm28.bijak.result', params: { attemptId: attemptId.value } })
}

/* --------------------------------------------------------------------------- actions */
function onAnswer(partId: string, a: PartAnswer): void {
  answers.value = { ...answers.value, [partId]: a }
  autosave?.setAnswer(partId, a)
}
function toggleFlag(): void {
  const id = current.value?.id
  if (!id) return
  flags.value = flags.value.includes(id)
    ? flags.value.filter((x) => x !== id)
    : [...flags.value, id]
  autosave?.setFlags(flags.value)
}
function toggleChoose(): void {
  const s = section.value
  const q = current.value
  if (!s || !q || s.rule.type !== 'choose') return
  const cur = picks.value[s.id] ?? []
  const next = cur.includes(q.id)
    ? cur.filter((x) => x !== q.id)
    : cur.length < s.rule.n
      ? [...cur, q.id]
      : cur
  picks.value = { ...picks.value, [s.id]: next }
  autosave?.setPicks(picks.value)
}

async function goTo(i: number): Promise<void> {
  if (i < 0 || i >= questions.value.length) return
  index.value = i
  autosave?.setPosition(i)
  navOpen.value = false
  await nextTick()
  document.querySelector('[data-testid=attempt-scroll]')?.scrollTo({ top: 0 })
  questionRef.value?.focus()
}
function goToId(id: string): void {
  void goTo(questions.value.findIndex((q) => q.id === id))
}

async function check(): Promise<void> {
  const q = current.value
  if (!q) return
  await autosave?.flush()
  try {
    const res = await server.checkQuestion(user.value, attemptId.value, q.id)
    checks.value = { ...checks.value, [q.id]: res }
    combo.value = res.awarded === res.marks && res.marks > 0 ? combo.value + 1 : 0
  } catch {
    submitError.value = 'Semakan tidak dapat dibuat sekarang. Cuba lagi.'
  }
}

/** Counts shown in the Hantar dialog. */
const unanswered = computed(() => questions.value.filter((q) => !questionAnswered(q.id)).length)
const flaggedCount = computed(() => flags.value.length)

/**
 * Submit: flush pending answers FIRST, then send the complete local answer set with an
 * idempotency key, so nothing typed before the tap can be missing from grading (AC-13.2).
 */
async function submit(auto = false): Promise<void> {
  if (submitting.value || !autosave) return
  submitting.value = true
  submitError.value = ''
  confirmSubmit.value = false
  await autosave.flush()
  const snap = autosave.snapshot()
  try {
    const res = await server.submit(user.value, attemptId.value, {
      idempotencyKey: `${attemptId.value}-hantar`,
      changes: [],
      answers: snap.answers,
      flags: snap.flags,
      picks: snap.picks,
      position: snap.position,
      auto,
    })
    void res // closed or not, the attempt is final on the server: show its Semakan
    await goResult()
  } catch {
    submitError.value =
      'Luar talian. Jawapan anda disimpan pada peranti ini dan akan dihantar apabila sambungan pulih.'
    submitPending.value = { auto }
    startRetry()
    submitting.value = false
  }
}

/** Hantar from the Peta sheet: close the sheet first so the dialog opens over the paper. */
function openSubmitFromMap(): void {
  navOpen.value = false
  confirmSubmit.value = true
}

function exitNow(): void {
  void autosave?.flush()
  void router.push({ name: 'm28.bijak' })
}

const saveText = computed(
  () =>
    ({
      idle: '',
      saving: 'Menyimpan…',
      saved: 'Disimpan',
      offline: 'Luar talian — jawapan disimpan pada peranti ini',
      error: 'Gagal simpan — cuba lagi',
      closed: 'Masa tamat. Jawapan yang disimpan sebelum masa tamat telah dihantar.',
    })[saveStatus.value],
)

const feedback = computed(() => {
  const c = currentCheck.value
  if (!c) return null
  const full = c.awarded === c.marks && c.marks > 0
  const pending = c.parts.some((p) => p.status === 'belum_dimarkah')
  return {
    tone: full ? ('good' as const) : ('bad' as const),
    title: pending
      ? 'Menunggu semakan'
      : full
        ? 'Betul!'
        : c.awarded > 0
          ? 'Separa betul'
          : 'Belum tepat',
    body: `Markah anda: ${c.awarded} / ${c.marks}.`,
    combo: full && combo.value > 1 ? `Kombo ${combo.value}` : undefined,
  }
})
</script>

<template>
  <AttemptShell :has-stimulus="!!group">
    <template #header>
      <DsQuizHeader
        close-label="Keluar daripada kertas"
        :progress="progress"
        progress-label="Kemajuan menjawab"
        :combo="isExam ? 0 : combo"
        combo-label="Kombo"
        @close="confirmExit = true"
      />
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p class="min-w-0 truncate text-caption text-muted" data-testid="attempt-title">
          {{ view?.attempt.title }}
          <UBadge color="neutral" variant="subtle" size="sm" class="ms-1">{{
            isExam ? 'Mod Peperiksaan' : 'Mod Latihan'
          }}</UBadge>
        </p>
        <div class="flex items-center gap-3">
          <span class="text-caption text-muted" role="status" data-testid="save-status">{{
            saveText
          }}</span>
          <UBadge
            v-if="view"
            :color="lowTime ? 'error' : 'neutral'"
            variant="soft"
            size="lg"
            icon="i-ph-timer"
            class="tabular"
            :aria-label="isExam ? 'Masa berbaki' : 'Masa berlalu'"
            data-testid="clock"
            >{{ clockText }}</UBadge
          >
        </div>
      </div>
    </template>

    <template #banner>
      <p
        v-if="warned && isExam && (remaining ?? 0) > 0"
        class="shrink-0 bg-elevated px-3 py-2 text-center text-label text-warning sm:px-6"
        role="status"
        data-testid="time-warning"
      >
        Amaran: masa berbaki kurang 5 minit.
      </p>
    </template>

    <template v-if="group" #stimulus>
      <StimulusView :stimulus="group.stimulus" />
    </template>
    <template v-if="group" #chip>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="min-h-11 w-full justify-start gap-3"
        data-testid="stimulus-chip"
        @click="stimOpen = true"
      >
        <span class="w-12 shrink-0"><StimulusView :stimulus="group.stimulus" thumb /></span>
        <span class="text-label">Lihat {{ group.stimulus.label }}</span>
      </UButton>
    </template>

    <template #main>
      <DsLoadError v-if="loadError" class="my-8" :message="loadError" @retry="load" />
      <div
        v-else-if="!view || !current"
        class="flex flex-col gap-3 py-4"
        aria-busy="true"
        data-testid="attempt-loading"
      >
        <USkeleton class="h-8 w-1/2" />
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <div v-else class="flex flex-col gap-4 pt-2">
        <div v-if="section" class="flex flex-col gap-1" data-testid="section-header">
          <p class="text-overline text-muted">
            {{ section.label }} · [{{ section.effectiveMarks }} markah]
          </p>
          <p class="text-caption text-toned" data-testid="section-rule">
            {{ sectionRuleLine(section) }}
          </p>
          <p
            v-if="counters[section.id]"
            class="text-caption text-muted"
            role="status"
            data-testid="choose-counter"
          >
            {{ counters[section.id] }}
          </p>
        </div>

        <QuestionBlock
          ref="questionRef"
          :key="current.id"
          :question="current"
          :answers="answers"
          :attempt-id="attemptId"
          :stimulus-label="group?.stimulus.label"
          :flagged="flags.includes(current.id)"
          :check="currentCheck"
          :disabled="submitting"
          :choose="choose"
          @answer="onAnswer"
          @toggle-flag="toggleFlag"
          @toggle-choose="toggleChoose"
        />

        <DsFeedbackSheet
          v-if="feedback && !isExam"
          :tone="feedback.tone"
          :title="feedback.title"
          :body="feedback.body"
          :combo="feedback.combo"
          :continue-label="isLast ? 'Selesai' : 'Seterusnya'"
          @continue="isLast ? (confirmSubmit = true) : goTo(index + 1)"
        />

        <UAlert
          v-if="submitError"
          color="warning"
          variant="soft"
          :description="submitError"
          role="alert"
          data-testid="submit-error"
        />
      </div>
    </template>

    <template #rail>
      <NavigatorPanel
        v-if="view && current"
        :sections="view.sections"
        :questions="questions"
        :states="navStates"
        :current="current.id"
        :counters="counters"
        @go="goToId"
      />
    </template>

    <template #footer>
      <div class="mx-auto flex w-full max-w-7xl items-center gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          class="size-11 justify-center"
          aria-label="Sebelum"
          :disabled="index === 0"
          data-testid="prev"
          @click="goTo(index - 1)"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-squares-four"
          class="min-h-11 lg:hidden"
          data-testid="open-map"
          @click="navOpen = true"
          >Peta {{ current?.number ?? 0 }}/{{ questions.length }}</UButton
        >
        <p
          class="tabular hidden min-w-0 flex-1 truncate text-center text-caption text-muted sm:block"
          data-testid="position"
        >
          Soalan {{ current?.number ?? 0 }} / {{ questions.length }}
        </p>
        <UButton
          v-if="!isExam && current && !currentCheck"
          type="button"
          color="primary"
          variant="soft"
          class="min-h-11"
          data-testid="check-button"
          @click="check"
          >Semak</UButton
        >
        <UButton
          v-if="!isLast"
          type="button"
          color="primary"
          class="min-h-11"
          trailing-icon="i-ph-arrow-right"
          data-testid="next"
          @click="goTo(index + 1)"
          >Seterusnya</UButton
        >
        <UButton
          v-else
          type="button"
          color="primary"
          class="min-h-11"
          :loading="submitting"
          data-testid="submit"
          @click="confirmSubmit = true"
          >{{ isExam ? 'Hantar' : 'Selesai' }}</UButton
        >
        <UButton
          v-if="isExam && !isLast"
          type="button"
          color="neutral"
          variant="ghost"
          class="hidden min-h-11 sm:inline-flex"
          data-testid="submit-early"
          @click="confirmSubmit = true"
          >Hantar</UButton
        >
      </div>
    </template>
  </AttemptShell>

  <UDrawer
    v-model:open="stimOpen"
    :title="group?.stimulus.label ?? 'Rajah'"
    description="Rajah kekal boleh dibuka semasa menjawab."
  >
    <template #body>
      <StimulusView v-if="group" :stimulus="group.stimulus" />
    </template>
  </UDrawer>

  <UDrawer
    v-model:open="navOpen"
    title="Peta soalan"
    description="Pilih soalan untuk melompat ke sana."
  >
    <template #body>
      <NavigatorPanel
        v-if="view && current"
        :sections="view.sections"
        :questions="questions"
        :states="navStates"
        :current="current.id"
        :counters="counters"
        @go="goToId"
      />
      <!-- Phones: the footer has no room for Hantar, so it lives here on every question (FB-044). -->
      <UButton
        v-if="isExam"
        type="button"
        block
        size="lg"
        class="mt-4 min-h-11"
        data-testid="submit-from-map"
        @click="openSubmitFromMap"
        >Hantar</UButton
      >
    </template>
  </UDrawer>

  <UModal
    v-model:open="confirmSubmit"
    :title="isExam ? 'Hantar jawapan anda sekarang?' : 'Selesai latihan?'"
    :description="
      isExam
        ? 'Selepas dihantar, anda tidak boleh mengubah jawapan.'
        : 'Ringkasan markah akan dipaparkan.'
    "
  >
    <template #body>
      <ul class="flex flex-col gap-1 text-body text-default" data-testid="submit-summary">
        <li>Belum dijawab: {{ unanswered }} soalan</li>
        <li>Ditanda: {{ flaggedCount }} soalan</li>
      </ul>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="soft" class="min-h-11" @click="confirmSubmit = false"
          >Kembali</UButton
        >
        <UButton
          class="min-h-11"
          :loading="submitting"
          data-testid="confirm-submit"
          @click="submit(false)"
        >
          {{ isExam ? 'Hantar' : 'Selesai' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="confirmExit"
    title="Keluar daripada kertas?"
    description="Jawapan anda telah disimpan. Anda boleh menyambung kemudian."
  >
    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <UButton color="neutral" variant="soft" class="min-h-11" @click="confirmExit = false"
          >Terus menjawab</UButton
        >
        <UButton class="min-h-11" data-testid="confirm-exit" @click="exitNow">Keluar</UButton>
      </div>
    </template>
  </UModal>
</template>
