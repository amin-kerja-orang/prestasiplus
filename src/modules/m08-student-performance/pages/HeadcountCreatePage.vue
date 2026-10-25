<script setup lang="ts">
/**
 * S14 `/headcount/create` "Buat Headcount Baru" (M08-T6; FR-M08-87…91, BR-M08-22). Validation is the
 * browser's own (`required`, `min`, `max`; no `novalidate`, FR-M08-90). A valid submit calls
 * `POST /api/headcounts`: 201 goes to `/headcount`; a 409 (duplicate Auto / Manual) or a 422 shows the
 * returned copy above the form and keeps the values (FR-M08-91, PROPOSED COPY).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'
import { DsBackLink, DsLoadError, DsPage, DsPageHeader, DsPanel } from '@/ds'

import { createHeadcount, fetchHeadcountFormOptions } from '../api/headcount'
import type { HeadcountMode } from '../api/headcount-types'
import { headcountActionError } from '../lib/headcount/error-text'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const router = useRouter()
const {
  data: options,
  error,
  reload,
} = useRouteData((signal) => fetchHeadcountFormOptions({ signal }))

const form = reactive<{
  classroomId: string
  subjectId: string
  educationLevelId: string
  academicYear: number
  activeOtrs: number
  mode: HeadcountMode
}>({
  classroomId: '',
  subjectId: '',
  educationLevelId: '',
  academicYear: 0,
  activeOtrs: 3,
  mode: 'auto',
})
watch(
  options,
  (o) => {
    if (o && form.academicYear === 0) form.academicYear = o.defaultYear
  },
  { immediate: true },
)

const OTR_ITEMS = [2, 3, 4, 5].map((n) => ({ label: `${String(n)} OTR`, value: n }))
const MODE_ITEMS = [
  {
    value: 'auto',
    label: 'Auto',
    description:
      'Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus.',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah).',
  },
]

const classItems = computed(() =>
  (options.value?.classes ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
)
const subjectItems = computed(() =>
  (options.value?.subjects ?? []).map((s) => ({
    label: `${s.name} (${s.code})`,
    value: String(s.id),
  })),
)
const levelItems = computed(() =>
  (options.value?.levels ?? []).map((l) => ({ label: l.name, value: String(l.id) })),
)

const submitting = ref(false)
const messages = ref<string[]>([])
const hasMessages = computed(() => messages.value.length > 0)

async function submit() {
  if (submitting.value) return
  if (!form.classroomId || !form.subjectId || !form.educationLevelId) return
  submitting.value = true
  messages.value = []
  try {
    await createHeadcount({
      // The real API takes string ids (BE-19 `idField`); mock mode sends numbers.
      classroomId: isHttpMode() ? form.classroomId : Number(form.classroomId),
      subjectId: isHttpMode() ? form.subjectId : Number(form.subjectId),
      educationLevelId: isHttpMode() ? form.educationLevelId : Number(form.educationLevelId),
      academicYear: Number(form.academicYear),
      activeOtrs: form.activeOtrs,
      mode: form.mode,
    })
    await router.push('/headcount')
  } catch (err) {
    if (isApiError(err) && err.fields !== undefined && Object.keys(err.fields).length > 0) {
      messages.value = Object.values(err.fields)
    } else {
      // A 409/422 shows the headcount service's BM message; generic English and transport texts do not (SWE).
      messages.value = [headcountActionError(err)]
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DsPage data-testid="headcount-create-page">
    <DsPageHeader title="Buat Headcount Baru">
      <template #breadcrumb>
        <DsBackLink to="/headcount" label="Kembali" data-testid="back-link" />
      </template>
    </DsPageHeader>

    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <DsPanel v-else-if="options" class="max-w-3xl">
      <form class="flex min-w-0 flex-col gap-6" data-testid="create-form" @submit.prevent="submit">
        <UAlert
          v-if="hasMessages"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="form-error"
        >
          <template #description>
            <ul class="flex flex-col gap-1">
              <li v-for="m in messages" :key="m">{{ m }}</li>
            </ul>
          </template>
        </UAlert>

        <UFormField label="Pilih Kelas" for="classroom_id" required>
          <USelect
            id="classroom_id"
            v-model="form.classroomId"
            name="classroom_id"
            :items="classItems"
            placeholder="— Pilih kelas —"
            required
            size="lg"
            class="w-full"
            data-testid="field-classroom"
          />
        </UFormField>

        <UFormField label="Pilih Subjek" for="subject_id" required>
          <USelect
            id="subject_id"
            v-model="form.subjectId"
            name="subject_id"
            :items="subjectItems"
            placeholder="— Pilih subjek —"
            required
            size="lg"
            class="w-full"
            data-testid="field-subject"
          />
        </UFormField>

        <UFormField label="Tingkatan" for="education_level_id" required>
          <USelect
            id="education_level_id"
            v-model="form.educationLevelId"
            name="education_level_id"
            :items="levelItems"
            placeholder="— Pilih tingkatan —"
            required
            size="lg"
            class="w-full"
            data-testid="field-level"
          />
        </UFormField>

        <UFormField label="Tahun Akademik" for="academic_year" required>
          <UInput
            id="academic_year"
            v-model.number="form.academicYear"
            name="academic_year"
            type="number"
            required
            min="2020"
            max="2100"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <fieldset class="flex min-w-0 flex-col gap-6" data-testid="otr-field">
          <URadioGroup
            v-model="form.activeOtrs"
            legend="Bilangan OTR"
            name="active_otrs"
            :items="OTR_ITEMS"
            orientation="horizontal"
            variant="card"
            hint="Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas."
            data-testid="field-otr"
          />
          <URadioGroup
            v-model="form.mode"
            legend="Mod Pengiraan Markah"
            name="mode"
            :items="MODE_ITEMS"
            variant="card"
            class="min-w-0"
            hint="Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama."
            data-testid="field-mode"
          />
        </fieldset>

        <UButton
          type="submit"
          size="lg"
          block
          icon="i-ph-plus"
          label="Cipta Headcount"
          :loading="submitting"
          data-testid="create-submit"
        />
      </form>
    </DsPanel>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
