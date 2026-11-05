<script setup lang="ts">
/**
 * Kertas Subjektif (S3-T06, 46 section 4.7, B6). One page for two routes:
 *  - `/kertas-subjektif`: the list of published papers (screen 1), grouped by subject, groups by size;
 *  - `/kertas-subjektif/:paperId`: the sitting (screen 2). The whole paper reads as reflowing text (stimuli once per
 *    group, an answer widget per leaf), untimed ("Masa berlalu" counts up), autosaved like AttemptPage, one
 *    "Hantar & Semak" that opens the Semakan page (screen 3).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsQuizHeader,
  DsStack,
} from '@/ds'
import { useApi } from '@/composables/useApi'
import { useMedia } from '@/ds/useMedia'

import {
  AttemptShell,
  QuestionBlock,
  StimulusGroup,
} from '../../../components/question-display'
import ReportQuestionButton from '../components/ReportQuestionButton.vue'
import { formatClock, isAnswered, leavesOf } from '../domain/paper-model'
import type { AttemptPaperView, GroupView, PartAnswer, QuestionView } from '../domain/types'
import { createAutosave, clearLocal, type Autosave, type SaveStatus } from '../lib/autosave'
import { groupLabel, stimuliOf, toStimulusData } from '../lib/stimulus-data'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { browserStorage, bijakServer } from '../server/client'
import type { ListedPaper } from '../server/types'

useLearnerTheme()
const route = useRoute()
const router = useRouter()
const user = useBijakUser()
const server = bijakServer()
const paperId = computed(() => (route.params.paperId ? String(route.params.paperId) : ''))

/* ------------------------------------------------------------------ screen 1: the list */

/** OPT-NEGERI-KERTAS in its V2 order (40): the slug stored on a paper and the label shown. */
const NEGERI: [string, string][] = [
  ['johor', 'Johor'],
  ['kedah', 'Kedah'],
  ['kelantan', 'Kelantan'],
  ['melaka', 'Melaka'],
  ['negeri-sembilan', 'Negeri Sembilan'],
  ['pahang', 'Pahang'],
  ['perak', 'Perak'],
  ['perlis', 'Perlis'],
  ['pulau-pinang', 'Pulau Pinang'],
  ['sabah', 'Sabah'],
  ['sarawak', 'Sarawak'],
  ['selangor', 'Selangor'],
  ['terengganu', 'Terengganu'],
  ['wp-kuala-lumpur', 'WP Kuala Lumpur'],
  ['wp-labuan', 'WP Labuan'],
  ['wp-putrajaya', 'WP Putrajaya'],
  ['mrsm', 'MRSM'],
  ['sbp', 'SBP'],
  ['sabk', 'SABK'],
  ['smka', 'SMKA'],
  ['spm-u', 'SPM(U)'],
  ['ppd', 'PPD'],
]
const negeriLabel = (slug?: string): string => NEGERI.find(([s]) => s === slug)?.[1] ?? slug ?? ''
const negeriRank = (slug?: string): number => {
  const i = NEGERI.findIndex(([s]) => s === slug)
  return i < 0 ? NEGERI.length : i
}

const {
  data: papers,
  error: listError,
  reload: reloadList,
} = useApi(() => server.listPapers(user.value, 'subjektif'), undefined, { immediate: false })

/** Papers by Kertas, then negeri; grouped by subject, the biggest group first (ties keep the subject name order). */
const groups = computed(() => {
  const rows = [...(papers.value ?? [])].sort(
    (a, b) =>
      a.kertas - b.kertas ||
      negeriRank(a.examBoard) - negeriRank(b.examBoard) ||
      a.title.localeCompare(b.title, 'ms'),
  )
  const map = new Map<string, { code: string; name: string; papers: ListedPaper[] }>()
  for (const p of rows) {
    if (!map.has(p.subject)) map.set(p.subject, { code: p.subject, name: p.subjectName, papers: [] })
    map.get(p.subject)!.papers.push(p)
  }
  return [...map.values()].sort(
    (a, b) => b.papers.length - a.papers.length || a.name.localeCompare(b.name, 'ms'),
  )
})

function statusText(p: ListedPaper): string {
  if (p.status === 'sedang') return 'Sedang dijawab'
  if (p.status === 'selesai' && p.lastScore) return `${p.lastScore.score} / ${p.lastScore.max}`
  return 'Belum cuba'
}

/* ------------------------------------------------------------------ screen 2: the sitting */

const view = ref<AttemptPaperView | null>(null)
const attemptId = ref('')
const loadError = ref('')
/** A draft or unknown paper (404), or one the server refuses (403). */
const refused = ref(false)
const answers = ref<Record<string, PartAnswer>>({})
const flags = ref<string[]>([])
const saveStatus = ref<SaveStatus>('idle')
const submitError = ref('')
const submitting = ref(false)
const confirmSubmit = ref(false)
const confirmExit = ref(false)
const phone = useMedia('(width < 640px)', false)
const now = ref(Date.now())
const clockOffset = ref(0)
let autosave: Autosave | null = null
let tick: ReturnType<typeof setInterval> | undefined

