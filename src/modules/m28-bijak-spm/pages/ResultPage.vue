<script setup lang="ts">
/**
 * Result and Semakan (US-14, US-15, US-17, US-20, US-21). Win screen in the approved order: 3D hero
 * (party popper from 90%, trophy from 60%, books below) -> title -> score ring -> friend dialog
 * ("awak" voice) -> rewards -> Kongsi / Kembali ke Home. Below it: marks per section, per question
 * and per marking point, with the scheme revealed (only reachable after Hantar).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { DsEmptyState, DsFriendAvatar, DsSpeechBubble, DsWinScreen } from '@/ds'
import { useApi } from '@/composables/useApi'
import { useFriend } from '@/composables/useFriend'
import { useSession } from '@/composables/useSession'

import type { BijakGenerateShortage } from '@pp/contract'

import GenerateShortageAlert from '../components/GenerateShortageAlert.vue'
import KeywordSuggestion from '../components/KeywordSuggestion.vue'
import PartResultCard from '../components/PartResultCard.vue'
import PastSittingsLink from '../components/PastSittingsLink.vue'
import RichText from '../components/RichText.vue'
import SelfMarkControl from '../components/SelfMarkControl.vue'
import { needsAttention, sectionRuleLine } from '../domain/paper-model'
import type { ReviewPart } from '../domain/semakan'
import type {
  AttemptResult,
  PartResult,
  QuestionResult,
  QuestionView,
  SubjectCode,
} from '../domain/types'
import { rewardItems } from '../lib/rewards'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const router = useRouter()
const user = useBijakUser()
const { user: me, landingPath } = useSession()
const server = bijakServer()
const toast = useToast()
const attemptId = computed(() => String(route.params.attemptId))

const { data, error } = useApi(() => server.getResult(user.value, attemptId.value), attemptId)

const filter = ref<'semua' | 'perhatian'>('semua')
const filterItems = [
  { label: 'Semua soalan', value: 'semua' },
  { label: 'Perlu perhatian', value: 'perhatian' },
]

const { friend, friendName } = useFriend()
const name = computed(() => (me.value?.name ?? 'Murid').split(' ')[0] ?? 'Murid')
/** The result recomputed by the last self-mark; replaces the loaded one (totals, Bahagian, parts). */
const refreshed = ref<AttemptResult | null>(null)
watch(attemptId, () => {
  refreshed.value = null
})
const result = computed(() => refreshed.value ?? data.value?.result)
const review = (p: PartResult): ReviewPart => p

/**
 * Dirty-draft guard [PROPOSED: V2 has no such warning]: a stepper change that is not saved yet asks
 * before the pupil leaves the page (in-app navigation and tab close / reload).
 */
