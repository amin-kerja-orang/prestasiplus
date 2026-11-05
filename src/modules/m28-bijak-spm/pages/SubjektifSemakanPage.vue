<script setup lang="ts">
/**
 * Semakan of a Kertas Subjektif sitting (S3-T06, 46 section 4.7 screen 3, sections 3.4 and 3.5).
 * The page is read without the scheme. "Tunjuk Skema Pemarkahan" fetches `result?scheme=1` at the press and
 * "Sembunyi" hides it again; until then no scheme text is held (AC-MUR-13-21). Self-mark per leaf part uses the
 * existing stepper; once the scheme is shown the save asks the server to keep it in its answer.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'

import {
  DsCluster,
  DsEmptyState,
  DsHeading,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsText,
} from '@/ds'
import { useApi } from '@/composables/useApi'

import KeywordSuggestion from '../components/KeywordSuggestion.vue'
import PartResultCard from '../components/PartResultCard.vue'
import ResultGroup from '../components/ResultGroup.vue'
import SelfMarkControl from '../components/SelfMarkControl.vue'
import { RichText, StimulusGroup } from '../../../components/question-display'
import type { ReviewPart } from '../domain/semakan'
import type { AttemptResult, GroupView, PartResult, QuestionResult, QuestionView, ResultView, StimulusDef } from '../domain/types'
import { stimuliOf, toStimulusData } from '../lib/stimulus-data'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const user = useBijakUser()
const server = bijakServer()
const attemptId = computed(() => String(route.params.attemptId))

const { data, error, reload } = useApi(() => server.getResult(user.value, attemptId.value), attemptId)
/** Before Hantar & Semak the server answers 409 (`not_submitted`): the button stays disabled. */
const missing = computed(() => {
  const code = (error.value as { code?: string } | null)?.code
  if (code === 'not_found' || code === 'forbidden') return true
  const a = data.value?.attempt
  return !!a && (a.paperId !== String(route.params.paperId) || (a.paperKind as string) !== 'subjektif')
})
const notSubmitted = computed(() => (error.value as { code?: string } | null)?.code === 'not_submitted')

/* ----------------------------------------------------------------------- the scheme */
const SCHEME_UNAVAILABLE = 'Skema pemarkahan tidak tersedia untuk kertas ini.'
const shown = ref(false)
const schemeLoading = ref(false)
const schemeError = ref('')
/** The result with its scheme, as the last "Tunjuk Skema Pemarkahan" press (or a self-mark after it) returned it. */
const withScheme = ref<AttemptResult | null>(null)
/** The result recomputed by the last self-mark while the scheme was hidden. */
const refreshed = ref<AttemptResult | null>(null)

watch(attemptId, () => {
  shown.value = false
  withScheme.value = null
  refreshed.value = null
  schemeError.value = ''
})

async function toggleScheme(): Promise<void> {
  if (shown.value) {
    shown.value = false
    withScheme.value = null
    return
  }
  if (schemeLoading.value || !data.value) return
  schemeLoading.value = true
  schemeError.value = ''
  try {
    const view: ResultView = await server.getResult(user.value, attemptId.value, true)
    withScheme.value = view.result
    refreshed.value = null
    shown.value = true
  } catch {
    schemeError.value = SCHEME_UNAVAILABLE
  } finally {
    schemeLoading.value = false
  }
}

const result = computed<AttemptResult | undefined>(() =>
  shown.value ? (withScheme.value ?? undefined) : (refreshed.value ?? data.value?.result),
)

/** The scheme parts of a part are not given to the stepper while the scheme is hidden (no band list before the press). */
const review = (p: PartResult): ReviewPart =>
  shown.value ? p : { ...p, scheme: { marks: p.marks }, points: [] }

