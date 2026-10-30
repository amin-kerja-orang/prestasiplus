<script setup lang="ts">
/**
 * Tab "Umum" (design 4.2): paper facts, cover instructions, optional paper-level standards, the
 * Bahagian list (add, reorder with buttons, remove) and the danger zone.
 */
import { computed } from 'vue'

import { DsFormField, DsFormSection, DsNativeSelect, useConfirm } from '@/ds'

import { emptySection, questionRange, type ContractForm } from '../domain/form'
import { fieldId, sectionStatus, type Issue } from '../domain/validate'
import NumField from './NumField.vue'
import SourceBadge from './SourceBadge.vue'
import SumMeter from './SumMeter.vue'

const props = defineProps<{
  form: ContractForm
  subjectName: string
  kertas: number
  isNew: boolean
  issues: readonly Issue[]
  retireError: string
  dependentPapers: number
  reference: { title: string; items: string[] }[]
}>()
const emit = defineEmits<{ edit: [index: number]; retire: [] }>()

const MAX = 20
const confirm = useConfirm()
const errAt = (name: string): string | undefined =>
  props.issues.find((i) => i.level === 'error' && i.target === fieldId(null, name))?.message
const budgetSum = computed(() => props.form.sections.reduce((n, s) => n + (s.markBudget ?? 0), 0))
const statusItems = [
  { label: 'Draf', value: 'Draf' },
  { label: 'Spec', value: 'Spec' },
]

function statusOf(i: number): { text: string; color: 'success' | 'warning' | 'error'; icon: string } {
  const st = sectionStatus(props.issues, i)
  const all = Object.values(st)
  if (all.includes('error')) return { text: 'Ralat', color: 'error', icon: 'i-ph-warning-circle' }
  if (all.includes('incomplete')) return { text: 'Belum lengkap', color: 'warning', icon: 'i-ph-minus-circle' }
  return { text: 'Lengkap', color: 'success', icon: 'i-ph-check-circle' }
}

function summary(i: number): string {
  const s = props.form.sections[i]!
  const rule = s.ruleType === 'all' ? 'Jawab semua' : `Jawab ${s.chooseN ?? '?'} daripada ${s.questionCount ?? '?'}`
  return `${questionRange(props.form.sections, i)} - ${s.markBudget ?? 0} markah - ${rule}`
}

