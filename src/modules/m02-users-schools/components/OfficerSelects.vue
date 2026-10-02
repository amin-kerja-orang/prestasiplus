<script setup lang="ts">
/**
 * S2 officer selects (FR-M02-32, FR-M02-33): "Negeri (JPN) *" for `ppd_officer` / `jpn_officer` and "PPD *"
 * for `ppd_officer` only. The JPN list is loaded once by the page (on failure the select keeps only its
 * first option). Choosing a JPN loads its PPDs into "PPD *", which is disabled while no JPN is chosen and
 * while loading. `state` = the chosen JPN's name and `district` = the chosen PPD's code (the hidden
 * `ppd_state` / `ppd_district`). Two root elements: the page places them in its field grid.
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { fetchPpdList, type Jpn, type Ppd } from '../api/schools'
import { FORM_INPUT_CLASS } from '@/components/form'

const state = defineModel<string>('state', { required: true })
const district = defineModel<string>('district', { required: true })

const props = defineProps<{
  role: 'ppd_officer' | 'jpn_officer'
  jpns: readonly Jpn[]
}>()

const jpnId = ref('')
const ppds = ref<Ppd[]>([])
const loading = ref(false)
let controller: AbortController | null = null
let seq = 0

const needsPpd = computed(() => props.role === 'ppd_officer')

async function onJpnChange(): Promise<void> {
  controller?.abort()
  ppds.value = []
  district.value = ''
  const jpn = props.jpns.find((j) => String(j.id) === jpnId.value)
  state.value = jpn?.name ?? ''
  if (!jpn || !needsPpd.value) {
    loading.value = false
    return
  }
  const current = new AbortController()
  controller = current
  const id = ++seq
  loading.value = true
  try {
    const rows = await fetchPpdList(jpn.id, { signal: current.signal })
    if (id === seq) ppds.value = rows
  } catch (err) {
    if (id === seq && !current.signal.aborted) console.error('PPD load error:', err)
  } finally {
    if (id === seq) loading.value = false
  }
}

onBeforeUnmount(() => {
  seq += 1
  controller?.abort()
})

const SELECT = `${FORM_INPUT_CLASS} min-h-11 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`
</script>

<template>
  <div>
    <label for="officer-jpn" class="mb-1.5 block text-sm font-semibold text-slate-700">
      Negeri (JPN) <span class="text-red-500">*</span>
    </label>
    <select
      id="officer-jpn"
      v-model="jpnId"
      :class="SELECT"
      data-testid="officer-jpn"
      @change="onJpnChange"
    >
      <option value="">-- Pilih Negeri --</option>
      <option v-for="jpn in jpns" :key="jpn.id" :value="String(jpn.id)">{{ jpn.name }}</option>
    </select>
  </div>
  <div v-if="needsPpd">
    <label for="officer-ppd" class="mb-1.5 block text-sm font-semibold text-slate-700">
      PPD <span class="text-red-500">*</span>
    </label>
    <select
      id="officer-ppd"
      v-model="district"
      :disabled="jpnId === '' || loading"
      :class="SELECT"
      data-testid="officer-ppd"
    >
      <option value="">-- Pilih PPD --</option>
      <option v-for="ppd in ppds" :key="ppd.id" :value="ppd.code">{{ ppd.name }}</option>
    </select>
  </div>
</template>
