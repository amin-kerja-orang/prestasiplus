<script setup lang="ts">
/**
 * Kertas Subjektif detail (`/admin/kertas-subjektif/:id`, S3-T06, PRD30 Q-18 18-09 / 18-10 / 18-11): the tab `Kandungan`
 * (placements by section, `Muat naik PDF sumber`, `Buka di Set Builder`) and the tab `Skema` (scheme status of each placed
 * question and the link to the Studio question editor).
 */
import { BIJAK_BUILDER_MESSAGES, BIJAK_NEGERI_ORDER, bijakNegeriSlug } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import {
  DsBadge,
  DsCluster,
  DsDialog,
  DsEmptyState,
  DsFileField,
  DsFormField,
  DsHeading,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStack,
  DsStateView,
  DsStatusBadge,
  DsText,
  resolveIcon,
  usePersonality,
} from '@/ds'

import type { BuilderQuestion } from '../../domain/admin-types'
import { builderMessage, builderPath, subjektifPupilPath, SUBJEKTIF_PATH } from '../builder/server/api'
import { builderServer } from '../builder/server/client'

const M = BIJAK_BUILDER_MESSAGES
const MAX_MB = 30
const api = builderServer()
const route = useRoute()
const personality = usePersonality()
const ph = (name: string) => resolveIcon(name, personality.value)
const flash = useFlash()
const id = computed(() => String(route.params.id))

const editor = useApi(() => api.getEditor(id.value), id)
const paper = computed(() => editor.data.value?.paper ?? null)
const status = computed<'loading' | 'error' | 'ready'>(() =>
  editor.error.value ? 'error' : editor.data.value ? 'ready' : 'loading',
)

const tab = ref<'kandungan' | 'skema'>('kandungan')
const tabs = [
  { label: 'Kandungan', key: 'kandungan' as const },
  { label: 'Skema', key: 'skema' as const },
]

const byId = computed(() => new Map((editor.data.value?.questions ?? []).map((q) => [q.id, q])))
const sections = computed(() =>
  (paper.value?.sections ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    questions: s.questionIds.map((qid) => byId.value.get(qid)).filter((q): q is BuilderQuestion => !!q),
  })),
)
const placed = computed(() => sections.value.flatMap((s) => s.questions))

/** The one scheme rule of the server (`hasScheme` of the editor wire), never `servable`. */
const hasScheme = (q: BuilderQuestion): boolean => q.hasScheme === true
const negeri = computed(() => {
  const v = paper.value?.examBoard
  return v ? (BIJAK_NEGERI_ORDER.find((n) => bijakNegeriSlug(n) === bijakNegeriSlug(v)) ?? v) : '—'
})
const tempoh = computed(() => (paper.value?.durationMinutes ? String(paper.value.durationMinutes) : '—'))

/* ------------------------------------------------------------------ Muat naik PDF sumber */
const uploadOpen = ref(false)
const paperFile = ref<File | null>(null)
const schemeFile = ref<File | null>(null)
const uploading = ref(false)
const fileErrors = ref<{ paper: string; scheme: string }>({ paper: '', scheme: '' })
const uploadError = ref('')

function openUpload(): void {
  paperFile.value = null
  schemeFile.value = null
  fileErrors.value = { paper: '', scheme: '' }
  uploadError.value = ''
  uploadOpen.value = true
}

/** `.pdf` and at most 30 MB; '' when fine. */
function fileProblem(f: File): string {
  if (!/\.pdf$/i.test(f.name)) return M.sourcePdfInvalid
  if (f.size > MAX_MB * 1024 * 1024) return M.sourcePdfTooLarge
  return ''
}

watch(paperFile, (f) => (fileErrors.value.paper = f ? fileProblem(f) : ''))
watch(schemeFile, (f) => (fileErrors.value.scheme = f ? fileProblem(f) : ''))