const LEAVE_WARNING = 'Anda ada markah kendiri yang belum disimpan. Tinggalkan halaman ini?'
const unsaved = ref(new Set<string>())
function onDirty(partId: string, dirty: boolean): void {
  const next = new Set(unsaved.value)
  if (dirty) next.add(partId)
  else next.delete(partId)
  unsaved.value = next
}
function warnOnUnload(e: BeforeUnloadEvent): void {
  if (!unsaved.value.size) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', warnOnUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnUnload))
onBeforeRouteLeave(() => (unsaved.value.size ? window.confirm(LEAVE_WARNING) : true))

async function saveSelfMark(body: { partId: string; mark: number; band?: string }): Promise<void> {
  const out = await server.selfMark(user.value, attemptId.value, body)
  refreshed.value = out.result
}
const percent = computed(() => result.value?.percent ?? 0)
const art = computed(() =>
  percent.value >= 90 ? 'party' : percent.value >= 60 ? 'trophy' : 'books',
)
const strong = computed(() => percent.value >= 60)
const title = computed(() =>
  percent.value >= 90
    ? `Sempurna, ${name.value}!`
    : strong.value
      ? `Hebat, ${name.value}!`
      : `Teruskan, ${name.value}!`,
)
const subtitle = computed(() =>
  result.value
    ? `Awak dapat ${result.value.score}/${result.value.max} markah${result.value.provisional ? ' (sementara)' : ''}.`
    : '',
)
const friendLine = computed(() =>
  result.value
    ? strong.value
      ? `Tahniah, ${name.value}! Awak dapat ${result.value.score}/${result.value.max}. Hebat!`
      : `Bagus sebab awak cuba, ${name.value}. Jom semak jawapan yang salah, awak pasti boleh!`
    : '',
)
/** The credited reward: always the loaded result, never the one recomputed after a self-mark. */
const rewards = computed(() => rewardItems(data.value?.result))

const questionMap = computed(
  () => new Map<string, QuestionView>((data.value?.paper.questions ?? []).map((q) => [q.id, q])),
)
const shown = computed<QuestionResult[]>(() =>
  (result.value?.questions ?? []).filter((q) => {
    return filter.value === 'semua' || needsAttention(q)
  }),
)

/** Topics where the most marks were lost (US-21). */
const weakTopics = computed(() => {
  const lost = new Map<string, number>()
  for (const q of result.value?.questions ?? []) {
    if (!q.counted) continue
    const topic = questionMap.value.get(q.questionId)?.topic
    if (topic) lost.set(topic, (lost.get(topic) ?? 0) + (q.marks - q.awarded))
  }
  return [...lost.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
})

const sectionLine = (id: string): string => {
  const s = data.value?.paper.sections.find((x) => x.id === id)
  return s ? sectionRuleLine(s) : ''
}

async function share(): Promise<void> {
  const r = result.value
  if (!r) return
  const text = `Saya dapat ${r.score}/${r.max} dalam ${data.value?.attempt.title} di PRESTASIPLUS.`
  try {
    if (navigator.share) await navigator.share({ text })
    else {
      await navigator.clipboard.writeText(text)
      toast.add({ title: 'Skor disalin', color: 'success' })
    }
  } catch {
    /* share cancelled */
  }
}

/** Retry on a Jana Kertas result (design 7.4): shortage / limit / no-contract show under the button. */
const retrying = ref(false)
const retryShortages = ref<BijakGenerateShortage[]>([])
const retryShortageKey = ref(0)
const retryMessage = ref('')

/** Cuba Lagi on a Kertas Pilihan (R1-B15): a fresh attempt on the same paper; the 409 text is shown as it is. */
async function retrySamePaper(attemptIdToRetry: string): Promise<void> {
  retrying.value = true
  retryMessage.value = ''
  try {
    const out = await server.retryAttempt(user.value, attemptIdToRetry)
    await router.push({ name: 'm28.bijak.attempt', params: { attemptId: out.attemptId } })
  } catch (e) {
    retryMessage.value =
      e instanceof Error && e.message
        ? e.message
        : 'Percubaan baharu tidak dapat dimulakan. Cuba lagi.'
  } finally {
    retrying.value = false
  }
}

/** Cuba Lagi on a Jana Kertas: a newly generated paper (design 7.4). */
async function retryGenerated(subject: SubjectCode, kertas: number): Promise<void> {
  retrying.value = true
  retryShortages.value = []
  retryMessage.value = ''
  let paperId: string
  try {
    const out = await server.generatePaper(user.value, subject, kertas)
    if (!out.ok) {
      if (out.reason === 'shortage') {
        retryShortages.value = out.shortages
        retryShortageKey.value += 1
      } else {
        retryMessage.value =
          out.reason === 'limit'
            ? 'Kertas tidak dapat disusun sekarang. Cuba lagi.'
            : 'Belum ada kontrak untuk subjek dan kertas ini'
      }
      return
    }
    paperId = out.paperId
  } catch {
    retryMessage.value = 'Kertas tidak dapat dijana sekarang. Cuba lagi.'
    return
  } finally {
    retrying.value = false
  }
  await router.push({ name: 'm28.bijak.cover', params: { paperId } })
}

async function retry(): Promise<void> {
  const a = data.value?.attempt
  if (!a || retrying.value) return
  if (a.paperKind === 'jana') await retryGenerated(a.subject, a.kertas)
  else await retrySamePaper(a.id)
}
const home = computed(() => landingPath.value || '/dashboard')
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6" data-testid="bijak-result">
    <DsEmptyState
      v-if="error"
      title="Semakan belum tersedia"
      description="Skema pemarkahan hanya dipaparkan selepas kertas dihantar."
      icon="i-ph-lock-key"
      data-testid="result-locked"
    />
    <div v-else-if="!data || !result" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <template v-else>
      <DsWinScreen
        :art="art"
        :title="title"
        :subtitle="subtitle"
        :score="result.score"
        :max="result.max"
        :ring-label="`Skor ${result.score} daripada ${result.max}`"
        :ring-unit="`daripada ${result.max}`"
        :rewards="rewards"
        data-testid="win-screen"
      >
        <template #friend>
          <DsFriendAvatar
            :friend="friend"
            :mood="strong ? 'celebrating' : 'encouraging'"
            size="md"
          />
          <DsSpeechBubble :name="friendName" live data-testid="friend-line">{{
            friendLine
          }}</DsSpeechBubble>
        </template>
        <template #actions>
          <UButton color="neutral" size="lg" block data-testid="share" @click="share"
            >Kongsi</UButton
          >
          <UButton size="lg" block :to="home" data-testid="home">Kembali ke Home</UButton>
        </template>
      </DsWinScreen>

      <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <UButton
          color="neutral"
          icon="i-ph-arrow-counter-clockwise"
          class="min-h-11"
          :loading="retrying"
          data-testid="retry"
          @click="retry"
          >Cuba Lagi</UButton
        >
        <PastSittingsLink :paper-id="data.attempt.paperId" :exclude="attemptId" />
        <UButton
          color="neutral"
          variant="ghost"
          to="/spm/bijak/sejarah"
          icon="i-ph-clock-counter-clockwise"
          >Sejarah Bijak SPM</UButton
        >
      </div>
      <GenerateShortageAlert
        v-if="retryShortages.length"
        :key="retryShortageKey"
        :shortages="retryShortages"
        class="mx-auto"
      />
      <UAlert
        v-if="retryMessage"
        color="error"
        variant="soft"
        :title="retryMessage"
        role="alert"
        data-testid="retry-message"
      />

      <UAlert
        v-if="data.attempt.status === 'auto_submitted'"
        color="info"
        variant="soft"
        icon="i-ph-timer"
        title="Masa tamat. Jawapan yang disimpan sebelum masa tamat telah dihantar."
        data-testid="auto-submitted"
      />

      <UAlert
        v-if="result.provisional"
        color="info"
        variant="soft"
        icon="i-ph-hourglass-medium"
        :title="`${result.pendingReview} bahagian belum dimarkah — perlu semakan`"
        description="Jumlah markah ialah sementara sehingga semakan selesai."
        data-testid="provisional"
      />

      <section class="flex flex-col gap-3" aria-labelledby="h-sections">
        <h2 id="h-sections" class="text-heading text-highlighted">Markah mengikut bahagian</h2>
        <UCard
          v-for="s in result.sections"
          :key="s.sectionId"
          :data-testid="`section-${s.sectionId}`"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="text-body text-highlighted">{{ s.label }}</h3>
              <span class="tabular text-label text-highlighted" data-testid="section-score"
                >{{ s.awarded }} / {{ s.marks }}</span
              >
            </div>
            <p class="text-caption text-muted">{{ sectionLine(s.sectionId) }}</p>
            <p v-if="s.chooseN" class="text-caption text-toned" data-testid="counted-note">
              Soalan yang dikira:
              {{
                s.counted
                  .map((id) => questionMap.get(id)?.number)
                  .filter(Boolean)
                  .join(', ') || 'tiada'
              }}
            </p>
          </div>
        </UCard>
      </section>

      <section
        v-if="weakTopics.length"
        class="flex flex-col gap-2"
        aria-labelledby="h-weak"
        data-testid="weak-topics"
      >
        <h2 id="h-weak" class="text-heading text-highlighted">Topik untuk disemak</h2>
        <ul class="flex flex-col gap-1 text-body text-default">
          <li v-for="[t, n] in weakTopics" :key="t">{{ t }} — {{ n }} markah hilang</li>
        </ul>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="h-questions">
        <h2 id="h-questions" class="text-heading text-highlighted">Semakan soalan</h2>
        <UTabs v-model="filter" :items="filterItems" :content="false" />
        <p v-if="!shown.length" class="text-body text-muted">Tiada soalan dalam paparan ini.</p>
        <UCard v-for="q in shown" :key="q.questionId" :data-testid="`result-q-${q.number}`">
          <details>
            <summary
              class="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-body text-highlighted"
            >
              <span>
                Soalan {{ q.number }}
                <UBadge v-if="!q.counted" color="neutral" variant="subtle" class="ms-2"
                  >Tidak dikira</UBadge
                >
              </span>
              <span class="tabular" data-testid="q-score">{{ q.awarded }} / {{ q.marks }}</span>
            </summary>
            <div class="mt-3 flex flex-col gap-3">
              <p v-if="questionMap.get(q.questionId)?.stem" class="text-body text-default">
                <RichText :text="questionMap.get(q.questionId)!.stem" />
              </p>
              <PartResultCard
                v-for="p in q.parts"
                :key="p.partId"
                :result="p"
                :options="questionMap.get(q.questionId)?.mcq?.options"
              >
                <template v-if="review(p).selfMarkable" #semakan>
                  <KeywordSuggestion
                    v-if="review(p).suggestion"
                    :suggestion="review(p).suggestion!"
                    :max="p.marks"
                  />
                  <SelfMarkControl :part="review(p)" :save="saveSelfMark" @dirty="onDirty" />
                </template>
              </PartResultCard>
            </div>
          </details>
        </UCard>
      </section>
    </template>
  </main>
</template>
