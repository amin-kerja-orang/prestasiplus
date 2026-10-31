<script setup lang="ts">
/**
 * Simulasi paper quiz (`/simulasi/:paperId/kuiz`, R1-F12): a published paper read one Bahagian at a
 * time (V2 `exam-sim/quiz-paper.blade.php`). Objective parts have "✓ Semak" (marked on the server,
 * nothing stored, U8); every other part is an unsaved textarea with a one-line note (D83 D-9).
 * "Skor: n / total" is counted here from the verdicts of the whole paper (total = markableTotal).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { DsEmptyState, DsLoadError, DsPage, DsProgress, DsStickyActions } from '@/ds'
import { StimulusFigure, StimulusGroup } from '../lib/question-display'
import type { StimulusData } from '../lib/question-display'
import type { BijakKuizCheckResult, BijakKuizItem, BijakKuizPaperPage } from '@pp/contract'

import KuizItem from '../components/KuizItem.vue'
import { clock, kuizCopy, toStimulus } from '../lib/kuiz'
import { useLearnerTheme } from '../lib/use-bijak'
import { BIJAK_KUIZ_MESSAGES } from '@pp/contract'

import { BijakError } from '../server/errors'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const server = bijakServer()
const paperId = computed(() => String(route.params.paperId))

type Phase = 'loading' | 'error' | 'missing' | 'unavailable' | 'ready'
const phase = ref<Phase>('loading')
const page = ref(1)
const data = ref<BijakKuizPaperPage | null>(null)
const picked = ref<Record<string, string>>({})
const written = ref<Record<string, string>>({})
const verdicts = ref<Record<string, BijakKuizCheckResult>>({})
const busyId = ref('')
const errors = ref<Record<string, string>>({})
const seconds = ref(0)
const markableTotal = ref(0)
/** The API's BM refusal (403: the paper places an archived question, AC-R1-18.4). */
const unavailableMessage = ref('')
const sheetOpen = ref('')
/** Questions shown before each page (page 1 = 0), learnt as the pupil moves forward, so the numbering is continuous. */
const before = ref<Record<number, number>>({ 1: 0 })
const timer = setInterval(() => (seconds.value += 1), 1000)
onBeforeUnmount(() => clearInterval(timer))

const score = computed(() => Object.values(verdicts.value).filter((v) => v.correct).length)
const pageCount = computed(() => data.value?.pageCount ?? 0)
const time = computed(() => clock(seconds.value))
const progress = computed(() =>
  pageCount.value ? Math.round((page.value / pageCount.value) * 100) : 0,
)
const empty = computed(
  () => !!data.value && (data.value.pageCount === 0 || !data.value.items.length),
)

interface Block {
  key: string
  stimuli: StimulusData[]
  items: { item: BijakKuizItem; number: number }[]
}

/**
 * D90: each stimulus group of the page (`groups[]`) is shown ONCE above its members (items whose
 * `groupId` matches; the server keeps them contiguous). Items outside a group stand alone.
 */
const blocks = computed<Block[]>(() => {
  const items = data.value?.items ?? []
  const groups = new Map((data.value?.groups ?? []).map((g) => [g.id, g.stimuli]))
  const out: Block[] = []
  // "Soalan n" counts questions, not parts, and runs on across the Bahagian pages (V2): a structured question's parts share one number.
  const numbers = new Map<string, number>()
  const base = before.value[page.value] ?? 0
  const numberOf = (item: BijakKuizItem): number => {
    const qid = item.id.split(':')[0]!
    if (!numbers.has(qid)) numbers.set(qid, base + numbers.size + 1)
    return numbers.get(qid)!
  }
  items.forEach((item) => {
    const entry = { item, number: numberOf(item) }
    const last = out[out.length - 1]
    if (item.groupId !== null && groups.has(item.groupId)) {
      if (last && last.key === item.groupId) last.items.push(entry)
      else
        out.push({
          key: item.groupId,
          stimuli: groups.get(item.groupId)!.map((s, k) => toStimulus(s, `g${item.groupId}-${k}`)),
          items: [entry],
        })
    } else out.push({ key: '', stimuli: [], items: [entry] })
  })
  return out
})

/** Only the API's "paper is being updated" 403 is this state; any other 403 ("Akses ditolak") stays an error. */
function isPaperUnavailable(e: unknown): e is BijakError {
  return e instanceof BijakError && e.code === 'forbidden' && e.message === BIJAK_KUIZ_MESSAGES.paperUnavailable
}

let loadSeq = 0
async function load(): Promise<void> {
  const seq = ++loadSeq
  phase.value = 'loading'
  try {
    const res = await server.getKuizPaperPage(paperId.value, page.value)
    if (seq !== loadSeq) return // a newer page was requested meanwhile: drop this response
    data.value = res
    before.value = { ...before.value, [page.value + 1]: (before.value[page.value] ?? 0) + new Set(res.items.map((i) => i.id.split(':')[0])).size }
    markableTotal.value = res.markableTotal
    phase.value = 'ready'
    window.scrollTo?.({ top: 0 })
  } catch (e) {
    if (seq !== loadSeq) return
    if (isPaperUnavailable(e)) {
      unavailableMessage.value = e.message
      phase.value = 'unavailable'
      return
    }
    phase.value = e instanceof BijakError && e.code === 'not_found' ? 'missing' : 'error'
  }
}

