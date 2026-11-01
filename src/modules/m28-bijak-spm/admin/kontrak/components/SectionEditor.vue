<script setup lang="ts">
/**
 * Tab "Bahagian {label}" (design 4.3): Struktur Bahagian, Profil Kesukaran, Kuota Topik (JSU) and
 * Kuota KBAT as four sections of one form. Fields edit the shared form object in place.
 */
import type { BijakUnitRefView } from '@pp/contract'
import { computed } from 'vue'

import { DsFormField, DsFormSection } from '@/ds'

import { offeredMarks, questionRange, type ContractForm, type FormSection } from '../domain/form'
import { fieldId, type Issue } from '../domain/validate'
import NumField from './NumField.vue'
import QuotaLinesEditor from './QuotaLinesEditor.vue'
import SlotGroupsEditor from './SlotGroupsEditor.vue'
import SumMeter from './SumMeter.vue'

const props = defineProps<{
  index: number
  form: ContractForm
  subject: string
  issues: readonly Issue[]
  loadUnits: (subject: string) => Promise<BijakUnitRefView[]>
  /** The head is saved (not dirty) and not Disahkan: the review stamp can be sent (AC-39.9). */
  canReview?: boolean
  reviewing?: boolean
  reviewError?: string
}>()
const emit = defineEmits<{ review: [] }>()
const s = defineModel<FormSection>({ required: true })

/** Quota lines or the KBAT value the server seeded and nobody has confirmed ("Belum disemak"). */
const hasUnreviewed = computed(
  () => s.value.quotaLines.some((l) => !l.reviewed) || (s.value.kbatMarks !== null && !s.value.kbatReviewed),
)

const MODES = [
  { value: 'mcq', label: 'Aneka pilihan' },
  { value: 'match_letter', label: 'Padan huruf' },
  { value: 'short_text', label: 'Jawapan pendek' },
  { value: 'numeric', label: 'Nombor' },
  { value: 'working', label: 'Langkah kerja' },
  { value: 'essay', label: 'Esei' },
  { value: 'drawing', label: 'Lukisan' },
  { value: 'table_fill', label: 'Isi jadual' },
]
const RULES = [
  { value: 'all', label: 'Jawab Semua' },
  { value: 'choose', label: 'Pilih N' },
]

const errAt = (name: string): string | undefined =>
  props.issues.find((i) => i.level === 'error' && i.target === fieldId(props.index, name))?.message
const range = computed(() => questionRange(props.form.sections, props.index))
const offered = computed(() => offeredMarks(s.value))
const kbatErrors = computed(() =>
  props.issues.filter((i) => i.section === props.index && i.part === 'kbat' && i.level !== 'incomplete'),
)

