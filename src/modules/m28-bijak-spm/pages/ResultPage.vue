<script setup lang="ts">
/**
 * Result and Semakan (US-14, US-15, US-17, US-20, US-21). Win screen in the approved order: 3D hero
 * (party popper from 90%, trophy from 60%, books below) -> title -> score ring -> friend dialog
 * ("awak" voice) -> rewards -> Kongsi / Kembali ke Home. Below it: marks per section, per question
 * and per marking point, with the scheme revealed (only reachable after Hantar).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  DsEmptyState,
  DsFriendAvatar,
  DsSpeechBubble,
  DsWinScreen,
  DsStack,
  DsCluster,
  DsHeading,
  DsText,
} from '@/ds'
import { useApi } from '@/composables/useApi'
import { useFriend } from '@/composables/useFriend'
import { useSession } from '@/composables/useSession'

import PartResultCard from '../components/PartResultCard.vue'
import RichText from '../components/RichText.vue'
import { sectionRuleLine } from '../domain/paper-model'
import type { QuestionResult, QuestionView } from '../domain/types'
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
const result = computed(() => data.value?.result)
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
const rewards = computed(() => [
  { id: 'mata', value: `+${result.value?.points ?? 0}`, unit: 'Mata', art: 'bolt' as const },
  { id: 'koin', value: `+${result.value?.coins ?? 0}`, unit: 'Koin', art: 'coin' as const },
])

const questionMap = computed(
  () => new Map<string, QuestionView>((data.value?.paper.questions ?? []).map((q) => [q.id, q])),
)
const shown = computed<QuestionResult[]>(() =>
  (result.value?.questions ?? []).filter((q) => {
    if (filter.value === 'semua') return true
    return q.counted && (q.awarded < q.marks || q.parts.some((p) => p.status === 'belum_dimarkah'))
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

async function retry(): Promise<void> {
  const a = data.value?.attempt
  if (!a) return
  let paperId = a.paperId
  if (a.paperKind === 'jana') {
    const out = await server.generatePaper(user.value, a.subject, a.kertas)
    if (!out.ok) {
      await router.push({ name: 'm28.bijak', query: { tab: 'jana' } })
      return
    }
    paperId = out.paperId
  }
  await router.push({ name: 'm28.bijak.cover', params: { paperId } })
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
    <DsStack v-else-if="!data || !result" gap="sm" aria-busy="true">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-24 w-full" />
    </DsStack>

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
          data-testid="retry"
          @click="retry"
          >Cuba lagi</UButton
        >
        <UButton
          color="neutral"
          variant="ghost"
          to="/spm/bijak/sejarah"
          icon="i-ph-clock-counter-clockwise"
          >Sejarah Bijak SPM</UButton
        >
      </div>

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

      <DsStack as="section" gap="sm" aria-labelledby="h-sections">
        <DsHeading id="h-sections" :level="2">Markah mengikut bahagian</DsHeading>
        <UCard
          v-for="s in result.sections"
          :key="s.sectionId"
          :data-testid="`section-${s.sectionId}`"
        >
          <DsStack gap="2xs">
            <DsCluster align="baseline" justify="between" :wrap="false">
              <h3 class="text-body text-highlighted">{{ s.label }}</h3>
              <DsText variant="label" tone="highlighted" tabular data-testid="section-score"
                >{{ s.awarded }} / {{ s.marks }}</DsText
              >
            </DsCluster>
            <DsText variant="caption">{{ sectionLine(s.sectionId) }}</DsText>
            <DsText v-if="s.chooseN" variant="caption" tone="toned" data-testid="counted-note">
              Soalan yang dikira:
              {{
                s.counted
                  .map((id) => questionMap.get(id)?.number)
                  .filter(Boolean)
                  .join(', ') || 'tiada'
              }}
            </DsText>
          </DsStack>
        </UCard>
      </DsStack>

      <DsStack
        v-if="weakTopics.length"
        as="section"
        gap="xs"
        aria-labelledby="h-weak"
        data-testid="weak-topics"
      >
        <DsHeading id="h-weak" :level="2">Topik untuk disemak</DsHeading>
        <ul class="flex flex-col gap-1 text-body text-default">
          <li v-for="[t, n] in weakTopics" :key="t">{{ t }} — {{ n }} markah hilang</li>
        </ul>
      </DsStack>

      <DsStack as="section" gap="sm" aria-labelledby="h-questions">
        <DsHeading id="h-questions" :level="2">Semakan soalan</DsHeading>
        <UTabs v-model="filter" :items="filterItems" :content="false" />
        <DsText v-if="!shown.length" variant="body" tone="muted"
          >Tiada soalan dalam paparan ini.</DsText
        >
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
              <DsText v-if="questionMap.get(q.questionId)?.stem" variant="body">
                <RichText :text="questionMap.get(q.questionId)!.stem" />
              </DsText>
              <PartResultCard
                v-for="p in q.parts"
                :key="p.partId"
                :result="p"
                :options="questionMap.get(q.questionId)?.mcq?.options"
              />
            </div>
          </details>
        </UCard>
      </DsStack>
    </template>
  </main>
</template>
