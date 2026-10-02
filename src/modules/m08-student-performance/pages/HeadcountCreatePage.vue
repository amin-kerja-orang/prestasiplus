<script setup lang="ts">
/**
 * S14 `/headcount/create` "Buat Headcount Baru" (M08-T6; FR-M08-87…91, BR-M08-22). Validation is the
 * browser's own (`required`, `min`, `max`; no `novalidate`, FR-M08-90). A valid submit calls
 * `POST /api/headcounts`: 201 goes to `/headcount`; a 409 (duplicate Auto / Manual) or a 422 shows the
 * returned copy above the form and keeps the values (FR-M08-91, PROPOSED COPY).
 */
import { ArrowLeft, Plus } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form/classes'

import { createHeadcount, fetchHeadcountFormOptions } from '../api/headcount'
import type { HeadcountMode } from '../api/headcount-types'
import LoadError from '../components/headcount/LoadError.vue'
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

const OTR_CHOICES = [2, 3, 4, 5]
const MODES: { value: HeadcountMode; title: string; text: string }[] = [
  {
    value: 'auto',
    title: '🤖 Auto',
    text: 'Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus.',
  },
  {
    value: 'manual',
    title: '✍️ Manual',
    text: 'Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah).',
  },
]

const submitting = ref(false)
const messages = ref<string[]>([])
const hasMessages = computed(() => messages.value.length > 0)

async function submit() {
  if (submitting.value) return
  submitting.value = true
  messages.value = []
  try {
    await createHeadcount({
      classroomId: Number(form.classroomId),
      subjectId: Number(form.subjectId),
      educationLevelId: Number(form.educationLevelId),
      academicYear: Number(form.academicYear),
      activeOtrs: form.activeOtrs,
      mode: form.mode,
    })
    await router.push('/headcount')
  } catch (err) {
    if (isApiError(err) && err.fields !== undefined && Object.keys(err.fields).length > 0) {
      messages.value = Object.values(err.fields)
    } else if (isApiError(err) && (err.status === 409 || err.status === 422)) {
      messages.value = [err.message]
    } else {
      messages.value = [LOAD_ERROR]
    }
  } finally {
    submitting.value = false
  }
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-create-page">
    <div class="flex items-center gap-3">
      <RouterLink
        to="/headcount"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow transition hover:text-slate-800"
        data-testid="back-link"
        ><ArrowLeft class="h-5 w-5"
      /></RouterLink>
      <h1 class="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Buat Headcount Baru</h1>
    </div>

    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <form
      v-else-if="options"
      class="min-w-0 space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="create-form"
      @submit.prevent="submit"
    >
      <AlertBox v-if="hasMessages" :messages="messages" data-testid="form-error" />

      <div>
        <label for="classroom_id" :class="LABEL">Pilih Kelas</label>
        <select
          id="classroom_id"
          v-model="form.classroomId"
          name="classroom_id"
          required
          :class="FORM_SELECT_CLASS"
        >
          <option value="">— Pilih kelas —</option>
          <option v-for="c in options.classes" :key="c.id" :value="String(c.id)">
            {{ c.name }}
          </option>
        </select>
      </div>

      <div>
        <label for="subject_id" :class="LABEL">Pilih Subjek</label>
        <select
          id="subject_id"
          v-model="form.subjectId"
          name="subject_id"
          required
          :class="FORM_SELECT_CLASS"
        >
          <option value="">— Pilih subjek —</option>
          <option v-for="s in options.subjects" :key="s.id" :value="String(s.id)">
            {{ s.name }} ({{ s.code }})
          </option>
        </select>
      </div>

      <div>
        <label for="education_level_id" :class="LABEL">Tingkatan</label>
        <select
          id="education_level_id"
          v-model="form.educationLevelId"
          name="education_level_id"
          required
          :class="FORM_SELECT_CLASS"
        >
          <option value="">— Pilih tingkatan —</option>
          <option v-for="l in options.levels" :key="l.id" :value="String(l.id)">
            {{ l.name }}
          </option>
        </select>
      </div>

      <div>
        <label for="academic_year" :class="LABEL">Tahun Akademik</label>
        <input
          id="academic_year"
          v-model.number="form.academicYear"
          name="academic_year"
          type="number"
          required
          min="2020"
          max="2100"
          :class="FORM_INPUT_CLASS"
        />
      </div>

      <fieldset class="min-w-0" data-testid="otr-field">
        <legend :class="LABEL">Bilangan OTR</legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="n in OTR_CHOICES"
            :key="n"
            :class="[
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition',
              form.activeOtrs === n
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600',
            ]"
          >
            <input v-model="form.activeOtrs" type="radio" name="active_otrs" :value="n" />
            {{ n }} OTR
          </label>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas.
        </p>

        <div class="mt-5">
          <p :class="LABEL">Mod Pengiraan Markah</p>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label
              v-for="m in MODES"
              :key="m.value"
              :class="[
                'flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition',
                form.mode === m.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200',
              ]"
              :data-testid="`mode-${m.value}`"
            >
              <input
                v-model="form.mode"
                type="radio"
                name="mode"
                :value="m.value"
                class="mt-1 shrink-0"
              />
              <span class="min-w-0">
                <span class="block text-sm font-bold text-slate-800">{{ m.title }}</span>
                <span class="mt-0.5 block text-xs text-slate-500">{{ m.text }}</span>
              </span>
            </label>
          </div>
          <p class="mt-2 text-xs text-slate-500">
            Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama.
          </p>
        </div>
      </fieldset>

      <button
        type="submit"
        :disabled="submitting"
        class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
        data-testid="create-submit"
      >
        <Plus class="h-4 w-4" />Cipta Headcount
      </button>
    </form>
  </div>
</template>
