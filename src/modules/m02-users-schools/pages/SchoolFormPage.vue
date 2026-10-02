<script setup lang="ts">
/**
 * S10 `/admin/schools/create` "Tambah Sekolah" and S11 `/admin/schools/:id/edit` "Edit Sekolah"
 * (M02-T8; FR-M02-80, FR-M02-81). One form for both: `mode="create"` posts a new school ("Simpan",
 * "Sekolah Aktif" on by default), `mode="edit"` loads the school, pre-fills it and puts its name in
 * the shell header subtitle ("Kemaskini").
 *
 * Native HTML5 validation only (`required`, no `novalidate`; design-system §7.2). A server
 * `VALIDATION_ERROR` (e.g. a duplicate code) shows in the red alert above the form, marks the field
 * and keeps the input. Success queues the flash (UNVERIFIED COPY, from the API `status`) and goes
 * back to the list.
 */
import { ArrowLeft, Save } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
} from '@/components/form'
import { useApi, useFlash, usePageMeta } from '@/composables'

import {
  createSchool,
  fetchAdminSchool,
  updateSchool,
  type SchoolInputBody,
  type SchoolType,
} from '../api/schools-admin'
import { errorLines, fieldErrors } from '../lib/school-errors'
import { SCHOOLS_LIST_PATH, SCHOOL_STATE_OPTIONS, SCHOOL_TYPE_OPTIONS } from '../lib/school-options'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: number }>(), { id: 0 })

const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()

const editing = computed(() => props.mode === 'edit')

interface SchoolForm {
  name: string
  code: string
  type: SchoolType | ''
  state: string
  district: string
  city: string
  isActive: boolean
}

const form = reactive<SchoolForm>({
  name: '',
  code: '',
  type: '',
  state: '',
  district: '',
  city: '',
  isActive: true,
})