const confirmBack = ref<{ $el: HTMLElement } | null>(null)
const exitBack = ref<{ $el: HTMLElement } | null>(null)
const exitContent = {
  onOpenAutoFocus: (e: Event): void => {
    e.preventDefault()
    exitBack.value?.$el.focus()
  },
}
/** Focus starts on the safe choice of the dialog (46 section 2.8). */
const dialogContent = {
  onOpenAutoFocus: (e: Event): void => {
    e.preventDefault()
    confirmBack.value?.$el.focus()
  },
}

const questions = computed(() => view.value?.questions ?? [])
const subjectName = computed(
  () => server.subjects().find((s) => s.code === view.value?.attempt.subject)?.name ?? view.value?.attempt.subject ?? '',
)
const totalMarks = computed(() => (view.value?.sections ?? []).reduce((n, s) => n + s.effectiveMarks, 0))

const leafIds = (q: QuestionView): string[] => (q.mcq ? [q.id] : leavesOf(q.parts ?? []).map((l) => l.id))
const allLeaves = computed(() => questions.value.flatMap(leafIds))
const blankLeaves = computed(() => allLeaves.value.filter((id) => !isAnswered(answers.value[id])).length)
const progress = computed(() =>
  allLeaves.value.length ? ((allLeaves.value.length - blankLeaves.value) / allLeaves.value.length) * 100 : 0,
)
const allBlank = computed(() => allLeaves.value.length > 0 && blankLeaves.value === allLeaves.value.length)

/** Sections in order, each with its questions gathered into stimulus blocks (a group's stimuli are drawn once, D90). */
const sections = computed(() => {
  const v = view.value
  if (!v) return []
  return v.sections.map((s) => {
    const blocks: { key: string; group?: GroupView; items: QuestionView[] }[] = []
    for (const q of v.questions.filter((x) => x.sectionId === s.id)) {
      const g = v.groups.find((x) => x.questionIds.includes(q.id))
      const last = blocks[blocks.length - 1]
      if (g && last?.group?.id === g.id) last.items.push(q)
      else blocks.push({ key: `${g?.id ?? 'q'}:${q.id}`, group: g, items: [q] })
    }
    return { section: s, blocks }
  })
})
const groupBind = (g?: GroupView) =>
  g
    ? {
        stimuli: stimuliOf(g).map(toStimulusData),
        groupId: g.id,
        split: 'sitting' as const,
      }
    : { gap: 'md' as const }

const elapsed = computed(() =>
  view.value
    ? Math.max(0, Math.floor((now.value + clockOffset.value - view.value.attempt.startedAt) / 1000))
    : 0,
)

function semakanTarget(id: string) {
  return {
    name: 'm28.kertas-subjektif.semakan',
    params: { paperId: paperId.value, attemptId: id },
  }
}

function dispose(): void {
  void autosave?.flush()
  autosave?.dispose()
  autosave = null
}

/** Opens the sitting: `startAttempt` resumes an open attempt of the paper, else creates one (latihan, no deadline). */
async function openSitting(): Promise<void> {
  dispose()
  view.value = null
  loadError.value = ''
  refused.value = false
  submitError.value = ''
  try {
    const started = await server.startAttempt(user.value, paperId.value, 'latihan')
    attemptId.value = started.attemptId
    const v = await server.getAttemptView(user.value, started.attemptId)
    if (v.attempt.status !== 'in_progress') {
      await router.replace(semakanTarget(started.attemptId))
      return
    }
    autosave = createAutosave({
      attemptId: started.attemptId,
      storage: browserStorage(),
      api: { save: (p) => server.saveAnswers(user.value, started.attemptId, p) },
      onStatus: (s) => (saveStatus.value = s),
      onClosed: () => void goSemakan(),
    })
    autosave.init({
      answers: v.attempt.answers,
      flags: v.attempt.flags,
      picks: v.attempt.picks,
      position: v.attempt.position,
    })
    answers.value = autosave.answers()
    flags.value = [...autosave.flags()]
    clockOffset.value = server.serverNow() - Date.now()
    view.value = v
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'not_found' || code === 'forbidden') refused.value = true
    else loadError.value = 'Kertas tidak dapat dimuatkan.'
  }
}

function enter(): void {
  if (paperId.value) {
    tick ??= setInterval(() => (now.value = Date.now()), 1000)
    void openSitting()
  }
  else {
    dispose()
    view.value = null
    void reloadList()
  }
}
watch(paperId, enter)
onMounted(() => {
  enter()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  if (tick) clearInterval(tick)
  document.removeEventListener('visibilitychange', onVisibility)
  dispose()
})
function onVisibility(): void {
  if (document.visibilityState === 'hidden') void autosave?.flush()
}