/* ------------------------------------------------------------- self-mark and leave guard */
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
  // Once the scheme is shown the answer keeps it (`?scheme=1`); hidden, the answer has none.
  const out = await server.selfMark(user.value, attemptId.value, body, shown.value)
  // ONE latest result: the scheme-stripped copy is always kept, so hide and show both read the latest marks.
  refreshed.value = stripScheme(out.result)
  if (shown.value) withScheme.value = out.result
}

function stripScheme(r: AttemptResult): AttemptResult {
  return {
    ...r,
    questions: r.questions.map((q) => ({
      ...q,
      parts: q.parts.map((p) => {
        const rest = { ...p, points: [], scheme: { marks: p.marks } } as ReviewPart
        delete rest.suggestion
        return rest
      }),
    })),
  }
}

/* --------------------------------------------------------------------------- the view */
const paper = computed(() => data.value?.paper)
const questionMap = computed(() => new Map<string, QuestionView>((paper.value?.questions ?? []).map((q) => [q.id, q])))
const ownStimuli = (id: string): StimulusDef[] => {
  const q = questionMap.value.get(id)
  return q?.stimuli ?? (q?.stemImage ? [q.stemImage] : [])
}

/** Questions in reading order; consecutive members of one stimulus group are gathered under one block (D90). */
const blocks = computed(() => {
  const groupOf = new Map<string, GroupView>()
  for (const g of paper.value?.groups ?? []) for (const id of g.questionIds) groupOf.set(id, g)
  const out: { key: string; group?: GroupView; items: QuestionResult[] }[] = []
  for (const q of result.value?.questions ?? []) {
    const g = groupOf.get(q.questionId)
    const last = out[out.length - 1]
    if (g && last?.group?.id === g.id) last.items.push(q)
    else out.push({ key: `${g?.id ?? 'q'}:${q.questionId}`, group: g, items: [q] })
  }
  return out
})

const heading = computed(() => {
  const a = data.value?.attempt
  if (!a) return 'Semakan Kertas Subjektif'
  const name = server.subjects().find((s) => s.code === a.subject)?.name ?? a.subject
  return `${name} — Kertas ${a.kertas}`
})
const optionsOf = (id: string) => questionMap.value.get(id)?.mcq?.options
const answerText = (p: PartResult): string[] =>
  [...(p.answer.steps ?? []).filter((s) => s.trim()), p.answer.final?.trim() ?? '', p.answer.text?.trim() ?? '']
    .filter(Boolean)
</script>

