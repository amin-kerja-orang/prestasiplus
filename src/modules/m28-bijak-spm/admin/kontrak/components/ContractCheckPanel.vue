<script setup lang="ts">
/**
 * "Semakan Kontrak" (design 4.7): the live sums, the Bahagian x part matrix (icon plus word) and
 * the problem lists. Every item is a link that switches tab and focuses the field. Below `xl` it is
 * a collapsible block above the tab content (open when there are errors).
 */
import { computed, ref, watch } from 'vue'

import { DsPanel } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import type { ContractForm } from '../domain/form'
import {
  errorsOf,
  incompleteOf,
  sectionStatus,
  type Issue,
} from '../domain/validate'
import SumMeter from './SumMeter.vue'

const props = defineProps<{ form: ContractForm; issues: readonly Issue[] }>()
const emit = defineEmits<{ goto: [issue: Issue] }>()

const wide = useMedia('(min-width: 1280px)', true)
const errors = computed(() => errorsOf(props.issues))
const incomplete = computed(() => incompleteOf(props.issues))
const warnings = computed(() => props.issues.filter((i) => i.level === 'warning'))
const problemCount = computed(() => errors.value.length + incomplete.value.length)
const open = ref(errors.value.length > 0)
watch(
  () => errors.value.length,
  (n, o) => {
    if (n > 0 && o === 0) open.value = true
  },
)
const shown = computed(() => wide.value || open.value)

const budgetSum = computed(() => props.form.sections.reduce((n, s) => n + (s.markBudget ?? 0), 0))
const COLS = [
  { key: 'struktur', label: 'Struktur' },
  { key: 'profil', label: 'Profil' },
  { key: 'kuota', label: 'Kuota topik' },
  { key: 'kbat', label: 'KBAT' },
] as const
const WORD = { ok: 'Lengkap', error: 'Ralat', incomplete: 'Belum' } as const
const ICON = {
  ok: 'i-ph-check-circle',
  error: 'i-ph-warning-circle',
  incomplete: 'i-ph-minus-circle',
} as const
const TONE = { ok: 'text-success', error: 'text-error', incomplete: 'text-warning' } as const

const title = computed(() => (wide.value ? 'Semakan Kontrak' : `Semakan Kontrak - ${problemCount.value} masalah`))
</script>

<template>
  <DsPanel :title="title" data-testid="contract-check">
    <template v-if="!wide" #actions>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        class="min-h-11"
        :icon="open ? 'i-ph-caret-up' : 'i-ph-caret-down'"
        :label="open ? 'Tutup' : 'Buka'"
        :aria-expanded="open"
        aria-controls="contract-check-body"
        data-testid="check-toggle"
        @click="open = !open"
      />
    </template>
    <div v-show="shown" id="contract-check-body" class="flex min-w-0 flex-col gap-4">
      <SumMeter
        label="Markah bahagian (selepas pilih N)"
        :value="budgetSum"
        :target="form.totalMarks"
        unit="markah"
      />

      <div class="overflow-x-auto">
        <table class="w-full text-caption" data-testid="check-matrix">
          <caption class="sr-only">
            Status setiap Bahagian
          </caption>
          <thead>
            <tr class="text-start text-muted">
              <th scope="col" class="py-1 pe-2 text-start font-medium">Bahagian</th>
              <th v-for="c in COLS" :key="c.key" scope="col" class="px-1 py-1 text-start font-medium">
                {{ c.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in form.sections" :key="s.uid">
              <th scope="row" class="py-1 pe-2 text-start font-medium break-words">
                {{ s.label || `Bahagian ${i + 1}` }}
              </th>
              <td v-for="c in COLS" :key="c.key" class="px-1 py-1">
                <span
                  class="inline-flex items-center gap-1"
                  :class="TONE[sectionStatus(issues, i)[c.key]]"
                  :data-testid="`matrix-${i}-${c.key}`"
                >
                  <UIcon :name="ICON[sectionStatus(issues, i)[c.key]]" class="size-4 shrink-0" aria-hidden="true" />
                  <span>{{ WORD[sectionStatus(issues, i)[c.key]] }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-if="errors.length" aria-labelledby="check-errors">
        <h3 id="check-errors" class="text-label text-highlighted">Ralat ({{ errors.length }})</h3>
        <ul class="mt-1 flex flex-col gap-1" data-testid="check-errors">
          <li v-for="e in errors" :key="e.id">
            <UButton
              variant="link"
              color="error"
              class="h-auto min-h-11 justify-start p-0 text-start text-caption whitespace-normal"
              icon="i-ph-warning-circle"
              :label="e.message"
              @click="emit('goto', e)"
            />
          </li>
        </ul>
      </section>

      <section v-if="incomplete.length" aria-labelledby="check-incomplete">
        <h3 id="check-incomplete" class="text-label text-highlighted">
          Belum lengkap untuk Disahkan ({{ incomplete.length }})
        </h3>
        <ul class="mt-1 flex flex-col gap-1" data-testid="check-incomplete">
          <li v-for="e in incomplete" :key="e.id">
            <UButton
              variant="link"
              color="warning"
              class="h-auto min-h-11 justify-start p-0 text-start text-caption whitespace-normal"
              icon="i-ph-minus-circle"
              :label="e.message"
              @click="emit('goto', e)"
            />
          </li>
        </ul>
      </section>

      <section v-if="warnings.length" aria-labelledby="check-warn">
        <h3 id="check-warn" class="text-label text-highlighted">Amaran ({{ warnings.length }})</h3>
        <ul class="mt-1 flex flex-col gap-1">
          <li v-for="e in warnings" :key="e.id" class="flex items-start gap-1 text-caption text-muted">
            <UIcon name="i-ph-info" class="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{{ e.message }}</span>
          </li>
        </ul>
      </section>

      <UAlert
        v-if="!errors.length"
        color="success"
        variant="subtle"
        icon="i-ph-check-circle"
        title="Tiada ralat. Kontrak boleh disimpan."
        data-testid="check-ok"
      />
    </div>
  </DsPanel>
</template>
