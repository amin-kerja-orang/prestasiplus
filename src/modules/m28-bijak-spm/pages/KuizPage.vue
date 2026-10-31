<script setup lang="ts">
/**
 * Simulasi — Kuiz (`/simulasi/kuiz`, R1-F12): a random quiz of 5/10/20/40 objective questions, one
 * per screen (V2 `exam-sim/quiz.blade.php`). Count and subject come from the URL only (`?count=`,
 * `?subject=`; D83 D-7: no picker). "✓ Semak" is marked on the server; the verdict shows the
 * right option and the explanation. The quiz is stored as a practice session (U8), so Tamat finishes
 * it and shows the reward.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { DsEmptyState, DsLoadError, DsPage, DsProgress, DsStatTile } from '@/ds'
import type { BijakKuizCheckResult, BijakKuizResult, BijakKuizSession } from '@pp/contract'

import KuizItem from '../components/KuizItem.vue'
import { clock, kuizCopy, parseCount, parseSubject, percent } from '../lib/kuiz'
import { useLearnerTheme } from '../lib/use-bijak'
import { BijakError } from '../server/errors'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const server = bijakServer()

type Phase = 'loading' | 'error' | 'empty' | 'quiz' | 'finishing' | 'done'
const phase = ref<Phase>('loading')
const session = ref<BijakKuizSession | null>(null)
const index = ref(0)
const picked = ref<Record<string, string>>({})
const verdicts = ref<Record<string, BijakKuizCheckResult>>({})
const busy = ref(false)
const checkError = ref('')
const finishError = ref('')
const result = ref<BijakKuizResult | null>(null)
const seconds = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const count = computed(() => parseCount(route.query.count))
const subject = computed(() => parseSubject(route.query.subject))
const total = computed(() => session.value?.items.length ?? 0)
const item = computed(() => session.value?.items[index.value] ?? null)
const verdict = computed(() => (item.value ? (verdicts.value[item.value.id] ?? null) : null))
const isLast = computed(() => index.value + 1 >= total.value)
const localScore = computed(() => Object.values(verdicts.value).filter((v) => v.correct).length)
const progress = computed(() =>
  total.value ? Math.round(((index.value + (verdict.value ? 1 : 0)) / total.value) * 100) : 0,
)
const score = computed(() => result.value?.score ?? localScore.value)
const shownTotal = computed(() => result.value?.total ?? total.value)
const time = computed(() => clock(seconds.value))
function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = null
}
onBeforeUnmount(stopTimer)

function message(e: unknown, fallback: string): string {
  if (e instanceof BijakError) {
    if (e.code === 'offline') return 'Luar talian. Cuba lagi.'
    if (e.code === 'not_found' || e.code === 'bad_request') return e.message
  }
  return fallback
}

async function start(): Promise<void> {
  phase.value = 'loading'
  stopTimer()
  index.value = 0
  picked.value = {}
  verdicts.value = {}
  result.value = null
  seconds.value = 0
  checkError.value = ''
  finishError.value = ''
  try {
    session.value = await server.startKuiz({
      count: count.value,
      ...(subject.value ? { subject: subject.value } : {}),
    })
    if (!session.value.items.length) {
      phase.value = 'empty'
      return
    }
    phase.value = 'quiz'
    timer = setInterval(() => (seconds.value += 1), 1000)
  } catch (e) {
    phase.value = e instanceof BijakError && e.code === 'no_questions' ? 'empty' : 'error'
  }
}

async function check(): Promise<void> {
  const it = item.value
  const optionId = it ? picked.value[it.id] : undefined
  if (!it || !session.value || !optionId || busy.value || verdicts.value[it.id]) return
  busy.value = true
  checkError.value = ''
  try {
    const v = await server.checkKuiz(session.value.sessionId, { itemId: it.id, optionId })
    verdicts.value = { ...verdicts.value, [it.id]: v }
  } catch (e) {
    checkError.value = message(e, 'Jawapan tidak dapat disemak. Cuba lagi.')
  } finally {
    busy.value = false
  }
}

async function finish(): Promise<void> {
  if (!session.value) return
  phase.value = 'finishing'
  finishError.value = ''
  stopTimer()
  try {
    result.value = await server.finishKuiz(session.value.sessionId, seconds.value)
    phase.value = 'done'
  } catch (e) {
    finishError.value = message(e, 'Keputusan tidak dapat disimpan. Cuba lagi.')
    phase.value = 'quiz'
  }
}

function next(): void {
  if (isLast.value) {
    void finish()
    return
  }
  index.value += 1
  checkError.value = ''
}

// A new count/subject in the URL (hub link) starts a fresh quiz; "Cuba Lagi" calls start() with the chosen ones.
watch(
  () => [count.value, subject.value],
  () => void start(),
)
void start()
</script>

<template>
  <DsPage
    :title="kuizCopy.title"
    back-to="/spm/bijak"
    back-label="Bijak SPM"
    width="prose"
    data-testid="kuiz-page"
  >
    <div
      v-if="phase === 'loading'"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="kuiz-loading"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <DsLoadError
      v-else-if="phase === 'error'"
      message="Kuiz tidak dapat dimuatkan."
      retry-testid="kuiz-retry-load"
      @retry="start"
    />

    <div
      v-else-if="phase === 'empty'"
      class="flex flex-col items-center gap-4"
      data-testid="kuiz-empty"
    >
      <DsEmptyState :title="kuizCopy.empty" :description="kuizCopy.emptyHelp" icon="file-x" />
      <UButton to="/spm/bijak" color="neutral" class="min-h-11">{{ kuizCopy.fullPapers }}</UButton>
    </div>

    <template v-else-if="phase === 'done' && result">
      <UCard data-testid="kuiz-done">
        <div class="flex flex-col items-center gap-4 text-center">
          <h2 class="text-heading text-highlighted" tabindex="-1">
            {{ kuizCopy.done }}
          </h2>
          <div class="grid w-full max-w-sm grid-cols-2 gap-3">
            <DsStatTile
              :value="`${score}/${shownTotal}`"
              :unit="kuizCopy.score"
              data-testid="kuiz-score"
            />
            <DsStatTile
              :value="`${percent(score, shownTotal)}%`"
              :unit="kuizCopy.accuracy"
              data-testid="kuiz-accuracy"
            />
          </div>
          <p class="text-caption text-muted">{{ kuizCopy.time }}: {{ time }}</p>
          <div class="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
            <UButton class="min-h-11 justify-center" data-testid="kuiz-retry" @click="start">{{
              kuizCopy.retry
            }}</UButton>
            <UButton to="/spm/bijak" color="neutral" class="min-h-11 justify-center">{{
              kuizCopy.fullPapers
            }}</UButton>
          </div>
        </div>
      </UCard>
    </template>

    <template v-else-if="item">
      <div class="flex flex-col gap-3" data-testid="kuiz-header">
        <div class="flex items-start justify-between gap-3">
          <p class="text-caption text-muted" data-testid="kuiz-counter">
            Soalan {{ index + 1 }} daripada {{ total }}
          </p>
          <p class="text-right">
            <span class="block text-heading text-primary" data-testid="kuiz-time">{{ time }}</span>
            <span class="text-caption text-muted">{{ kuizCopy.time }}</span>
          </p>
        </div>
        <DsProgress :value="progress" :show-value="false" aria-label="Kemajuan kuiz" />
      </div>

      <UAlert v-if="finishError" color="error" variant="soft" :title="finishError" role="alert" />

      <KuizItem
        :key="item.id"
        v-model:picked="picked[item.id]"
        :item="item"
        :chip="`❓ Soalan ${index + 1}`"
        :verdict="verdict"
        :busy="busy || phase === 'finishing'"
        :error="checkError"
        @check="check"
      >
        <template #actions>
          <UButton
            v-if="verdict"
            class="min-h-11 w-full justify-center sm:w-auto"
            :loading="phase === 'finishing'"
            data-testid="kuiz-next"
            @click="next"
            >{{ isLast ? kuizCopy.finish : kuizCopy.next }}</UButton
          >
        </template>
      </KuizItem>
    </template>
  </DsPage>
</template>
