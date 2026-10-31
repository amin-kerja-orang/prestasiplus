<script setup lang="ts">
/**
 * Unit and SP of the question (Langkah 4 "Tag & pengelasan", ADR-0031): both are chosen from the DSKP tree of the subject and
 * level, never typed (AC-03.4). A unit may be chosen without an SP while drafting; approval needs 1 to 3 SP. TP and the
 * cognitive level are per leaf part (Langkah 3).
 */
import { computed, ref, watch } from 'vue'

import { DsFormField, DsNativeSelect, DsStack, DsText } from '@/ds'

import { fetchStudioDskp, type StudioDskp } from '../../api/studio'
import { MAX_SP, toggleSp } from '../../lib/studio/dskp-tags'
import { LOAD_ERROR } from '../../lib/ui-errors'

const props = defineProps<{ subjectId: string; levelId: string; disabled?: boolean; error?: string | undefined }>()
const unitId = defineModel<string | null>('unitId', { required: true })
const spIds = defineModel<string[]>('spIds', { required: true })

const dskp = ref<StudioDskp | null>(null)
const failed = ref(false)
let seq = 0

async function load(): Promise<void> {
  const token = ++seq
  failed.value = false
  if (props.subjectId === '' || props.levelId === '') {
    dskp.value = null
    return
  }
  try {
    const res = await fetchStudioDskp(props.subjectId, props.levelId)
    if (token === seq) dskp.value = res
  } catch {
    if (token === seq) {
      dskp.value = null
      failed.value = true
    }
  }
}
// The first load keeps a saved choice; a later change of subject or level clears it (a unit belongs to one pair).
void load()
watch(
  () => [props.subjectId, props.levelId] as const,
  (_now, before) => {
    if (before[0] !== '' || before[1] !== '') {
      unitId.value = null
      spIds.value = []
    }
    void load()
  },
)

const unit = computed(() => dskp.value?.units.find((u) => u.id === unitId.value) ?? null)
function chooseUnit(value: string): void {
  unitId.value = value === '' ? null : value
  spIds.value = []
}
const full = computed(() => spIds.value.length >= MAX_SP)
</script>

<template>
  <DsStack gap="md" data-testid="studio-dskp">
    <DsText v-if="failed" variant="body" tone="error" role="alert" data-testid="studio-dskp-error">{{ LOAD_ERROR }}</DsText>
    <DsFormField v-slot="{ id }" native label="Unit DSKP" for="studio-unit" hint="Topik menentukan unit DSKP soalan ini." :error="error">
      <DsNativeSelect
        :id="id"
        :model-value="unitId ?? ''"
        placeholder="Pilih unit"
        :disabled="disabled || subjectId === '' || levelId === ''"
        data-testid="studio-unit"
        @update:model-value="chooseUnit(String($event))"
      >
        <option v-for="u in dskp?.units ?? []" :key="u.id" :value="u.id">{{ u.code }} {{ u.title }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsStack v-if="unit" gap="xs" data-testid="studio-sp">
      <DsText variant="label">SP DSKP (1 hingga 3)</DsText>
      <UCheckbox
        v-for="sp in unit.sps"
        :key="sp.id"
        :model-value="spIds.includes(sp.id)"
        :label="`${sp.code} ${sp.title}`"
        :disabled="disabled || (full && !spIds.includes(sp.id))"
        :data-testid="`studio-sp-${sp.id}`"
        @update:model-value="spIds = toggleSp(spIds, sp.id)"
      />
      <DsText v-if="unit.sps.length === 0" variant="body" tone="muted">Unit ini tiada SP dalam data DSKP.</DsText>
    </DsStack>
  </DsStack>
</template>
