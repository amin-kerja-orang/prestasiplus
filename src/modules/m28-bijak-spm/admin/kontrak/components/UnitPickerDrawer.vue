<script setup lang="ts">
/**
 * K2a: DSKP unit picker (design 4.4). Multi-select checkboxes grouped by Tingkatan; units already
 * in the quota are listed with the visible words "Sudah ada" and cannot be chosen twice.
 */
import type { BijakUnitRefView } from '@pp/contract'
import { computed, ref, watch } from 'vue'

import { DsEmptyState, DsLoadError } from '@/ds'

import { unitKey, unitLabel } from '../domain/form'
import SidePanel from './SidePanel.vue'

const props = defineProps<{
  subject: string
  taken: readonly string[]
  load: (subject: string) => Promise<BijakUnitRefView[]>
}>()
const emit = defineEmits<{ add: [units: BijakUnitRefView[]] }>()
const open = defineModel<boolean>('open', { default: false })

const units = ref<BijakUnitRefView[]>([])
const status = ref<'loading' | 'error' | 'ready'>('loading')
const errorText = ref('')
const q = ref('')
const picked = ref<string[]>([])

async function fetchUnits(): Promise<void> {
  status.value = 'loading'
  try {
    units.value = (await props.load(props.subject)).filter((u) => u.kind === 'unit')
    status.value = 'ready'
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Senarai unit tidak dapat dimuatkan.'
    status.value = 'error'
  }
}

watch(open, (o) => {
  if (o) {
    picked.value = []
    q.value = ''
    void fetchUnits()
  }
})

const groups = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const match = (u: BijakUnitRefView): boolean => !needle || unitLabel(u).toLowerCase().includes(needle)
  return (['T4', 'T5'] as const)
    .map((level) => ({
      level,
      title: level === 'T4' ? 'Tingkatan 4' : 'Tingkatan 5',
      items: units.value.filter((u) => u.kind === 'unit' && u.level === level && match(u)),
    }))
    .filter((g) => g.items.length)
})

function toggle(u: BijakUnitRefView, on: boolean): void {
  const k = unitKey(u)
  picked.value = on ? [...picked.value, k] : picked.value.filter((x) => x !== k)
}

function confirm(): void {
  const chosen = units.value.filter((u) => picked.value.includes(unitKey(u)))
  emit('add', chosen)
  open.value = false
}
</script>

<template>
  <SidePanel v-model:open="open" title="Tambah Unit DSKP" description="Pilih satu atau lebih unit untuk kuota topik.">
    <div class="flex flex-col gap-4" data-testid="unit-picker">
      <UInput
        v-model="q"
        icon="i-ph-magnifying-glass"
        placeholder="Cari unit atau kod..."
        aria-label="Cari unit atau kod"
        class="w-full"
      />
      <div v-if="status === 'loading'" role="status" aria-busy="true" class="text-caption text-muted">
        Memuatkan...
      </div>
      <DsLoadError v-else-if="status === 'error'" :message="errorText" @retry="fetchUnits" />
      <DsEmptyState
        v-else-if="!groups.length"
        size="sm"
        title="Tiada unit dijumpai."
        description="Gunakan baldi T1-T3, luar DSKP atau hubungi pentadbir."
      />
      <section v-for="g in status === 'ready' ? groups : []" :key="g.level">
        <h3 class="mb-1 text-label text-highlighted">{{ g.title }}</h3>
        <ul class="flex flex-col">
          <li v-for="u in g.items" :key="unitKey(u)" class="min-h-11">
            <UCheckbox
              :model-value="picked.includes(unitKey(u)) || taken.includes(unitKey(u))"
              :disabled="taken.includes(unitKey(u))"
              :label="unitLabel(u)"
              :description="taken.includes(unitKey(u)) ? 'Sudah ada' : undefined"
              :data-testid="`unit-${unitKey(u)}`"
              @update:model-value="(v: boolean | 'indeterminate') => toggle(u, v === true)"
            />
          </li>
        </ul>
      </section>
    </div>
    <template #footer>
      <span class="me-auto text-caption text-muted" role="status">{{ picked.length }} dipilih</span>
      <UButton color="neutral" variant="soft" class="min-h-11" label="Batal" @click="open = false" />
      <UButton
        class="min-h-11"
        :label="`Tambah ${picked.length} unit`"
        :disabled="!picked.length"
        data-testid="unit-add"
        @click="confirm"
      />
    </template>
  </SidePanel>
</template>
