<script setup lang="ts">
/**
 * S15 `/target-spm` "Target SPM Saya — PrestasiPlus" (M05-T7; FR-M05-117…121, BR-22, BR-26, BR-27,
 * DV-M05-12).
 *
 * - Card "Target Gred SPM" with "Simpan" and the 20 subject rows of #18: name, status line, progress
 *   track, predicted grade and the grade select (`targets[{id}]`). Progress exists only from the test
 *   fixture (BR-27); otherwise "Belum mula", an empty track and "-".
 * - "Simpan" sends all 20 values (#19), reloads the rows and shows the success flash (the server
 *   `status`); on error the choices are kept and the red flash shows (§8.3 UNVERIFIED COPY).
 * - Below 640 px each row wraps: name + status, grade, select; then the bar at full width (DV-M05-12).
 */
import { computed, reactive, ref, watch } from 'vue'

import { useApi } from '@/composables'
import { DsLoadError, DsNativeSelect, DsPage, DsPanel, DsStack, DsCluster, DsText } from '@/ds'

import { fetchSpmTargets, saveSpmTargets } from '../api/practice'
import type { SpmGrade } from '../api/types'
import {
  bandColor,
  SAVE_ERROR,
  SPM_GRADES,
  targetBarWidth,
  targetStatus,
} from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const GRADE_ITEMS = SPM_GRADES.map((g) => ({ value: g, label: g }))

const { data, error, reload } = useApi((signal) => fetchSpmTargets({ signal }))
const rows = computed(() => data.value?.subjects ?? [])

const chosen = reactive<Record<number, SpmGrade | ''>>({})
watch(
  data,
  (d) => {
    if (!d) return
    for (const r of d.subjects) chosen[r.id] = r.target ?? ''
  },
  { immediate: true },
)

const saving = ref(false)
const success = ref<string | null>(null)
const failure = ref<string | null>(null)

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  success.value = null
  failure.value = null
  try {
    const targets: Record<number, SpmGrade | ''> = {}
    for (const r of rows.value) targets[r.id] = chosen[r.id] ?? ''
    const res = await saveSpmTargets(targets)
    success.value = res.status
  } catch {
    failure.value = SAVE_ERROR
    saving.value = false
    return
  }
  // A failed reload is not a failed save: the rows simply keep the chosen values.
  try {
    await reload()
  } catch {
    /* keep the page as it is */
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage title="Target SPM Saya" data-testid="targets-page">
    <UAlert
      v-if="success"
      color="success"
      variant="subtle"
      icon="i-ph-check-circle"
      :title="success"
      data-testid="targets-success"
    />
    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      :title="failure"
      data-testid="targets-failure"
    />

    <DsPanel
      v-if="data"
      as="form"
      title="Target Gred SPM"
      description="Pilih target gred untuk setiap subjek. Sistem akan tunjuk kemajuan anda."
      icon="i-ph-target-duotone"
      data-testid="targets-form"
      @submit.prevent="save"
    >
      <template #actions>
        <UButton
          type="submit"
          size="lg"
          icon="i-ph-floppy-disk"
          class="min-h-11"
          :loading="saving"
          data-testid="targets-save"
          >Simpan</UButton
        >
      </template>

      <DsStack as="ul" gap="xs">
        <li v-for="r in rows" :key="r.id" class="min-w-0">
          <DsPanel
            tone="inset"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap"
            :data-testid="`target-row-${String(r.id)}`"
          >
            <div class="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <DsText
                variant="label"
                as="p"
                tone="highlighted"
                wrap="anywhere"
                data-testid="target-name"
              >
                {{ r.name }}
              </DsText>
              <DsText variant="caption" data-testid="target-status">
                {{ targetStatus(r) }}
              </DsText>
            </div>
            <div
              class="order-last basis-full sm:order-none sm:flex-1 sm:basis-auto"
              data-testid="target-track"
            >
              <UProgress
                v-if="r.band"
                :model-value="targetBarWidth(r)"
                :max="100"
                :color="bandColor(r.band)"
                :aria-label="r.name"
                :data-value="targetBarWidth(r)"
                data-testid="target-bar"
              />
              <UProgress v-else :model-value="0" :max="100" :aria-label="r.name" />
            </div>
            <span
              class="tabular w-8 text-center text-label"
              :class="r.predictedGrade ? 'text-highlighted' : 'text-dimmed'"
              data-testid="target-predicted"
              >{{ r.predictedGrade ?? '-' }}</span
            >
            <DsNativeSelect
              v-model="chosen[r.id]"
              :name="`targets[${String(r.id)}]`"
              :items="GRADE_ITEMS"
              placeholder="Target"
              :aria-label="r.name"
              class="w-28 shrink-0"
              data-testid="target-select"
            />
          </DsPanel>
        </li>
      </DsStack>
    </DsPanel>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      testid="targets-error"
      retry-testid="targets-retry"
      @retry="reload()"
    />

    <DsPanel v-if="data" data-testid="targets-legend">
      <DsCluster gap="xs" align="stretch">
        <UBadge color="success" variant="subtle">70%+ Ketepatan (On Track)</UBadge>
        <UBadge color="warning" variant="subtle">50-69% (Perlu Usaha)</UBadge>
        <UBadge color="error" variant="subtle">&lt;50% (Perlu Fokus)</UBadge>
      </DsCluster>
      <p class="mt-3 flex items-start gap-2 text-caption text-primary-t sm:justify-end">
        <UIcon name="i-ph-lightbulb" class="mt-1 size-4 shrink-0" />
        Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat
      </p>
    </DsPanel>
  </DsPage>
</template>