async function goSemakan(): Promise<void> {
  const id = attemptId.value
  clearLocal(browserStorage(), id)
  autosave?.dispose()
  autosave = null
  await router.replace(semakanTarget(id))
}

function onAnswer(partId: string, a: PartAnswer): void {
  answers.value = { ...answers.value, [partId]: a }
  autosave?.setAnswer(partId, a)
}
function toggleFlag(id: string): void {
  flags.value = flags.value.includes(id) ? flags.value.filter((x) => x !== id) : [...flags.value, id]
  autosave?.setFlags(flags.value)
}

/** "Hantar & Semak": no dialog when every leaf is answered (46 section 2.8). */
function pressSubmit(): void {
  if (blankLeaves.value === 0) void submit()
  else confirmSubmit.value = true
}

async function submit(): Promise<void> {
  if (submitting.value || !autosave || !view.value) return
  submitting.value = true
  submitError.value = ''
  await autosave.flush()
  const snap = autosave.snapshot()
  try {
    await server.submit(user.value, attemptId.value, {
      idempotencyKey: `${attemptId.value}-hantar`,
      changes: [],
      answers: snap.answers,
      flags: snap.flags,
      picks: snap.picks,
      position: snap.position,
      auto: false,
    })
    confirmSubmit.value = false
    await goSemakan()
  } catch {
    confirmSubmit.value = false
    submitError.value =
      'Luar talian. Jawapan anda disimpan pada peranti ini. Cuba Hantar & Semak sekali lagi apabila sambungan pulih.'
  } finally {
    submitting.value = false
  }
}

function exitNow(): void {
  dispose()
  void router.push({ name: 'm28.kertas-subjektif' })
}

const saveText = computed(
  () =>
    ({
      idle: '',
      saving: 'menyimpan…',
      saved: 'disimpan',
      offline: 'luar talian',
      error: 'gagal simpan',
      closed: '',
    })[saveStatus.value],
)

</script>

