<script setup lang="ts">
/**
 * The declaration both entry paths ask for (v2-question-bank 4.2): subject, kertas, year, paper
 * type, source and copyright. Shared by Muat Naik Kertas and Tulis Soalan Manual so the two stay
 * identical.
 */
import { DsFormField, DsFormSection, DsNativeSelect } from '@/ds'

import { dskpSubjects } from '../../../lib/dskp-source'
import { COPYRIGHT_OPTIONS, PAPER_TYPES } from '../types'

export interface IntakeForm {
  subject: string
  kertas: string
  year: string
  paperType: string
  source: string
  copyright: string
  notes: string
  /** Optional: narrows the AI suggestion of unit and SP to one tingkatan (upload path only). */
  tingkatan?: '' | 'T4' | 'T5'
}

const form = defineModel<IntakeForm>({ required: true })
withDefaults(defineProps<{ askTingkatan?: boolean }>(), { askTingkatan: false })
/** The 13 catalogue subjects: every subject a question can be tagged with (AC-03.1). */
const subjects = dskpSubjects()
</script>

<template>
  <DsFormSection
    title="Maklumat kertas"
    description="Subjek, kertas dan tahun. Tahap Tingkatan 4-5."
    icon="file-text"
    :columns="2"
  >
    <DsFormField native for="in-subject" label="Subjek" required>
      <DsNativeSelect id="in-subject" v-model="form.subject" data-testid="intake-subject">
        <option v-for="s in subjects" :key="s.code" :value="s.code">{{ s.name }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField native for="in-kertas" label="Kertas" required>
      <DsNativeSelect id="in-kertas" v-model="form.kertas" data-testid="intake-kertas">
        <option value="1">Kertas 1</option>
        <option value="2">Kertas 2</option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField native for="in-year" label="Tahun" required>
      <UInput id="in-year" v-model="form.year" type="number" min="2000" max="2100" class="w-full" />
    </DsFormField>
    <DsFormField native for="in-type" label="Jenis kertas" required>
      <DsNativeSelect id="in-type" v-model="form.paperType">
        <option v-for="t in PAPER_TYPES" :key="t" :value="t">{{ t }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField
      v-if="askTingkatan"
      native
      for="in-tingkatan"
      label="Tingkatan (pilihan)"
      hint="Menyempitkan cadangan unit dan SP oleh AI."
    >
      <DsNativeSelect
        id="in-tingkatan"
        v-model="form.tingkatan"
        blank
        placeholder="Tidak ditetapkan"
        data-testid="intake-tingkatan"
      >
        <option value="T4">Tingkatan 4</option>
        <option value="T5">Tingkatan 5</option>
      </DsNativeSelect>
    </DsFormField>
  </DsFormSection>

  <DsFormSection
    title="Sumber dan hak cipta"
    description="Pengisytiharan wajib sebelum soalan boleh dihantar untuk semakan."
    icon="shield-check"
    :columns="2"
  >
    <div class="sm:col-span-2">
      <DsFormField
        native
        for="in-source"
        label="Sumber"
        required
        hint="cth. Percubaan SPM Negeri, kertas sekolah sendiri, KPM / LPM."
      >
        <UInput id="in-source" v-model="form.source" class="w-full" data-testid="intake-source" />
      </DsFormField>
    </div>
    <DsFormField native for="in-copy" label="Status hak cipta" required>
      <DsNativeSelect
        id="in-copy"
        v-model="form.copyright"
        blank
        placeholder="Pilih"
        data-testid="intake-copyright"
      >
        <option v-for="c in COPYRIGHT_OPTIONS" :key="c.value" :value="c.value">
          {{ c.label }}
        </option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField native for="in-notes" label="Catatan">
      <UInput id="in-notes" v-model="form.notes" class="w-full" />
    </DsFormField>
  </DsFormSection>
</template>
