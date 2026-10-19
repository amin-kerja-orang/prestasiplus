<script setup lang="ts">
/**
 * S12 Auto-Setup dialog (FR-M08-77…80, BR-M08-21). Opening resets the selection; "Batal", the scrim and
 * Esc only hide it (the ticks stay until the next opening). The submit is disabled until a level is ticked;
 * on success the dialog closes and the page reloads its list without a message (PROPOSED, UNVERIFIED L-4).
 */
import { computed, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { DsDialog, DsStack, DsGrid } from '@/ds'

import { autoSetupHeadcounts } from '../../api/headcount'
import { DARJAH_LEVELS, TINGKATAN_LEVELS } from '../../lib/headcount/format'
import { LOAD_ERROR } from '../../lib/prestasi/load'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const selected = ref<(number | string)[]>([])
const submitting = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    selected.value = []
    error.value = null
  }
})

const count = computed(() => selected.value.length)

function toggle(value: number | string, on: boolean | 'indeterminate'): void {
  const rest = selected.value.filter((v) => v !== value)
  selected.value = on === true ? [...rest, value] : rest
}

async function submit() {
  if (count.value === 0 || submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await autoSetupHeadcounts({ levels: [...selected.value] })
    open.value = false
    emit('done')
  } catch (err) {
    error.value = isApiError(err) && err.message !== '' ? err.message : LOAD_ERROR
  } finally {
    submitting.value = false
  }
}

const groups = [
  { title: 'Darjah', levels: DARJAH_LEVELS },
  { title: 'Tingkatan', levels: TINGKATAN_LEVELS },
] as const
</script>

<template>
  <DsDialog
    v-model:open="open"
    title="Auto-Setup Headcount"
    description="Pilih tingkatan untuk auto-cipta headcount"
  >
    <DsStack as="form" data-testid="auto-setup-modal" @submit.prevent="submit">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :title="error"
      />
      <DsStack v-for="g in groups" :key="g.title" as="fieldset" gap="xs">
        <legend class="mb-2 text-label text-highlighted">{{ g.title }}</legend>
        <DsGrid :cols="3" gap="xs">
          <UCheckbox
            v-for="l in g.levels"
            :key="l.label"
            variant="card"
            :label="l.label"
            :model-value="selected.includes(l.value)"
            :data-testid="`level-${l.label}`"
            @update:model-value="toggle(l.value, $event)"
          />
        </DsGrid>
      </DsStack>
    </DsStack>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        label="Batal"
        data-testid="auto-setup-cancel"
        @click="open = false"
      />
      <UButton
        type="button"
        icon="i-ph-magic-wand"
        :disabled="count === 0"
        :loading="submitting"
        data-testid="auto-setup-submit"
        @click="submit"
      >
        Auto-Setup<template v-if="count > 0"> ({{ count }})</template>
      </UButton>
    </template>
  </DsDialog>
</template>