<template>
  <!-- Screen 1: the list -->
  <DsPage
    v-if="!paperId"
    title="Kertas Subjektif"
    subtitle="Kertas 2, 3 & 4 percubaan negeri — baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri"
    data-testid="subjektif-list"
  >
    <DsLoadError
      v-if="listError"
      message="Senarai kertas tidak dapat dimuatkan."
      @retry="reloadList"
    />
    <div v-else-if="!papers" class="flex flex-col gap-3" aria-busy="true" data-testid="list-loading">
      <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
    </div>
    <DsEmptyState
      v-else-if="!papers.length"
      title="Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi."
      icon="i-ph-files"
      data-testid="list-empty"
    />
    <template v-else>
      <p class="text-caption text-muted" role="status" data-testid="paper-count">
        {{ papers.length }} kertas
      </p>
      <section
        v-for="g in groups"
        :key="g.code"
        class="flex flex-col gap-3"
        :aria-label="g.name"
        :data-testid="`group-${g.code}`"
      >
        <h2 class="text-subheading text-highlighted">{{ g.name }}</h2>
        <UCard v-for="p in g.papers" :key="p.id" :data-testid="`paper-${p.id}`">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 flex-col gap-2">
              <h3 class="text-body text-highlighted">{{ p.title }}</h3>
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="neutral" variant="subtle">Kertas {{ p.kertas }}</UBadge>
                <UBadge v-if="p.examBoard" color="neutral" variant="subtle">{{
                  negeriLabel(p.examBoard)
                }}</UBadge>
                <UBadge color="neutral" variant="subtle">{{ p.year }}</UBadge>
                <UBadge color="neutral" variant="subtle">{{ p.marks }} markah</UBadge>
                <UBadge
                  :color="p.status === 'belum' ? 'neutral' : p.status === 'sedang' ? 'info' : 'success'"
                  variant="soft"
                  data-testid="paper-status"
                  >{{ statusText(p) }}</UBadge
                >
              </div>
            </div>
            <UButton
              :to="{ name: 'm28.kertas-subjektif.paper', params: { paperId: p.id } }"
              class="min-h-11 justify-center"
              :data-testid="`open-${p.id}`"
              >{{ p.status === 'sedang' ? 'Sambung' : 'Mula' }}</UButton
            >
          </div>
        </UCard>
      </section>
    </template>
  </DsPage>

  <!-- Screen 2: the sitting -->
  <template v-else>
    <AttemptShell>
      <template #header>
        <DsQuizHeader
          close-label="Keluar daripada kertas"
          :progress="progress"
          progress-label="Kemajuan menjawab"
          :combo="0"
          combo-label="Kombo"
          @close="confirmExit = true"
        />
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 truncate text-caption text-muted" data-testid="attempt-title">
            {{ view?.attempt.title }}
          </p>
          <div class="flex items-center gap-3">
            <span class="text-caption text-muted" role="status" data-testid="save-status">{{
              saveText
            }}</span>
            <UBadge
              v-if="view"
              color="neutral"
              variant="soft"
              size="lg"
              icon="i-ph-timer"
              class="tabular"
              data-testid="clock"
              >Masa berlalu {{ formatClock(elapsed) }}</UBadge
            >
          </div>
        </div>
      </template>

      <template #main>
        <DsStack v-if="refused" padding="lg">
          <DsEmptyState
            title="Kertas ini tidak dijumpai."
            icon="i-ph-file-x"
            data-testid="paper-not-found"
          >
            <template #actions>
              <UButton :to="{ name: 'm28.kertas-subjektif' }" class="min-h-11"
                >Kembali ke Kertas Subjektif</UButton
              >
            </template>
          </DsEmptyState>
        </DsStack>
        <DsLoadError v-else-if="loadError" class="my-8" :message="loadError" @retry="openSitting" />
        <div
          v-else-if="!view"
          class="flex flex-col gap-3 py-4"
          aria-busy="true"
          data-testid="attempt-loading"
        >
          <USkeleton class="h-8 w-1/2" />
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-16 w-full" />
        </div>
        <div v-else class="flex flex-col gap-6 pt-2">
          <div class="flex flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="paper-heading">
              {{ subjectName }} — Kertas {{ view.attempt.kertas }}
            </h1>
            <p class="tabular text-caption text-muted" data-testid="paper-marks">
              {{ totalMarks }} markah
            </p>
          </div>

          <UAlert
            v-if="submitError"
            color="warning"
            variant="soft"
            :description="submitError"
            role="alert"
            data-testid="submit-error"
          />

          <section
            v-for="s in sections"
            :key="s.section.id"
            class="flex flex-col gap-4"
            :aria-label="s.section.label"
            :data-testid="`section-${s.section.id}`"
          >
            <p class="text-overline text-muted">
              {{ s.section.label }} · [{{ s.section.effectiveMarks }} markah]
            </p>
            <component
              :is="b.group ? StimulusGroup : DsStack"
              v-for="b in s.blocks"
              :key="b.key"
              v-bind="groupBind(b.group)"
            >
              <QuestionBlock
                v-for="q in b.items"
                :key="q.id"
                :question="q"
                :answers="answers"
                :attempt-id="attemptId"
                :stimulus-label="b.group ? groupLabel(stimuliOf(b.group)) : undefined"
                :flagged="flags.includes(q.id)"
                :disabled="submitting"
                @answer="onAnswer"
                @toggle-flag="toggleFlag(q.id)"
              >
                <template #report="p"><ReportQuestionButton v-bind="p" /></template>
              </QuestionBlock>
            </component>
          </section>
        </div>
      </template>

      <template #footer>
        <div v-if="view" class="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <p class="tabular hidden text-caption text-muted sm:block" data-testid="blank-count">
            {{ allLeaves.length - blankLeaves }} / {{ allLeaves.length }} bahagian dijawab
          </p>
          <UButton
            type="button"
            color="primary"
            :size="phone ? 'sm' : undefined"
            class="ms-auto min-h-11 text-nowrap"
            :loading="submitting"
            data-testid="submit"
            @click="pressSubmit"
            >Hantar &amp; Semak</UButton
          >
        </div>
      </template>
    </AttemptShell>

    <UModal
      v-model:open="confirmSubmit"
      title="Hantar & Semak sekarang?"
      :description="
        allBlank
          ? 'Anda belum menaip sebarang jawapan. Teruskan jika anda menjawab di atas kertas.'
          : `Anda belum menjawab ${blankLeaves} bahagian.`
      "
      :content="dialogContent"
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <UButton
            ref="confirmBack"
            color="neutral"
            variant="soft"
            class="min-h-11"
            data-testid="confirm-back"
            @click="confirmSubmit = false"
            >Kembali</UButton
          >
          <UButton
            class="min-h-11"
            :loading="submitting"
            data-testid="confirm-submit"
            @click="submit"
          >
            {{ submitting ? 'Menghantar...' : 'Hantar & Semak' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="confirmExit"
      title="Keluar daripada percubaan?"
      description="Jawapan anda disimpan."
      :content="exitContent"
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <UButton
            ref="exitBack"
            color="neutral"
            variant="soft"
            class="min-h-11"
            @click="confirmExit = false"
            >Kekal</UButton
          >
          <UButton class="min-h-11" data-testid="confirm-exit" @click="exitNow">Keluar</UButton>
        </div>
      </template>
    </UModal>
  </template>
</template>