<template>
  <DsPage
    :title="heading"
    back-to="/kertas-subjektif"
    back-label="Kertas Subjektif"
    data-testid="subjektif-semakan"
  >
    <DsEmptyState
      v-if="missing"
      title="Kertas ini tidak dijumpai."
      icon="i-ph-file-x"
      data-testid="paper-not-found"
    >
      <template #actions>
        <UButton to="/kertas-subjektif" size="lg">Kembali ke Kertas Subjektif</UButton>
      </template>
    </DsEmptyState>
    <DsEmptyState
      v-else-if="notSubmitted"
      title="Semakan belum tersedia"
      description="Hantar & Semak dahulu untuk melihat skema."
      icon="i-ph-lock-key"
      data-testid="semakan-locked"
    >
      <template #actions>
        <UButton
          color="neutral"
          size="lg"
          disabled
          title="Hantar & Semak dahulu untuk melihat skema."
          data-testid="scheme-toggle"
          >Tunjuk Skema Pemarkahan</UButton
        >
      </template>
    </DsEmptyState>
    <DsLoadError v-else-if="error" message="Semakan tidak dapat dimuatkan." @retry="reload" />
    <DsStateView
      v-else-if="!data || !result"
      status="loading"
      skeleton="list"
      :rows="2"
      data-testid="semakan-loading"
    />

    <template v-else>
      <UCard data-testid="semakan-total">
        <DsCluster justify="between" stack-below="sm" align="start">
          <DsStack gap="2xs">
            <DsText variant="caption" tone="muted">Jumlah markah</DsText>
            <DsText variant="title" tone="highlighted" tabular data-testid="total">
              {{ result.score }} / {{ result.max }}
            </DsText>
          </DsStack>
          <UButton
            color="primary"
            size="lg"
            :loading="schemeLoading"
            :aria-expanded="shown"
            data-testid="scheme-toggle"
            @click="toggleScheme"
            >{{ shown ? 'Sembunyi' : 'Tunjuk Skema Pemarkahan' }}</UButton
          >
        </DsCluster>
      </UCard>

      <UAlert
        v-if="schemeError"
        color="error"
        variant="soft"
        :title="schemeError"
        role="alert"
        data-testid="scheme-error"
      />

      <UAlert
        v-if="result.provisional"
        color="info"
        variant="soft"
        icon="i-ph-hourglass-medium"
        :title="`Markah sementara - ${result.pendingReview} bahagian belum dimarkah.`"
        data-testid="provisional"
      />

      <DsStack as="section" aria-label="Semakan soalan">
        <component
          :is="b.group ? ResultGroup : DsStack"
          v-for="b in blocks"
          :key="b.key"
          v-bind="b.group ? { groupId: b.group.id, stimuli: stimuliOf(b.group) } : {}"
        >
          <UCard v-for="q in b.items" :key="q.questionId" :data-testid="`result-q-${q.number}`">
            <DsStack>
              <DsCluster justify="between" align="baseline">
                <DsHeading :level="2" variant="label">Soalan {{ q.number }}</DsHeading>
                <DsText variant="label" tone="highlighted" tabular data-testid="q-score"
                  >{{ q.awarded }} / {{ q.marks }}</DsText
                >
              </DsCluster>
              <div v-if="ownStimuli(q.questionId).length" data-testid="own-stimuli">
                <StimulusGroup :stimuli="ownStimuli(q.questionId).map(toStimulusData)" :hint="false" />
              </div>
              <DsText v-if="questionMap.get(q.questionId)?.stem" variant="body" tone="default">
                <RichText :text="questionMap.get(q.questionId)!.stem" />
              </DsText>

              <DsStack v-for="p in q.parts" :key="p.partId">
                <PartResultCard v-if="shown" :result="p" :options="optionsOf(q.questionId)" />
                <DsPanel
                  v-else
                  as="section"
                  tone="inset"
                  padding="sm"
                  :data-testid="`part-plain-${p.partId}`"
                >
                  <DsStack gap="sm">
                    <DsCluster justify="between">
                      <DsHeading :level="3" variant="label">
                        {{ p.label ? `Bahagian ${p.label}` : 'Jawapan anda' }}
                      </DsHeading>
                      <DsText variant="label" tone="highlighted" tabular data-testid="part-marks"
                        >{{ p.awarded }} / {{ p.marks }}</DsText
                      >
                    </DsCluster>
                    <DsText v-if="p.answer.choice" variant="body" tone="default">
                      Pilihan anda: <strong>{{ p.answer.choice }}</strong>
                    </DsText>
                    <DsText v-for="(line, i) in answerText(p)" :key="i" variant="body" tone="default">
                      {{ line }}
                    </DsText>
                    <DsText
                      v-if="p.status === 'kosong'"
                      variant="body"
                      tone="muted"
                      data-testid="part-empty"
                    >
                      Tiada jawapan.
                    </DsText>
                  </DsStack>
                </DsPanel>

                <DsStack v-if="review(p).selfMarkable" gap="sm">
                  <KeywordSuggestion
                    v-if="shown && review(p).suggestion"
                    :suggestion="review(p).suggestion!"
                    :max="p.marks"
                  />
                  <SelfMarkControl
                    :key="attemptId"
                    :part="review(p)"
                    :save="saveSelfMark"
                    @dirty="onDirty"
                  />
                </DsStack>
              </DsStack>
            </DsStack>
          </UCard>
        </component>
      </DsStack>
    </template>
  </DsPage>
</template>
