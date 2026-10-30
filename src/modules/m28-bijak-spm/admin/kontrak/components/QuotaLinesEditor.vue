<script setup lang="ts">
/**
 * Kuota topik (JSU) of one Bahagian (design 4.3 c, US-36): the counting basis, one exact value per
 * DSKP unit, the live sum against the offered amount and the derived T4 : T5 split. Lines that the
 * server seeded and nobody has confirmed carry "Belum disemak" (AC-39.9).
 */
import type { BijakUnitRefView } from '@pp/contract'
import { computed, nextTick, ref } from 'vue'

import { DsFormField } from '@/ds'

import { unitKey, unitLabel, type FormSection } from '../domain/form'
import { derivedShare, fieldId, quotaSum, type Issue } from '../domain/validate'
import NumField from './NumField.vue'
import SumMeter from './SumMeter.vue'
import UnitPickerDrawer from './UnitPickerDrawer.vue'

const props = defineProps<{
  index: number
  subject: string
  issues: readonly Issue[]
  loadUnits: (subject: string) => Promise<BijakUnitRefView[]>
}>()
const s = defineModel<FormSection>({ required: true })

const picker = ref(false)
const sum = computed(() => quotaSum(s.value))
const share = computed(() => derivedShare(s.value))
const taken = computed(() => s.value.quotaLines.map((l) => unitKey(l.unit)))
const hasBucket = computed(() => taken.value.includes('t1_t3'))
const shareOpen = ref(s.value.levelShare.t4 !== null || s.value.levelShare.t5 !== null)

const basisItems = [
  { value: 'questions', label: 'Soalan' },
  { value: 'marks', label: 'Markah' },
]
const unitText = computed(() => (s.value.quotaBasis === 'questions' ? 'soalan' : 'markah'))

const errAt = (name: string): string | undefined =>
  props.issues.find((i) => i.level === 'error' && i.target === fieldId(props.index, name))?.message
const blockErrors = computed(() =>
  props.issues.filter(
    (i) => i.level === 'error' && i.section === props.index && i.part === 'kuota' && !i.target.includes('-q-'),
  ),
)

function addUnits(units: BijakUnitRefView[]): void {
  for (const u of units) s.value.quotaLines.push({ unit: u, value: null, reviewed: true })
  void nextTick(() => {
    const first = units[0]
    if (first) document.getElementById(fieldId(props.index, `q-${unitKey(first)}`))?.focus()
  })
}
function addBucket(): void {
  if (hasBucket.value) return
  s.value.quotaLines.push({ unit: { kind: 't1_t3' }, value: 0, reviewed: true })
}
async function removeLine(i: number): Promise<void> {
  s.value.quotaLines.splice(i, 1)
  await nextTick()
  const next = s.value.quotaLines[Math.min(i, s.value.quotaLines.length - 1)]
  const el = next
    ? document.getElementById(fieldId(props.index, `q-${unitKey(next.unit)}`))
    : document.getElementById(fieldId(props.index, 'add-unit'))
  el?.focus()
}
// Pinned order: the T1-T3 bucket is always last.
const lines = computed(() =>
  s.value.quotaLines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => Number(a.l.unit.kind === 't1_t3') - Number(b.l.unit.kind === 't1_t3')),
)
const level = (u: BijakUnitRefView): string => (u.kind === 't1_t3' ? 'Baldi' : (u.level ?? ''))
</script>