async function upload(): Promise<void> {
  const paperProblem = paperFile.value ? fileProblem(paperFile.value) : M.sourcePdfInvalid
  const schemeProblem = schemeFile.value ? fileProblem(schemeFile.value) : ''
  fileErrors.value = { paper: paperProblem, scheme: schemeProblem }
  uploadError.value = ''
  if (paperProblem || schemeProblem || !paperFile.value || uploading.value) return
  uploading.value = true
  try {
    await api.uploadSource(id.value, { paper: paperFile.value, scheme: schemeFile.value })
    uploadOpen.value = false
    flash.show({ type: 'success', message: M.sourceUploaded })
    await editor.reload()
  } catch (e) {
    uploadError.value = builderMessage(e, 'Sesuatu tidak kena. Sila cuba lagi.')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <DsPage layout="detail" data-testid="sj-detail-page">
    <DsStateView
      :status="status"
      error="Tidak dapat memuatkan kertas."
      skeleton="text"
      data-testid="sj-detail-state"
      @retry="editor.reload()"
    >
      <DsStack v-if="paper" gap="md">
        <DsCluster justify="between" align="start">
          <DsStack gap="xs" align="start">
            <UButton :to="SUBJEKTIF_PATH" color="neutral" variant="ghost" :icon="ph('arrow-left')" label="Kertas Subjektif" data-testid="sj-back" />
            <DsHeading :level="2" data-testid="sj-title">{{ paper.title }}</DsHeading>
            <DsText variant="caption" tone="muted" data-testid="sj-meta">
              K{{ paper.kertas }} · {{ negeri }} · {{ paper.year }} · Tempoh (minit): {{ tempoh }} · Jumlah Markah:
              {{ paper.totalMarks ?? '—' }}
            </DsText>
          </DsStack>
          <DsCluster>
            <DsStatusBadge :status="paper.status === 'terbit' ? 'published' : 'draft'" />
            <UButton
              :to="subjektifPupilPath(paper.id)"
              color="neutral"
              variant="soft"
              :icon="ph('student')"
              label="Lihat sebagai pelajar"
              data-testid="sj-as-pupil"
            />
          </DsCluster>
        </DsCluster>

        <DsPillNav :items="tabs" :active="tab" label="Bahagian kertas" testid-prefix="sj-tab" @select="tab = $event" />

        <DsStack v-if="tab === 'kandungan'" as="section" gap="md" aria-label="Kandungan" data-testid="sj-tab-kandungan">
          <DsCluster>
            <UButton :icon="ph('upload-simple')" label="Muat naik PDF sumber" data-testid="sj-upload-open" @click="openUpload" />
            <UButton
              :to="builderPath(paper.id)"
              color="neutral"
              variant="soft"
              :icon="ph('hammer')"
              label="Buka di Set Builder"
              data-testid="sj-open-builder"
            />
          </DsCluster>
          <DsEmptyState v-if="placed.length === 0" :title="M.subjektifNoQuestions" icon="scroll" data-testid="sj-content-empty" />
          <template v-else>
            <DsPanel v-for="s in sections" :key="s.id" :title="s.label" :data-testid="`sj-section-${s.id}`">
              <DsStack as="ol" gap="sm">
                <DsCluster v-for="q in s.questions" :key="q.id" as="ul" justify="between" :data-testid="`sj-placement-${q.id}`">
                  <DsText as="li" variant="body" wrap="anywhere">{{ q.preview }}</DsText>
                  <DsText as="li" variant="caption" tone="muted" tabular>{{ q.marks }} markah</DsText>
                </DsCluster>
              </DsStack>
            </DsPanel>
          </template>
        </DsStack>

        <DsStack v-else as="section" gap="md" aria-label="Skema" data-testid="sj-tab-skema">
          <DsEmptyState v-if="placed.length === 0" :title="M.subjektifNoQuestions" icon="scroll" />
          <DsStack v-else as="ul" gap="sm">
            <DsPanel v-for="q in placed" :key="q.id" as="li" :data-testid="`sj-scheme-${q.id}`">
              <DsCluster justify="between">
                <DsText as="span" variant="body" wrap="anywhere">{{ q.preview }}</DsText>
                <DsCluster>
                  <DsBadge
                    v-if="hasScheme(q)"
                    tone="success"
                    icon="check-circle"
                    label="ada skema"
                    :data-testid="`sj-scheme-ok-${q.id}`"
                  />
                  <DsBadge
                    v-else
                    tone="warning"
                    icon="warning"
                    :label="M.subjektifNoScheme"
                    :data-testid="`sj-scheme-missing-${q.id}`"
                  />
                  <UButton
                    :to="{ name: 'm04.studio.edit', params: { id: q.id } }"
                    color="neutral"
                    variant="soft"
                    :icon="ph('pencil-simple')"
                    label="Sunting skema"
                    :data-testid="`sj-scheme-edit-${q.id}`"
                  />
                </DsCluster>
              </DsCluster>
            </DsPanel>
          </DsStack>
        </DsStack>
      </DsStack>
    </DsStateView>

    <DsDialog v-model:open="uploadOpen" title="Muat naik PDF sumber" :loading="uploading" data-testid="sj-upload-dialog">
      <DsStack as="form" gap="md" @submit.prevent="upload">
        <DsFormField label="Kertas (PDF)" required :error="fileErrors.paper">
          <DsFileField v-model="paperFile" accept=".pdf" data-testid="sj-file-paper" />
        </DsFormField>
        <DsFormField label="Skema (PDF)" :error="fileErrors.scheme">
          <DsFileField v-model="schemeFile" accept=".pdf" data-testid="sj-file-scheme" />
        </DsFormField>
        <DsText v-if="uploadError" variant="body" tone="error" role="alert" data-testid="sj-upload-error">{{ uploadError }}</DsText>
      </DsStack>
      <template #footer>
        <UButton color="neutral" variant="soft" label="Batal" @click="uploadOpen = false" />
        <UButton label="Muat naik PDF sumber" :loading="uploading" data-testid="sj-upload-submit" @click="upload" />
      </template>
    </DsDialog>
  </DsPage>
</template>