const letter = (i: number): string => `Bahagian ${String.fromCharCode(65 + (i % 26))}`
function add(): void {
  if (props.form.sections.length >= MAX) return
  props.form.sections.push(emptySection(letter(props.form.sections.length)))
}
function move(i: number, d: -1 | 1): void {
  const list = props.form.sections
  const j = i + d
  if (j < 0 || j >= list.length) return
  const [item] = list.splice(i, 1)
  list.splice(j, 0, item!)
}
async function remove(i: number): Promise<void> {
  const s = props.form.sections[i]!
  if (props.form.sections.length <= 1) return
  const ok = await confirm({
    message: `Padam ${s.label || `Bahagian ${i + 1}`}? Nombor soalan akan dikira semula.`,
    tone: 'error',
    confirmLabel: 'Padam',
  })
  if (ok) props.form.sections.splice(i, 1)
}
async function retire(): Promise<void> {
  if (props.dependentPapers > 0) return
  const ok = await confirm({
    title: 'Padam kontrak ini?',
    message: `Ini akan memberi kesan kepada kertas draf dan Jana Kertas bagi ${props.subjectName} Kertas ${props.kertas}.`,
    tone: 'error',
    confirmLabel: 'Padam',
  })
  if (ok) emit('retire')
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <DsFormSection title="Maklumat Kertas" icon="file-text" :columns="2">
      <div>
        <p class="text-label text-default">Subjek</p>
        <p class="mt-2 text-body">{{ subjectName }}</p>
      </div>
      <div>
        <p class="text-label text-default">Kertas</p>
        <p class="mt-2 text-body">Kertas {{ kertas }}</p>
      </div>
      <DsFormField native :for="fieldId(null, 'code')" label="Kod kertas" required :error="errAt('code')">
        <template #default="f">
          <UInput :id="f.id" v-model="form.code" :aria-invalid="f.invalid" class="w-full" :ui="{ base: 'min-h-11' }" placeholder="1449/2" />
        </template>
      </DsFormField>
      <DsFormField native :for="fieldId(null, 'duration')" label="Tempoh (minit)" required :error="errAt('duration')">
        <template #default="f">
          <NumField :id="f.id" v-model="form.durationMin" :min="1" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
      <DsFormField native :for="fieldId(null, 'jumlah')" label="Jumlah markah" required :error="errAt('jumlah')">
        <template #default="f">
          <NumField :id="f.id" v-model="form.totalMarks" :min="1" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
      <div v-if="form.source === 'Disahkan'">
        <p class="text-label text-default">Status</p>
        <div class="mt-2"><SourceBadge source="Disahkan" /></div>
      </div>
      <DsFormField v-else native :for="fieldId(null, 'status')" label="Status">
        <template #default="f">
          <DsNativeSelect :id="f.id" v-model="form.source" :items="statusItems" />
        </template>
      </DsFormField>
      <div class="sm:col-span-2">
        <DsFormField
          native
          :for="fieldId(null, 'notes')"
          label="Nota"
          hint="Perubahan medan ini tidak menjejaskan status Disahkan."
        >
          <template #default="f">
            <UTextarea :id="f.id" v-model="form.notes" :rows="3" class="w-full" />
          </template>
        </DsFormField>
      </div>
    </DsFormSection>

    <DsFormSection v-if="reference.length" title="Panel Rujukan" icon="file-text">
      <p class="text-caption text-muted">
        Dibawa ke versi baharu tanpa perubahan. Ia tidak disunting di sini.
      </p>
      <ul class="flex flex-col gap-2" data-testid="reference-panels">
        <li v-for="p in reference" :key="p.title" class="rounded-md bg-elevated p-3">
          <p class="text-label text-highlighted">{{ p.title }}</p>
          <p class="text-caption text-muted">{{ p.items.length }} item</p>
        </li>
      </ul>
    </DsFormSection>

    <DsFormSection title="Arahan Muka Depan" icon="list-numbers">
      <DsFormField
        native
        :for="fieldId(null, 'instructions')"
        label="Arahan"
        hint="Satu baris ialah satu arahan. Tidak menjejaskan status Disahkan."
      >
        <template #default="f">
          <UTextarea :id="f.id" v-model="form.instructions" :rows="4" class="w-full" />
        </template>
      </DsFormField>
    </DsFormSection>

    <DsFormSection title="Piawaian Peringkat Kertas" icon="target" :columns="2">
      <div class="sm:col-span-2">
        <USwitch
          v-model="form.subPartRamp"
          label="Sub-bahagian menaik"
          description="Semakan bank akan menanda soalan berbilang bahagian yang tidak menaik dari tuntutan rendah ke tinggi. Ini bukan syarat terbit."
          data-testid="sub-part-ramp"
        />
      </div>
      <DsFormField
        native
        :for="fieldId(null, 'nisbah-t4')"
        label="Nisbah Tingkatan 4"
        hint="Pilihan. Jika diisi, mesti sama dengan nisbah daripada nilai unit di setiap Bahagian."
      >
        <template #default="f"><NumField :id="f.id" v-model="form.levelShare.t4" /></template>
      </DsFormField>
      <DsFormField native :for="fieldId(null, 'nisbah')" label="Nisbah Tingkatan 5" :error="errAt('nisbah')">
        <template #default="f">
          <NumField :id="f.id" v-model="form.levelShare.t5" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
      <DsFormField
        native
        :for="fieldId(null, 'kbat')"
        label="Kuota KBAT kertas"
        hint="Pilihan. Jika diisi, mesti sama dengan jumlah kuota KBAT semua Bahagian."
        :error="errAt('kbat')"
      >
        <template #default="f">
          <NumField :id="f.id" v-model="form.kbatMarks" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
    </DsFormSection>

    <DsFormSection title="Senarai Bahagian" icon="list-numbers">
      <ul :id="fieldId(null, 'bahagian')" class="flex flex-col gap-2" data-testid="section-list">
        <li
          v-for="(s, i) in form.sections"
          :key="s.uid"
          class="flex min-w-0 flex-wrap items-center gap-3 rounded-md bg-elevated p-3"
          :data-testid="`section-row-${i}`"
        >
          <span class="tabular w-6 shrink-0 text-label text-muted">{{ i + 1 }}</span>
          <div class="min-w-0 flex-1 basis-48">
            <p class="text-label break-words text-highlighted">{{ s.label || `Bahagian ${i + 1}` }}</p>
            <p class="text-caption text-muted">{{ summary(i) }}</p>
          </div>
          <UBadge :color="statusOf(i).color" variant="subtle" :icon="statusOf(i).icon" :label="statusOf(i).text" />
          <div class="flex flex-wrap gap-1">
            <UButton color="neutral" variant="soft" size="sm" class="min-h-11" icon="i-ph-pencil-simple" label="Edit" :aria-label="`Edit ${s.label}`" @click="emit('edit', i)" />
            <UButton color="neutral" variant="ghost" size="sm" class="min-h-11 min-w-11" icon="i-ph-arrow-up" :aria-label="`Naikkan ${s.label}`" :disabled="i === 0" @click="move(i, -1)" />
            <UButton color="neutral" variant="ghost" size="sm" class="min-h-11 min-w-11" icon="i-ph-arrow-down" :aria-label="`Turunkan ${s.label}`" :disabled="i === form.sections.length - 1" @click="move(i, 1)" />
            <UButton color="error" variant="ghost" size="sm" class="min-h-11 min-w-11" icon="i-ph-trash" :aria-label="`Padam ${s.label}`" :disabled="form.sections.length <= 1" @click="remove(i)" />
          </div>
        </li>
      </ul>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton color="neutral" variant="soft" class="min-h-11" icon="i-ph-plus" label="Tambah Bahagian" :disabled="form.sections.length >= MAX" data-testid="add-section" @click="add" />
        <SumMeter label="Jumlah markah selepas pilih N" :value="budgetSum" :target="form.totalMarks" />
      </div>
    </DsFormSection>

    <DsFormSection v-if="!isNew" title="Padam Kontrak" icon="trash" tone="error">
      <p class="text-body text-muted">
        Kontrak yang dipadam tidak lagi disenaraikan dan tidak boleh digunakan untuk kertas baharu.
      </p>
      <p v-if="retireError" class="flex items-start gap-1 text-caption text-error" role="alert" data-testid="retire-error">
        <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{{ retireError }}</span>
      </p>
      <p v-if="dependentPapers > 0" id="retire-blocked" class="text-caption text-error" data-testid="retire-blocked">
        Tidak boleh dipadam: {{ dependentPapers }} kertas Terbit bergantung pada kontrak ini.
      </p>
      <div>
        <UButton color="error" variant="soft" class="min-h-11" icon="i-ph-trash" label="Padam Kontrak" :aria-disabled="dependentPapers > 0 ? 'true' : undefined" :aria-describedby="dependentPapers > 0 ? 'retire-blocked' : undefined" data-testid="retire" @click="retire" />
      </div>
    </DsFormSection>
  </div>
</template>
