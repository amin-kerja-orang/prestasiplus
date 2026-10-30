<script setup lang="ts">
/**
 * K2b: add one evidence item (design 4.5). There is deliberately no "copy from the contract"
 * button (D-4): the values must be typed as printed on the real paper. The contract has no edit
 * route, so "Edit" opens this drawer prefilled and the page replaces the old item with the new one.
 */
import type { BijakEvidenceInput, BijakEvidenceItem } from '@pp/contract'
import { reactive, ref, watch } from 'vue'

import { DsFormField } from '@/ds'

import { KIND_LABEL } from '../domain/verify'
import NumField from './NumField.vue'
import SidePanel from './SidePanel.vue'

interface Row {
  label: string
  markBudget: number | null
  ruleType: 'all' | 'choose'
  n: number | null
  questionCount: number | null
}

const props = defineProps<{ editing: BijakEvidenceItem | null; saving: boolean; error: string }>()
const emit = defineEmits<{ save: [body: BijakEvidenceInput] }>()
const open = defineModel<boolean>('open', { default: false })

const thisYear = new Date().getFullYear()
const form = reactive<{
  kind: BijakEvidenceInput['kind']
  body: string
  year: number | null
  paperCode: string
  durationMin: number | null
  totalMarks: number | null
  note: string
  rows: Row[]
}>({
  kind: 'trial_paper',
  body: '',
  year: thisYear,
  paperCode: '',
  durationMin: null,
  totalMarks: null,
  note: '',
  rows: [],
})
const errors = ref<Record<string, string>>({})

const KINDS = (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))
const RULES = [
  { value: 'all', label: 'Semua' },
  { value: 'choose', label: 'N daripada M' },
]

watch(open, (o) => {
  if (!o) return
  errors.value = {}
  const e = props.editing
  form.kind = e?.kind ?? 'trial_paper'
  form.body = e?.body ?? ''
  form.year = e?.year ?? thisYear
  form.paperCode = e?.paperCode ?? ''
  form.durationMin = e?.values.durationMin ?? null
  form.totalMarks = e?.values.totalMarks ?? null
  form.note = e?.note ?? ''
  form.rows = (e?.values.sections ?? []).map((s) => ({
    label: s.label ?? '',
    markBudget: s.markBudget ?? null,
    ruleType: s.rule?.type ?? 'all',
    n: s.rule?.type === 'choose' ? s.rule.n : null,
    questionCount: s.questionCount ?? null,
  }))
})

const normBody = (b: string): string => b.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function submit(): void {
  const err: Record<string, string> = {}
  const body = normBody(form.body)
  if (!body) err.body = 'Badan penerbit diperlukan.'
  if (form.year === null || form.year < 2000 || form.year > thisYear) err.year = `Tahun mesti antara 2000 dan ${thisYear}.`
  if (!form.paperCode.trim()) err.paperCode = 'Kod kertas diperlukan.'
  errors.value = err
  if (Object.keys(err).length) return
  emit('save', {
    kind: form.kind,
    body,
    year: form.year as number,
    paperCode: form.paperCode.trim(),
    note: form.note.trim() ? form.note.trim() : null,
    values: {
      ...(form.durationMin !== null ? { durationMin: form.durationMin } : {}),
      ...(form.totalMarks !== null ? { totalMarks: form.totalMarks } : {}),
      ...(form.rows.length
        ? {
            sections: form.rows.map((r, i) => ({
              position: i + 1,
              ...(r.label.trim() ? { label: r.label.trim() } : {}),
              ...(r.markBudget !== null ? { markBudget: r.markBudget } : {}),
              ...(r.ruleType === 'all' ? { rule: { type: 'all' as const } } : r.n !== null ? { rule: { type: 'choose' as const, n: r.n } } : {}),
              ...(r.questionCount !== null ? { questionCount: r.questionCount } : {}),
            })),
          }
        : {}),
    },
  })
}

function addRow(): void {
  form.rows.push({ label: `Bahagian ${String.fromCharCode(65 + form.rows.length)}`, markBudget: null, ruleType: 'all', n: null, questionCount: null })
}
</script>