async function check(item: BijakKuizItem): Promise<void> {
  const optionId = picked.value[item.id]
  if (!optionId || busyId.value || verdicts.value[item.id]) return
  busyId.value = item.id
  errors.value = { ...errors.value, [item.id]: '' }
  try {
    const v = await server.checkKuizPaper(paperId.value, { itemId: item.id, optionId })
    verdicts.value = { ...verdicts.value, [item.id]: v }
  } catch (e) {
    // The paper was archived/changed while the pupil was on it: the whole screen switches to the unavailable state.
    if (isPaperUnavailable(e)) {
      unavailableMessage.value = e.message
      phase.value = 'unavailable'
      return
    }
    const msg =
      e instanceof BijakError && e.code === 'offline'
        ? 'Luar talian. Cuba lagi.'
        : e instanceof BijakError && (e.code === 'bad_request' || e.code === 'not_found' || e.code === 'forbidden')
          ? e.message
          : 'Jawapan tidak dapat disemak. Cuba lagi.'
    errors.value = { ...errors.value, [item.id]: msg }
  } finally {
    busyId.value = ''
  }
}

function go(delta: number): void {
  const n = page.value + delta
  if (n < 1 || n > pageCount.value) return
  page.value = n
}

watch(page, load)
watch(paperId, () => {
  page.value = 1
  before.value = { 1: 0 }
  picked.value = {}
  written.value = {}
  errors.value = {}
  verdicts.value = {}
  void load()
})
void load()
</script>

<template>
  <DsPage
    :title="data?.paper.title ?? kuizCopy.title"
    back-to="/spm/bijak"
    back-label="Bijak SPM"
    width="prose"
    data-testid="paper-quiz-page"
  >
    <div v-if="phase === 'loading' && !data" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <DsEmptyState
      v-else-if="phase === 'missing'"
      title="Kertas tidak ditemui"
      description="Kertas ini tidak tersedia."
      icon="file-x"
      data-testid="paper-quiz-missing"
    />
    <!-- [PROPOSED] UX-26: the title is ours, the description is the API's H-A13 line -->
    <DsEmptyState
      v-else-if="phase === 'unavailable'"
      title="Kertas belum tersedia"
      :description="unavailableMessage"
      icon="file-x"
      data-testid="paper-quiz-unavailable"
    />
    <DsLoadError
      v-else-if="phase === 'error'"
      message="Kertas tidak dapat dimuatkan."
      retry-testid="paper-quiz-retry-load"
      @retry="load"
    />

    <div v-else-if="empty" class="flex flex-col items-center gap-4" data-testid="paper-quiz-empty">
      <DsEmptyState :title="kuizCopy.paperEmpty" icon="file-x" />
      <UButton to="/spm/bijak" color="neutral" class="min-h-11">{{ kuizCopy.paperBack }}</UButton>
    </div>

    <template v-else-if="data">
      <div
        class="flex flex-col gap-3"
        :aria-busy="phase === 'loading'"
        data-testid="paper-quiz-header"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="text-caption text-muted" data-testid="paper-quiz-meta">
            {{ data.paper.subjectName }} · {{ data.paper.code }}
            <template v-if="data.section"> · {{ data.section.label }}</template>
            ({{ data.page }}/{{ data.pageCount }})
          </p>
          <p class="text-right">
            <span class="block text-heading text-primary">{{ time }}</span>
            <span class="text-caption text-muted">{{ kuizCopy.time }}</span>
          </p>
        </div>
        <DsProgress :value="progress" :show-value="false" aria-label="Kemajuan kertas" />
      </div>

      <p
        v-if="data.section?.instruction"
        class="text-center text-body text-toned"
        data-testid="paper-quiz-instruction"
      >
        {{ data.section.instruction }}
      </p>

      <template v-for="(b, bi) in blocks" :key="bi">
        <StimulusGroup
          v-if="b.stimuli.length === 1"
          :open="sheetOpen === b.key"
          :stimulus="b.stimuli[0]!"
          @update:open="sheetOpen = $event ? b.key : ''"
        >
          <KuizItem
            v-for="e in b.items"
            :key="e.item.id"
            v-model:picked="picked[e.item.id]"
            v-model:written="written[e.item.id]"
            :item="e.item"
            :chip="`Soalan ${e.number}`"
            :verdict="verdicts[e.item.id] ?? null"
            :busy="busyId === e.item.id"
            :error="errors[e.item.id]"
            @check="check(e.item)"
          />
        </StimulusGroup>
        <div v-else class="flex flex-col gap-4" :data-testid="b.key ? 'kuiz-group' : undefined">
          <template v-if="b.stimuli.length">
            <StimulusFigure v-for="s in b.stimuli" :key="s.id" :stimulus="s" />
          </template>
          <KuizItem
            v-for="e in b.items"
            :key="e.item.id"
            v-model:picked="picked[e.item.id]"
            v-model:written="written[e.item.id]"
            :item="e.item"
            :chip="`Soalan ${e.number}`"
            :verdict="verdicts[e.item.id] ?? null"
            :busy="busyId === e.item.id"
            :error="errors[e.item.id]"
            @check="check(e.item)"
          />
        </div>
      </template>

      <DsStickyActions class="justify-between" data-testid="paper-quiz-pager">
        <UButton
          color="neutral"
          variant="outline"
          class="min-h-11"
          :disabled="page <= 1"
          data-testid="paper-quiz-prev"
          @click="go(-1)"
          >{{ kuizCopy.back }}</UButton
        >
        <p class="text-caption text-muted" data-testid="paper-quiz-score">
          Skor: <b class="text-primary">{{ score }}</b> / {{ markableTotal }}
        </p>
        <UButton
          class="min-h-11"
          :disabled="page >= pageCount"
          data-testid="paper-quiz-next"
          @click="go(1)"
          >{{ kuizCopy.forward }}</UButton
        >
      </DsStickyActions>
    </template>
  </DsPage>
</template>
