<script setup lang="ts">
/**
 * `/admin/feature-toggles` "Kawalan Ciri" (S0-T10, R1-ADM-N-06; API-ADM-09). One switch per row, acts at once, no
 * save button. Rows are grouped `Pelajar` then `Guru` (an empty `Guru` group is not drawn), in server order
 * (`sort_order`). A locked row has its switch disabled and reads `Off`. Turning a pupil-facing flag OFF asks
 * first; a failed write puts the switch back and shows the error. One column at every width (no table), so
 * there is no horizontal page scroll at 375 / 768 / 1280.
 */
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '@/api/errors'
import { useApi, useFlash } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsGrid,
  DsHeading,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsSwitchField,
  DsText,
  dsCopy,
  useConfirm,
} from '@/ds'

import { fetchFeatureToggles, setFeatureToggle, type FeatureToggle } from '../api/feature-toggles'

const COPY = {
  empty: 'Tiada ciri didaftarkan.',
  notice: 'Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya.',
  loadFailed: 'Gagal memuat senarai.',
  on: 'Aktif',
  off: 'Off',
  groupPelajar: 'Pelajar',
  groupGuru: 'Guru',
  confirmBody: 'Modul ini akan hilang daripada menu dan pautannya akan memaparkan halaman 404.',
  cancel: 'Batal',
  confirmYes: 'Ya, Matikan',
  offline: 'Tindakan tidak dapat dihantar. Semak sambungan anda.',
} as const

const flash = useFlash()
const confirm = useConfirm()

const { data, error, reload } = useApi((signal) => fetchFeatureToggles(signal))

/** Local copy of the rows: a switch moves at once and is put back when the write fails. */
const rows = ref<FeatureToggle[]>([])
const pending = reactive<Record<string, boolean>>({})
/** Bumped to make a controlled switch redraw at its stored value (cancelled confirm, failed write). */
const redraw = reactive<Record<string, number>>({})

const loaded = computed(() => data.value !== null)
watch(
  data,
  (list) => {
    rows.value = list ? list.map((r) => ({ ...r })) : []
  },
  { immediate: true },
)

const status = computed<'loading' | 'error' | 'ready'>(() => {
  if (error.value) return 'error'
  if (!loaded.value) return 'loading'
  return 'ready'
})

const groups = computed(() =>
  [
    { audience: 'pelajar', label: COPY.groupPelajar },
    { audience: 'guru', label: COPY.groupGuru },
  ]
    .map((g) => ({ ...g, items: rows.value.filter((r) => r.audience === g.audience) }))
    .filter((g) => g.items.length > 0),
)

const stateWord = (row: FeatureToggle): string => (row.enabled && !row.locked ? COPY.on : COPY.off)

/** The message of a failed write: the server's BM text for a refused change, else the generic text of 40 X10. */
function writeError(err: unknown): string {
  if (!isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR') return COPY.offline
  if (err.status >= 400 && err.status < 500 && err.message !== '' && !/^HTTP \d+$/.test(err.message)) {
    return err.message
  }
  return dsCopy.error500Description
}

async function toggle(row: FeatureToggle, next: boolean): Promise<void> {
  if (pending[row.key] || row.locked || next === row.enabled) return
  if (!next && row.audience === 'pelajar') {
    const ok = await confirm({
      title: `Matikan "${row.labelMs}"?`,
      message: COPY.confirmBody,
      cancelLabel: COPY.cancel,
      confirmLabel: COPY.confirmYes,
      tone: 'error',
    })
    if (!ok) {
      redraw[row.key] = (redraw[row.key] ?? 0) + 1
      return
    }
  }
  const before = row.enabled
  row.enabled = next
  pending[row.key] = true
  try {
    const saved = await setFeatureToggle(row.key, next)
    Object.assign(row, saved)
    flash.show({
      type: 'success',
      message: next ? `Ciri "${row.labelMs}" telah DIAKTIFKAN.` : `Ciri "${row.labelMs}" telah DINYAHAKTIFKAN.`,
    })
  } catch (err) {
    row.enabled = before
    redraw[row.key] = (redraw[row.key] ?? 0) + 1
    flash.show({ type: 'error', message: writeError(err) })
  } finally {
    pending[row.key] = false
  }
}
</script>

<template>
  <DsPage layout="form" data-testid="feature-toggles-page">
    <!-- The lead sentence is the page's own subtitle line (the shell prints the route subtitle). -->
    <template #subtitle>
      <span v-if="rows.length > 0" data-testid="ft-notice">{{ COPY.notice }}</span>
    </template>
    <DsStateView
      :status="status"
      :error="COPY.loadFailed"
      skeleton="list"
      @retry="reload"
    >
      <DsPanel v-if="rows.length === 0" data-testid="ft-empty">
        <DsEmptyState :title="COPY.empty" icon="toggle-left" />
      </DsPanel>
      <DsStack v-else gap="lg">
        <DsPanel v-for="g in groups" :key="g.audience" as="section" :data-testid="`ft-group-${g.audience}`">
          <DsStack gap="md">
            <DsHeading :level="2">{{ g.label }}</DsHeading>
            <DsGrid :cols="{ base: 1, xl: 2 }" gap="sm" :equal-height="false">
              <DsCluster
                v-for="row in g.items"
                :key="row.key"
                justify="start"
                gap="lg"
                align="center"
                :data-testid="`ft-row-${row.key}`"
              >
                <DsSwitchField
                  :key="`${row.key}-${redraw[row.key] ?? 0}`"
                  :model-value="row.enabled"
                  :label="row.labelMs"
                  :name="row.key"
                  :disabled="row.locked || pending[row.key] === true"
                  :loading="pending[row.key] === true"
                  color="success"
                  @update:model-value="(v: boolean) => toggle(row, v)"
                />
                <DsText
                  variant="label"
                  :tone="stateWord(row) === COPY.on ? 'success' : 'muted'"
                  as="span"
                  :data-testid="`ft-state-${row.key}`"
                >
                  {{ stateWord(row) }}
                </DsText>
              </DsCluster>
            </DsGrid>
          </DsStack>
        </DsPanel>
      </DsStack>
    </DsStateView>
  </DsPage>
</template>