<template>
  <SidePanel
    v-model:open="open"
    :title="editing ? 'Edit Bukti' : 'Tambah Bukti'"
    description="Isi nilai seperti yang dicetak pada kertas sebenar, bukan daripada kontrak ini."
    :dismissible="!saving"
  >
    <form id="evidence-form" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <fieldset class="min-w-0">
        <legend class="mb-2 text-label text-default">Jenis bukti</legend>
        <URadioGroup v-model="form.kind" :items="KINDS" :ui="{ item: 'min-h-11' }" data-testid="evidence-kind" />
      </fieldset>
      <DsFormField native for="ev-body" label="Badan penerbit" required :error="errors.body" hint="Contoh: SBP, Selangor MPSM.">
        <template #default="f">
          <UInput :id="f.id" v-model="form.body" list="ev-bodies" class="w-full" :ui="{ base: 'min-h-11' }" :aria-invalid="f.invalid" />
          <datalist id="ev-bodies">
            <option value="SBP" />
            <option value="Selangor MPSM" />
            <option value="MRSM" />
            <option value="LPM" />
          </datalist>
        </template>
      </DsFormField>
      <div class="grid grid-cols-2 gap-3">
        <DsFormField native for="ev-year" label="Tahun" required :error="errors.year">
          <template #default="f"><NumField :id="f.id" v-model="form.year" :min="2000" :max="thisYear" :invalid="f.invalid" /></template>
        </DsFormField>
        <DsFormField native for="ev-code" label="Kod kertas" required :error="errors.paperCode">
          <template #default="f">
            <UInput :id="f.id" v-model="form.paperCode" class="w-full" :ui="{ base: 'min-h-11' }" :aria-invalid="f.invalid" />
          </template>
        </DsFormField>
        <DsFormField native for="ev-duration" label="Tempoh dibaca (minit)">
          <template #default="f"><NumField :id="f.id" v-model="form.durationMin" :min="1" /></template>
        </DsFormField>
        <DsFormField native for="ev-total" label="Jumlah markah dibaca">
          <template #default="f"><NumField :id="f.id" v-model="form.totalMarks" /></template>
        </DsFormField>
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="ev-sections">
        <h3 id="ev-sections" class="text-label text-default">Nilai setiap Bahagian</h3>
        <p v-if="!form.rows.length" class="text-caption text-muted">Tiada Bahagian. Tambah jika dibaca daripada kertas.</p>
        <div v-for="(r, i) in form.rows" :key="i" class="grid grid-cols-2 gap-3 rounded-md bg-elevated p-3">
          <DsFormField native :for="`ev-s${i}-label`" label="Label">
            <template #default="f"><UInput :id="f.id" v-model="r.label" class="w-full" :ui="{ base: 'min-h-11' }" /></template>
          </DsFormField>
          <DsFormField native :for="`ev-s${i}-marks`" label="Markah">
            <template #default="f"><NumField :id="f.id" v-model="r.markBudget" /></template>
          </DsFormField>
          <DsFormField native :for="`ev-s${i}-q`" label="Bilangan soalan">
            <template #default="f"><NumField :id="f.id" v-model="r.questionCount" /></template>
          </DsFormField>
          <fieldset class="min-w-0">
            <legend class="mb-1 text-label text-default">Peraturan</legend>
            <URadioGroup v-model="r.ruleType" :items="RULES" size="sm" :ui="{ item: 'min-h-11' }" />
            <NumField v-if="r.ruleType === 'choose'" v-model="r.n" :min="1" aria-label="Jawab (N)" placeholder="N" />
          </fieldset>
          <div class="col-span-2">
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              class="min-h-11"
              icon="i-ph-trash"
              :label="`Buang ${r.label || `Bahagian ${i + 1}`}`"
              @click="form.rows.splice(i, 1)"
            />
          </div>
        </div>
        <UButton color="neutral" variant="soft" class="min-h-11 self-start" icon="i-ph-plus" label="Tambah Bahagian" @click="addRow" />
      </section>

      <DsFormField native for="ev-note" label="Nota">
        <template #default="f"><UTextarea :id="f.id" v-model="form.note" :rows="2" class="w-full" /></template>
      </DsFormField>
      <p v-if="error" class="flex items-start gap-1 text-caption text-error" role="alert" data-testid="evidence-error">
        <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{{ error }}</span>
      </p>
    </form>
    <template #footer>
      <UButton color="neutral" variant="soft" class="min-h-11" label="Batal" :disabled="saving" @click="open = false" />
      <UButton type="submit" form="evidence-form" class="min-h-11" :loading="saving" :label="saving ? 'Menyimpan...' : 'Simpan Bukti'" data-testid="evidence-save" />
    </template>
  </SidePanel>
</template>
