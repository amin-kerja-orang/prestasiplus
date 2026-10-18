<script setup lang="ts">
/**
 * S2 filter toolbar (FN-M11-3.2.1..3.2.2; FR-M11-30, 31). A GET form on live: submitting navigates to
 * the mount prefix with `period`, `state`, `tahap` and a dummy `_token` (SEC-M11-01, replicated). One
 * row from `md` (selects, Tapis, Reset); below `md` the selects move into a "Penapis" drawer. Active
 * filters show as chips. The page applies the query; this component owns the select values.
 */
import { computed, ref, watch } from 'vue'

import { useMedia } from '@/ds/useMedia'

import NativeSelect from '../native/NativeSelect.vue'
import type { MonitoringFilterQuery, MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  query: MonitoringFilterQuery
  paths: MonitoringPaths
  formId: string
}>()

const emit = defineEmits<{ apply: [query: MonitoringFilterQuery] }>()

const PERIODS = [
  ['', 'Semua Masa'],
  ['7d', '7 Hari'],
  ['30d', '30 Hari'],
  ['3m', '3 Bulan'],
] as const
const STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Pahang',
  'Perak',
  'Sabah',
  'Selangor',
  'Terengganu',
]
const TAHAPS = ['Cemerlang', 'Sederhana', 'Rendah', 'Kritikal', 'Tiada Langsung']

const wide = useMedia('(min-width: 768px)')
const sheet = ref(false)

const period = ref(props.query.period)
const state = ref(props.query.state)
const tahap = ref(props.query.tahap)
watch(
  () => props.query,
  (q) => {
    period.value = q.period
    state.value = q.state
    tahap.value = q.tahap
  },
)

const chips = computed(() => {
  const out: string[] = []
  const p = PERIODS.find(([v]) => v === props.query.period)
  if (props.query.period !== '') out.push(`Tempoh: ${p ? p[1] : props.query.period}`)
  if (props.query.state !== '') out.push(`Negeri: ${props.query.state}`)
  if (props.query.tahap !== '') out.push(`Tahap: ${props.query.tahap}`)
  return out
})
const hasFilter = computed(() => chips.value.length > 0)

function submit() {
  sheet.value = false
  emit('apply', { period: period.value, state: state.value, tahap: tahap.value })
}

const LABEL = 'text-body font-medium text-muted'
</script>

<template>
  <div class="flex flex-col gap-3">
    <UCard>
      <form
        :id="formId"
        class="flex flex-wrap items-end gap-4"
        role="search"
        data-testid="mon-filters"
        @submit.prevent="submit"
      >
        <template v-if="wide">
          <label class="flex w-48 min-w-0 flex-col gap-2">
            <span :class="LABEL">Tempoh</span>
            <NativeSelect v-model="period" name="period" data-testid="mon-period">
              <option v-for="[value, label] in PERIODS" :key="value" :value="value">
                {{ label }}
              </option>
            </NativeSelect>
          </label>
          <label class="flex w-56 min-w-0 flex-col gap-2">
            <span :class="LABEL">Negeri</span>
            <NativeSelect v-model="state" name="state" data-testid="mon-state">
              <option value="">Semua Negeri</option>
              <option v-for="s in STATES" :key="s" :value="s">{{ s }}</option>
            </NativeSelect>
          </label>
          <label class="flex w-56 min-w-0 flex-col gap-2">
            <span :class="LABEL">Tahap</span>
            <NativeSelect v-model="tahap" name="tahap" data-testid="mon-tahap">
              <option value="">Semua Tahap</option>
              <option v-for="t in TAHAPS" :key="t" :value="t">{{ t }}</option>
            </NativeSelect>
          </label>
          <UButton
            type="submit"
            size="md"
            icon="i-ph-funnel"
            label="Tapis"
            data-testid="mon-apply"
          />
          <UButton
            v-if="hasFilter"
            :to="paths.overview"
            color="neutral"
            variant="ghost"
            size="md"
            icon="i-ph-x"
            label="Reset"
            data-testid="mon-reset"
          />
        </template>
        <template v-else>
          <UChip :show="chips.length > 0" :text="chips.length" color="primary">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              size="md"
              icon="i-ph-funnel"
              label="Penapis"
              data-testid="mon-filter-open"
              @click="sheet = true"
            />
          </UChip>
          <UButton
            v-if="hasFilter"
            :to="paths.overview"
            color="neutral"
            variant="ghost"
            size="md"
            icon="i-ph-x"
            label="Reset"
            data-testid="mon-reset"
          />
          <UDrawer v-model:open="sheet" title="Penapis" description=" ">
            <template #body>
              <div class="flex flex-col gap-4">
                <label class="flex min-w-0 flex-col gap-2">
                  <span :class="LABEL">Tempoh</span>
                  <NativeSelect v-model="period" name="period" data-testid="mon-period">
                    <option v-for="[value, label] in PERIODS" :key="value" :value="value">
                      {{ label }}
                    </option>
                  </NativeSelect>
                </label>
                <label class="flex min-w-0 flex-col gap-2">
                  <span :class="LABEL">Negeri</span>
                  <NativeSelect v-model="state" name="state" data-testid="mon-state">
                    <option value="">Semua Negeri</option>
                    <option v-for="s in STATES" :key="s" :value="s">{{ s }}</option>
                  </NativeSelect>
                </label>
                <label class="flex min-w-0 flex-col gap-2">
                  <span :class="LABEL">Tahap</span>
                  <NativeSelect v-model="tahap" name="tahap" data-testid="mon-tahap">
                    <option value="">Semua Tahap</option>
                    <option v-for="t in TAHAPS" :key="t" :value="t">{{ t }}</option>
                  </NativeSelect>
                </label>
                <UButton
                  type="button"
                  block
                  size="md"
                  label="Tapis"
                  data-testid="mon-apply"
                  @click="submit"
                />
              </div>
            </template>
          </UDrawer>
        </template>
      </form>
    </UCard>
    <ul v-if="hasFilter" class="flex flex-wrap items-center gap-2" data-testid="mon-active-filters">
      <li v-for="c in chips" :key="c">
        <UBadge color="primary" variant="subtle" size="lg" :label="c" />
      </li>
    </ul>
  </div>
</template>