// S11: GET /api/admin/schools/:id pre-fills the form and the header subtitle.
const {
  data: loaded,
  error: loadError,
  reload: reloadSchool,
} = useApi(
  (signal) => fetchAdminSchool(props.id, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' },
)

watch(
  loaded,
  (school) => {
    if (!school) return
    form.name = school.name
    form.code = school.code
    form.type = school.type as SchoolType
    form.state = school.state
    form.district = school.district ?? ''
    form.city = school.city ?? ''
    form.isActive = school.isActive
    pageMeta.setHeader({ title: 'Edit Sekolah', subtitle: school.name })
  },
  { immediate: true },
)

/** An unknown id is the standard 404 page, as live (module decision); other load failures keep the red box. */
const notFound = computed(() => isApiError(loadError.value) && loadError.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const ready = computed(() => !editing.value || loaded.value !== null)
const saving = ref(false)
const errors = ref<string[]>([])
const fieldMessages = ref<Record<string, string>>({})

function invalid(field: keyof SchoolForm): boolean {
  return fieldMessages.value[field] !== undefined
}

function fieldClass(base: string, field: keyof SchoolForm): string[] {
  return [base, 'min-h-11', invalid(field) ? FORM_ERROR_MODIFIER : '']
}

async function submit(): Promise<void> {
  if (saving.value || form.type === '') return
  saving.value = true
  errors.value = []
  fieldMessages.value = {}
  const body: SchoolInputBody = {
    name: form.name,
    code: form.code,
    type: form.type,
    state: form.state,
    district: form.district,
    city: form.city,
    isActive: form.isActive,
  }
  try {
    const result = editing.value ? await updateSchool(props.id, body) : await createSchool(body)
    flash.success(result.status)
    await router.push(SCHOOLS_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    fieldMessages.value = fieldErrors(err)
  } finally {
    saving.value = false
  }
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="space-y-4" data-testid="school-form-page">
    <RouterLink
      :to="SCHOOLS_LIST_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      data-testid="school-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke Senarai Sekolah
    </RouterLink>

    <!-- S11 could not load the school (unknown id): red box + the way back. INFERRED. -->
    <div v-if="editing && loadError && !notFound" class="space-y-3" data-testid="school-load-error">
      <AlertBox :messages="errorLines(loadError)" />
      <button
        type="button"
        :class="[BUTTON_BASE, 'bg-indigo-500 text-white shadow hover:bg-indigo-600']"
        @click="reloadSchool()"
      >
        Cuba Lagi
      </button>
    </div>

    <div
      v-else-if="!ready && !notFound"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="school-form-skeleton"
    >
      <div v-for="n in 4" :key="n" class="h-11 animate-pulse rounded-xl bg-slate-100"></div>
    </div>

    <form
      v-else-if="!notFound"
      method="post"
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="school-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="errors" class="mb-5" data-testid="school-form-alert" />

      <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="school-name" :class="LABEL"
            >Nama Sekolah <span class="text-red-500">*</span></label
          >
          <input
            id="school-name"
            v-model="form.name"
            type="text"
            name="name"
            required
            placeholder="cth: SK TAMAN KLUANG BARU"
            :class="fieldClass(FORM_INPUT_CLASS, 'name')"
            data-testid="school-name"
          />
          <p v-if="invalid('name')" :class="FORM_ERROR_TEXT_CLASS">{{ fieldMessages.name }}</p>
        </div>

        <div class="sm:col-span-2">
          <label for="school-code" :class="LABEL"
            >Kod Sekolah <span class="text-red-500">*</span></label
          >
          <input
            id="school-code"
            v-model="form.code"
            type="text"
            name="code"
            required
            placeholder="cth: JBA1234"
            :class="[...fieldClass(FORM_INPUT_CLASS, 'code'), 'font-mono']"
            data-testid="school-code"
          />
          <p v-if="invalid('code')" :class="FORM_ERROR_TEXT_CLASS">{{ fieldMessages.code }}</p>
        </div>

        <div>
          <label for="school-type" :class="LABEL">Jenis <span class="text-red-500">*</span></label>
          <select
            id="school-type"
            v-model="form.type"
            name="type"
            required
            :class="fieldClass(FORM_SELECT_CLASS, 'type')"
            data-testid="school-type"
          >
            <option value="">Pilih jenis</option>
            <option v-for="type in SCHOOL_TYPE_OPTIONS" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
          <p v-if="invalid('type')" :class="FORM_ERROR_TEXT_CLASS">{{ fieldMessages.type }}</p>
        </div>

        <div>
          <label for="school-state" :class="LABEL"
            >Negeri <span class="text-red-500">*</span></label
          >
          <select
            id="school-state"
            v-model="form.state"
            name="state"
            required
            :class="fieldClass(FORM_SELECT_CLASS, 'state')"
            data-testid="school-state"
          >
            <option value="">Pilih negeri</option>
            <option v-for="name in SCHOOL_STATE_OPTIONS" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
          <p v-if="invalid('state')" :class="FORM_ERROR_TEXT_CLASS">{{ fieldMessages.state }}</p>
        </div>

        <div>
          <label for="school-district" :class="LABEL">Daerah</label>
          <input
            id="school-district"
            v-model="form.district"
            type="text"
            name="district"
            placeholder="cth: KLUANG"
            :class="fieldClass(FORM_INPUT_CLASS, 'district')"
            data-testid="school-district"
          />
          <p v-if="invalid('district')" :class="FORM_ERROR_TEXT_CLASS">
            {{ fieldMessages.district }}
          </p>
        </div>

        <div>
          <label for="school-city" :class="LABEL">Bandar</label>
          <input
            id="school-city"
            v-model="form.city"
            type="text"
            name="city"
            placeholder="cth: KLUANG"
            :class="fieldClass(FORM_INPUT_CLASS, 'city')"
            data-testid="school-city"
          />
          <p v-if="invalid('city')" :class="FORM_ERROR_TEXT_CLASS">{{ fieldMessages.city }}</p>
        </div>

        <div class="sm:col-span-2">
          <label class="inline-flex min-h-11 cursor-pointer items-center gap-3">
            <input
              v-model="form.isActive"
              type="checkbox"
              name="is_active"
              class="peer sr-only"
              data-testid="school-active"
            />
            <span
              class="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-green-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
              aria-hidden="true"
            ></span>
            <span class="text-sm font-medium text-slate-700">Sekolah Aktif</span>
          </label>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
        <button
          type="submit"
          :disabled="saving"
          :class="[
            BUTTON_BASE,
            'bg-indigo-500 text-white shadow hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50',
          ]"
          data-testid="school-submit"
        >
          <LoadingSpinner v-if="saving" class="h-4 w-4" />
          <Save v-else class="h-4 w-4" aria-hidden="true" />
          {{ editing ? 'Kemaskini' : 'Simpan' }}
        </button>
        <RouterLink
          :to="SCHOOLS_LIST_PATH"
          :class="[BUTTON_BASE, 'bg-slate-200 text-slate-600 hover:bg-slate-300']"
          data-testid="school-cancel"
        >
          Batal
        </RouterLink>
      </div>
    </form>
  </div>
</template>