<template>
  <div :id="fieldId(index, 'kuota')" tabindex="-1" class="flex flex-col gap-4">
    <fieldset class="min-w-0">
      <legend class="mb-2 text-label text-default">Kira dalam</legend>
      <URadioGroup
        v-model="s.quotaBasis"
        orientation="horizontal"
        :items="basisItems"
        :ui="{ item: 'min-h-11' }"
        data-testid="quota-basis"
      />
      <p class="mt-1 text-caption text-muted">
        Menukar asas tidak menukar nombor; jumlah sasaran sahaja yang berubah.
      </p>
    </fieldset>

    <p v-if="!s.quotaLines.length" class="text-caption text-muted">Tiada baris kuota.</p>
    <ul v-else class="flex flex-col gap-3" data-testid="quota-lines">
      <li
        v-for="{ l, i } in lines"
        :key="unitKey(l.unit)"
        class="grid min-w-0 grid-cols-1 gap-3 rounded-md bg-elevated p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
        :data-testid="`quota-line-${unitKey(l.unit)}`"
      >
        <div class="min-w-0">
          <h4 class="text-label break-words text-highlighted">{{ unitLabel(l.unit) }}</h4>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="subtle" :label="level(l.unit)" />
            <UBadge
              v-if="!l.reviewed"
              color="warning"
              variant="subtle"
              icon="i-ph-question"
              label="Belum disemak"
              data-testid="unreviewed"
            />
          </div>
        </div>
        <DsFormField
          native
          :for="fieldId(index, `q-${unitKey(l.unit)}`)"
          label="Nilai tepat"
          :error="errAt(`q-${unitKey(l.unit)}`)"
        >
          <template #default="f">
            <NumField :id="f.id" v-model="l.value" :invalid="f.invalid" :describedby="f.describedby" />
          </template>
        </DsFormField>
        <UButton
          color="error"
          variant="ghost"
          class="min-h-11 min-w-11"
          icon="i-ph-trash"
          label="Buang"
          :aria-label="`Buang ${unitLabel(l.unit)}`"
          @click="removeLine(i)"
        />
      </li>
    </ul>

    <div class="flex flex-wrap gap-2">
      <UButton
        :id="fieldId(index, 'add-unit')"
        color="neutral"
        variant="soft"
        class="min-h-11"
        icon="i-ph-plus"
        label="Tambah unit"
        data-testid="add-unit"
        @click="picker = true"
      />
      <UButton
        color="neutral"
        variant="soft"
        class="min-h-11"
        icon="i-ph-plus"
        label="Tambah baldi T1-T3, luar DSKP"
        :disabled="hasBucket"
        @click="addBucket"
      />
      <p v-if="hasBucket" class="self-center text-caption text-muted">Baldi sudah ada.</p>
    </div>
    <p class="text-caption text-muted">Unit tanpa baris tidak akan dipilih untuk bahagian ini.</p>

    <template v-if="s.quotaLines.length">
      <SumMeter label="Jumlah kuota" :value="sum.sum" :target="sum.target" :unit="unitText" />
      <p v-if="sum.target === null && s.quotaBasis === 'marks'" class="text-caption text-error">
        Tetapkan markah mengikut slot atau kira dalam soalan.
      </p>
      <p class="text-caption text-muted" data-testid="derived-share">
        Nisbah Tingkatan 4 : 5 daripada nilai unit = {{ share.t4 }} : {{ share.t5 }}
      </p>
      <div>
        <UButton
          color="neutral"
          variant="link"
          class="min-h-11 px-0"
          :label="shareOpen ? 'Sembunyikan nisbah ditetapkan' : 'Tetapkan nisbah Tingkatan 4 : 5 (pilihan)'"
          :aria-expanded="shareOpen"
          @click="shareOpen = !shareOpen"
        />
        <div v-show="shareOpen" class="mt-2 grid max-w-sm grid-cols-2 gap-3">
          <DsFormField native :for="fieldId(index, 'nisbah-t4')" label="Tingkatan 4">
            <template #default="f"><NumField :id="f.id" v-model="s.levelShare.t4" /></template>
          </DsFormField>
          <DsFormField native :for="fieldId(index, 'nisbah')" label="Tingkatan 5">
            <template #default="f"><NumField :id="f.id" v-model="s.levelShare.t5" /></template>
          </DsFormField>
        </div>
      </div>
    </template>

    <ul v-if="blockErrors.length" class="flex flex-col gap-1" data-testid="quota-errors">
      <li v-for="e in blockErrors" :key="e.id" class="flex items-start gap-1 text-caption text-error">
        <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{{ e.message }}</span>
      </li>
    </ul>

    <UnitPickerDrawer v-model:open="picker" :subject="subject" :taken="taken" :load="loadUnits" @add="addUnits" />
  </div>
</template>
