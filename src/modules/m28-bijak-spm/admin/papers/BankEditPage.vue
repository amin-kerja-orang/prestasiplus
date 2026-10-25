<script setup lang="ts">
/**
 * Sunting soalan (`/admin/spm/soalan/:qid/sunting`): the full intake editor on a Terbit bank
 * question - stem, options and key, parts, scheme, DSKP tag and the shared stimulus text. Saving
 * creates version n+1 in the review queue (same gate as an extracted batch); the live version keeps
 * serving students until the new one is approved. The adjacent-editor pattern of .cloud
 * (`/spm/soalan/{q}/sunting`).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import {
  DsCluster,
  DsFormField,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStatusBadge,
  DsText,
  dsCopy,
} from '@/ds'

import StimulusView from '../../components/StimulusView.vue'
import QuestionEditor from '../intake/components/QuestionEditor.vue'
import { TAG_COPY } from '../intake/domain/tag-view'
import { tagLookup, useDskpSubject } from '../../lib/dskp-source'
import { validateRevision } from '../intake/domain/validation'
import type { IntakeQuestion, IntakeStimulus } from '../intake/types'
import { bijakServer } from '../../server/client'
import { ADMIN_ROUTES, KIND_LABEL, STATUS_BADGE, detailMessage, sharersText } from './ui'

const props = defineProps<{ qid: string }>()

const server = bijakServer()
const router = useRouter()
const flash = useFlash()

const { data, error, reload } = useApi(() => server.getBankEditable(props.qid), () => props.qid)

const draft = ref<IntakeQuestion | null>(null)
const stimulus = ref<IntakeStimulus | undefined>()
const note = ref('')
const busy = ref(false)
const serverErrors = ref<string[]>([])

watch(
  data,
  (d) => {
    if (!d) return
    draft.value = JSON.parse(JSON.stringify(d.question)) as IntakeQuestion
    stimulus.value = d.stimulus ? (JSON.parse(JSON.stringify(d.stimulus)) as IntakeStimulus) : undefined
    serverErrors.value = []
  },
  { immediate: true },
)

const locked = computed(() => data.value?.pendingRevision === true)
// The question's subject catalogue is loaded once for the editor. While it loads (or failed) the tag
// cannot be judged, so no tag issue is listed and the revision is not sent (DSKP-T03 review F6).
const dskp = useDskpSubject(() => draft.value?.tag.subject)
const tagPending = computed(() => dskp.loading.value || dskp.error.value !== undefined)
const issues = computed<string[]>(() => {
  void dskp.view.value
  return draft.value
    ? validateRevision(draft.value, stimulus.value, tagLookup(), { skipTag: tagPending.value })
    : []
})
const gateTitle = computed(() => {
  if (issues.value.length === 0 && serverErrors.value.length === 0) {
    if (dskp.loading.value) return dsCopy.loading
    if (dskp.error.value) return TAG_COPY.loadError
    return 'Semua semakan kualiti lulus. Sedia dihantar sebagai versi baharu.'
  }
  return `${issues.value.length || serverErrors.value.length} perkara perlu dibaiki sebelum dihantar`
})
const nextVersion = computed(() => (data.value?.row.version ?? 1) + 1)

function patchStimulus(p: Partial<IntakeStimulus>): void {
  if (stimulus.value) stimulus.value = { ...stimulus.value, ...p }
}

async function save(): Promise<void> {
  if (!draft.value || locked.value || issues.value.length > 0 || tagPending.value || busy.value) return
  busy.value = true
  serverErrors.value = []
  try {
    const res = await server.reviseQuestionFull(
      props.qid,
      draft.value,
      stimulus.value,
      note.value,
    )
    if (!res.ok) {
      serverErrors.value = res.errors
      return
    }
    flash.show({
      type: 'success',
      message: 'Versi baharu dihantar untuk semakan. Versi semasa terus melayani pelajar.',
    })
    await router.push({ name: ADMIN_ROUTES.bank, query: { buka: props.qid } })
  } catch (e) {
    serverErrors.value = [detailMessage(e)]
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    layout="detail"
    width="wide"
    title="Sunting soalan"
    subtitle="Sunting soalan penuh sebagai versi baharu. Versi semasa terus melayani pelajar sehingga versi baharu diluluskan."
    :back-to="{ name: ADMIN_ROUTES.bank }"
    back-label="Bank Soalan SPM"
    data-testid="bank-edit-page"
  >
    <DsLoadError
      v-if="error"
      message="Tidak dapat memuatkan soalan untuk disunting."
      @retry="reload()"
    />

    <template v-else-if="data && draft">
      <DsPanel data-testid="edit-meta">
        <DsCluster justify="between">
          <DsCluster>
            <DsStatusBadge :status="STATUS_BADGE[data.row.status]" />
            <DsText variant="caption" tone="muted" as="span">{{ data.row.id }}</DsText>
            <DsText variant="caption" tone="muted" as="span">
              {{ data.row.subjectName }} · Kertas {{ data.row.kertas }} ·
              {{ KIND_LABEL[data.row.kind] }}
            </DsText>
            <DsText variant="caption" tone="muted" as="span">
              Versi {{ data.row.version }} sedang melayani pelajar
            </DsText>
          </DsCluster>
          <UBadge color="primary" variant="subtle">Versi baharu: v{{ nextVersion }}</UBadge>
        </DsCluster>
      </DsPanel>

      <UAlert
        v-if="locked"
        color="warning"
        variant="subtle"
        icon="i-ph-hourglass"
        title="Versi baharu menunggu semakan"
        description="Soalan ini sudah mempunyai versi baharu dalam Baris Gilir Semakan. Tunggu keputusan sebelum menyunting semula."
        data-testid="edit-locked"
      >
        <template #actions>
          <UButton
            :to="`/admin/spm/semakan/v:${qid}`"
            size="sm"
            color="warning"
            variant="outline"
            icon="i-ph-seal-check"
          >
            Buka dalam Baris Gilir Semakan
          </UButton>
        </template>
      </UAlert>

      <DsPanel v-if="stimulus" data-testid="edit-stimulus">
        <DsStack as="fieldset" gap="sm" :disabled="locked">
          <DsText as="legend" variant="subheading" tone="highlighted">
            Rajah / petikan dikongsi: {{ stimulus.label }}
          </DsText>
          <DsText variant="caption" tone="muted" data-testid="edit-stimulus-sharers">
            {{
              data.sharers
                ? sharersText(data.sharers)
                : 'Perubahan di sini terpakai untuk semua soalan dalam kumpulan ini.'
            }}
          </DsText>
          <StimulusView :stimulus="stimulus" />
          <DsFormField native for="edit-caption" label="Tajuk kapsyen">
            <UInput
              id="edit-caption"
              :model-value="stimulus.caption ?? ''"
              class="w-full"
              @update:model-value="patchStimulus({ caption: String($event) })"
            />
          </DsFormField>
          <DsFormField native for="edit-alt" label="Teks alternatif (wajib)">
            <UInput
              id="edit-alt"
              :model-value="stimulus.alt"
              class="w-full"
              data-testid="edit-stimulus-alt"
              @update:model-value="patchStimulus({ alt: String($event) })"
            />
          </DsFormField>
          <DsFormField v-if="stimulus.kind === 'passage'" native for="edit-text" label="Teks petikan">
            <UTextarea
              id="edit-text"
              :model-value="stimulus.text ?? ''"
              :rows="3"
              class="w-full"
              @update:model-value="patchStimulus({ text: String($event) })"
            />
          </DsFormField>
        </DsStack>
      </DsPanel>

      <DsPanel data-testid="edit-question">
        <fieldset :disabled="locked" class="min-w-0">
          <legend class="sr-only">Soalan</legend>
          <QuestionEditor
            v-model="draft"
            hide-number
            :dskp="dskp"
            :disabled="locked"
            :show-errors="serverErrors.length > 0"
            @retry="dskp.retry()"
          />
        </fieldset>
      </DsPanel>

      <DsPanel>
        <fieldset :disabled="locked" class="min-w-0">
          <DsFormField native for="edit-note" label="Nota perubahan">
            <UInput
              id="edit-note"
              v-model="note"
              class="w-full"
              placeholder="cth. Pilihan C diperjelas"
              data-testid="edit-note"
            />
          </DsFormField>
        </fieldset>
      </DsPanel>

      <UAlert
        v-if="!locked"
        :color="issues.length === 0 && serverErrors.length === 0 && !tagPending ? 'success' : 'warning'"
        variant="subtle"
        role="status"
        aria-live="polite"
        :title="gateTitle"
        data-testid="edit-gate"
      >
        <template v-if="issues.length > 0 || serverErrors.length > 0" #description>
          <ul class="list-inside list-disc">
            <li v-for="e in [...new Set([...issues, ...serverErrors])]" :key="e">{{ e }}</li>
          </ul>
        </template>
      </UAlert>

      <DsCluster justify="end" data-testid="edit-actions">
        <UButton
          color="neutral"
          variant="ghost"
          label="Batal"
          class="min-h-11"
          :to="{ name: ADMIN_ROUTES.bank }"
          data-testid="edit-cancel"
        />
        <UButton
          icon="i-ph-paper-plane-tilt"
          label="Hantar untuk semakan"
          class="min-h-11"
          :loading="busy"
          :disabled="locked || issues.length > 0 || tagPending"
          data-testid="edit-submit"
          @click="save"
        />
      </DsCluster>
    </template>
  </DsPage>
</template>