function setRule(v: unknown): void {
  s.value.ruleType = v === 'choose' ? 'choose' : 'all'
  if (s.value.ruleType === 'all') s.value.chooseN = null
  else if (s.value.chooseN === null) s.value.chooseN = 1
  // One slot group for choose-N (AC-35.7).
  if (s.value.ruleType === 'choose' && s.value.groups.length > 1) {
    const first = s.value.groups[0]!
    s.value.groups = [{ ...first, from: 1, to: s.value.questionCount }]
    if (s.value.profileKind === 'ladder') s.value.profileKind = 'bahagian'
  }
}
function setPerSlot(on: boolean): void {
  s.value.perSlotMarks = on
  if (!on) for (const g of s.value.groups) g.marks = null
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <div
      v-if="hasUnreviewed"
      class="flex min-w-0 flex-col gap-2 rounded-md bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="review-bar"
    >
      <p class="text-body text-default">
        Ada nilai kuota atau KBAT yang belum disemak dalam bahagian ini.
        <span v-if="!canReview" class="text-muted">Simpan perubahan dahulu untuk menandakan bahagian ini.</span>
      </p>
      <UButton
        class="min-h-11 self-start"
        color="primary"
        variant="soft"
        icon="i-ph-check"
        label="Tandakan sudah disemak"
        :loading="reviewing"
        :disabled="!canReview || reviewing"
        data-testid="mark-reviewed"
        @click="emit('review')"
      />
      <p v-if="reviewError" class="text-caption text-error" role="alert" data-testid="review-error">{{ reviewError }}</p>
    </div>
    <DsFormSection title="Struktur Bahagian" icon="list-numbers" :columns="2">
      <DsFormField native :for="fieldId(index, 'label')" label="Label" required :error="errAt('label')">
        <template #default="f">
          <UInput :id="f.id" v-model="s.label" :aria-invalid="f.invalid" class="w-full" :ui="{ base: 'min-h-11' }" />
        </template>
      </DsFormField>
      <div>
        <p class="text-label text-default">Julat soalan</p>
        <p class="mt-2 text-body text-muted" data-testid="section-range">{{ range }}</p>
      </div>

      <div class="sm:col-span-2">
        <DsFormField
          native
          :for="fieldId(index, 'instruction')"
          label="Arahan (opsyenal)"
          hint="Jika kosong, murid melihat arahan sistem: Jawab semua soalan. atau Jawab N daripada M soalan."
        >
          <template #default="f">
            <UTextarea :id="f.id" v-model="s.instruction" :rows="2" class="w-full" />
          </template>
        </DsFormField>
      </div>

      <fieldset class="min-w-0 sm:col-span-2">
        <legend class="mb-2 text-label text-default">Peraturan Pilihan</legend>
        <URadioGroup
          :model-value="s.ruleType"
          orientation="horizontal"
          :items="RULES"
          :ui="{ item: 'min-h-11' }"
          data-testid="rule-kind"
          @update:model-value="setRule"
        />
      </fieldset>

      <DsFormField native :for="fieldId(index, 'm')" label="Bilangan soalan (M)" required :error="errAt('m')">
        <template #default="f">
          <NumField :id="f.id" v-model="s.questionCount" :min="1" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
      <DsFormField
        v-if="s.ruleType === 'choose'"
        native
        :for="fieldId(index, 'n')"
        label="Jawab (N)"
        required
        :error="errAt('n')"
      >
        <template #default="f">
          <NumField :id="f.id" v-model="s.chooseN" :min="1" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>
      <DsFormField
        native
        :for="fieldId(index, 'budget')"
        label="Belanjawan markah (selepas pilih N)"
        required
        :error="errAt('budget')"
      >
        <template #default="f">
          <NumField :id="f.id" v-model="s.markBudget" :invalid="f.invalid" :describedby="f.describedby" />
        </template>
      </DsFormField>

      <div class="min-w-0 sm:col-span-2">
        <USwitch
          :model-value="s.perSlotMarks"
          label="Tetapkan markah mengikut slot"
          :description="
            s.profileKind
              ? 'Markah soalan boleh berbeza dalam bahagian ini. Isi markah pada setiap kumpulan slot di bawah.'
              : 'Tetapkan profil kesukaran dahulu untuk menetapkan markah mengikut slot.'
          "
          :disabled="!s.profileKind"
          data-testid="per-slot-marks"
          @update:model-value="(v: boolean) => setPerSlot(v)"
        />
      </div>

      <fieldset class="min-w-0 sm:col-span-2">
        <legend class="mb-2 text-label text-default">Mod Jawapan Dijangka</legend>
        <UCheckboxGroup
          v-model="s.allowedModes"
          :items="MODES"
          orientation="horizontal"
          :ui="{ item: 'min-h-11' }"
          data-testid="allowed-modes"
        />
        <p class="mt-1 text-caption text-muted">Tiada pilihan bermakna semua mod dibenarkan.</p>
      </fieldset>
    </DsFormSection>

    <DsFormSection title="Profil Kesukaran" icon="chart-line-up">
      <SlotGroupsEditor v-model="s" :index="index" :issues="issues" />
    </DsFormSection>

    <DsFormSection title="Kuota Topik (JSU)" icon="target">
      <QuotaLinesEditor
        v-model="s"
        :index="index"
        :subject="subject"
        :issues="issues"
        :load-units="loadUnits"
      />
    </DsFormSection>

    <DsFormSection title="Kuota KBAT" icon="brain">
      <div :id="fieldId(index, 'kbat')" tabindex="-1" class="flex flex-col gap-3">
        <DsFormField
          native
          :for="fieldId(index, 'kbat-input')"
          label="Markah KBAT (tepat)"
          hint="KBAT ialah bahagian soalan pada tahap kognitif Mengaplikasi, Menganalisis, Menilai atau Mencipta. Dikira atas markah ditawarkan."
        >
          <template #default="f">
            <div class="flex max-w-xs flex-col gap-2">
              <NumField :id="f.id" v-model="s.kbatMarks" :invalid="f.invalid" :describedby="f.describedby" />
              <UBadge
                v-if="s.kbatMarks !== null && !s.kbatReviewed"
                class="self-start"
                color="warning"
                variant="subtle"
                icon="i-ph-question"
                label="Belum disemak"
                data-testid="kbat-unreviewed"
              />
            </div>
          </template>
        </DsFormField>
        <SumMeter
          v-if="s.kbatMarks !== null && offered !== null"
          label="Markah KBAT"
          :value="s.kbatMarks"
          :target="offered"
          unit="markah ditawarkan"
        />
        <p class="text-caption text-muted">
          TP mengukur kesukaran; KBAT ialah tahap kognitif. Keduanya ditetapkan berasingan.
        </p>
        <ul v-if="kbatErrors.length" class="flex flex-col gap-1" data-testid="kbat-errors">
          <li v-for="e in kbatErrors" :key="e.id" class="flex items-start gap-1 text-caption" :class="e.level === 'error' ? 'text-error' : 'text-muted'">
            <UIcon :name="e.level === 'error' ? 'i-ph-warning-circle' : 'i-ph-info'" class="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{{ e.message }}</span>
          </li>
        </ul>
      </div>
    </DsFormSection>
  </div>
</template>
