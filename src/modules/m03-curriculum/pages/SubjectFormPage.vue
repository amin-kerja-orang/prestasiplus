<script setup lang="ts">
/**
 * S7 `/admin/subjects/create` "Tambah Subjek - Admin PRESTASIPLUS" and S8 `/admin/subjects/:id/edit`
 * "Edit Subjek - Admin PRESTASIPLUS" (M03-T2; FR-M03-47..56). One form for both: `mode="create"`
 * posts a new subject ("Simpan Subjek"), `mode="edit"` loads the subject and pre-fills it
 * ("Kemaskini Subjek").
 *
 * Native HTML5 validation only (`required`, `maxlength`, `min`). A server `VALIDATION_ERROR` (e.g. a
 * duplicate code) shows in the red box above the form and keeps the input. Success queues the flash
 * (UNVERIFIED COPY, from the API `status`) and returns to S6. An unknown id goes back to S6 with
 * the one-time flash "Subjek tidak dijumpai." (FR-45, BR-18). No "Aktif" field (FR-56).
 */
import { ArrowLeft, ArrowUpDown, Info, Lightbulb } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import {
  createSubject,
  fetchAdminLevels,
  fetchAdminSubject,
  updateSubject,
  type SubjectInputBody,
} from '../api/admin-subjects-levels'
import FormActions from '../components/subjects-levels/FormActions.vue'
import {
  ACCENT_INPUT_CLASS,
  COPY,
  FORM_HINT_CLASS,
  FORM_LABEL_CLASS,
  SUBJECTS_LIST_PATH,
  errorLines,
  isNotFoundError,
} from '../lib/subjects-levels'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: number }>(), { id: 0 })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')

interface SubjectForm {
  name: string
  nameEn: string
  code: string
  icon: string
  color: string
  isCore: boolean
  order: number | string
  educationLevelIds: number[]
}

const form = reactive<SubjectForm>({
  name: '',
  nameEn: '',
  code: '',
  icon: 'fas fa-book',
  color: '#4f46e5',
  isCore: false,
  order: 0,
  educationLevelIds: [],
})

// The level checkboxes: every level, active or not (S7/S8 list all 11).
const { data: levels, error: levelsError } = useApi((signal) => fetchAdminLevels({ signal }))

// S8: GET /api/admin/subjects/:id pre-fills the form.
const { data: loaded, error: loadError } = useApi(
  (signal) => fetchAdminSubject(props.id, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' },
)

watch(
  loaded,
  (subject) => {
    if (!subject) return
    form.name = subject.name
    form.nameEn = subject.nameEn
    form.code = subject.code
    form.icon = subject.icon ?? ''
    form.color = subject.color
    form.isCore = subject.isCore
    form.order = subject.order
    form.educationLevelIds = [...subject.educationLevelIds]
  },
  { immediate: true },
)

/** FR-45: an unknown subject returns to S6 with the one-time error flash. */
watch(
  loadError,
  (err) => {
    if (err && isNotFoundError(err)) {
      flash.error(COPY.subjectNotFound)
      void router.replace(SUBJECTS_LIST_PATH)
    }
  },
  { immediate: true },
)

const failed = computed(
  () =>
    (loadError.value !== null && !isNotFoundError(loadError.value)) || levelsError.value !== null,
)
const ready = computed(() => levels.value !== null && (!editing.value || loaded.value !== null))

const saving = ref(false)
const errors = ref<string[]>([])

/** Server errors show only in the red box above the form (FR-27); no per-field marker. */
function inputClass(): string {
  return ACCENT_INPUT_CLASS.indigo
}

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  const body: SubjectInputBody = {
    name: form.name,
    nameEn: form.nameEn,
    code: form.code,
    icon: form.icon,
    color: form.color,
    isCore: form.isCore,
    order: form.order === '' ? 0 : Number(form.order),
    educationLevelIds: [...form.educationLevelIds].sort((a, b) => a - b),
  }
  try {
    const result = editing.value ? await updateSubject(props.id, body) : await createSubject(body)
    flash.success(result.status)
    await router.push(SUBJECTS_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="subject-form-page">
    <RouterLink
      :to="SUBJECTS_LIST_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      data-testid="subject-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke Senarai
    </RouterLink>

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="subject-load-error" />

    <form
      v-else-if="ready"
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="subject-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="errors" data-testid="subject-form-alert" />

      <div>
        <label for="subject-name" :class="FORM_LABEL_CLASS"
          >Nama Subjek (Bahasa Melayu) <span class="text-red-500">*</span></label
        >
        <input
          id="subject-name"
          v-model="form.name"
          type="text"
          name="name"
          required
          placeholder="cth: Matematik"
          :class="inputClass()"
          data-testid="subject-name"
        />
      </div>

      <div>
        <label for="subject-name-en" :class="FORM_LABEL_CLASS"
          >Nama Subjek (English) <span class="text-red-500">*</span></label
        >
        <input
          id="subject-name-en"
          v-model="form.nameEn"
          type="text"
          name="nameEn"
          required
          placeholder="e.g: Mathematics"
          :class="inputClass()"
          data-testid="subject-name-en"
        />
      </div>

      <div>
        <label for="subject-code" :class="FORM_LABEL_CLASS"
          >Kod Subjek <span class="text-red-500">*</span></label
        >
        <input
          id="subject-code"
          v-model="form.code"
          type="text"
          name="code"
          required
          maxlength="20"
          placeholder="cth: MATH01"
          :class="[inputClass(), 'font-mono uppercase']"
          data-testid="subject-code"
        />
        <p :class="FORM_HINT_CLASS">
          <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Kod akan ditukar ke huruf besar automatik
        </p>
      </div>

      <div>
        <label for="subject-icon" :class="FORM_LABEL_CLASS">Ikon (Font Awesome)</label>
        <input
          id="subject-icon"
          v-model="form.icon"
          type="text"
          name="icon"
          placeholder="cth: fas fa-calculator"
          :class="inputClass()"
          data-testid="subject-icon-input"
        />
        <p :class="FORM_HINT_CLASS">
          <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span
            >Lihat ikon di
            <a
              href="https://fontawesome.com/icons"
              target="_blank"
              rel="noopener noreferrer"
              class="text-indigo-600 underline"
              data-testid="subject-icon-link"
              >Font Awesome</a
            ></span
          >
        </p>
      </div>

      <div>
        <label for="subject-color" :class="FORM_LABEL_CLASS">Warna Tema</label>
        <div class="flex items-center gap-3">
          <input
            id="subject-color"
            v-model="form.color"
            type="color"
            name="color"
            class="h-11 w-14 shrink-0 cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-1"
            data-testid="subject-color"
          />
          <input
            :value="form.color"
            type="text"
            name="colorText"
            readonly
            :class="[ACCENT_INPUT_CLASS.indigo, 'font-mono']"
            data-testid="subject-color-text"
          />
        </div>
      </div>

      <div>
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            v-model="form.isCore"
            type="checkbox"
            name="isCore"
            value="1"
            class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            data-testid="subject-core"
          />
          <span class="text-sm font-semibold text-slate-700">Subjek Teras (Core Subject)</span>
        </label>
        <p :class="FORM_HINT_CLASS">Tandakan jika subjek ini adalah subjek wajib</p>
      </div>

      <div>
        <label for="subject-order" :class="FORM_LABEL_CLASS">Susunan Paparan</label>
        <input
          id="subject-order"
          v-model.number="form.order"
          type="number"
          name="order"
          min="0"
          :class="inputClass()"
          data-testid="subject-order"
        />
        <p :class="FORM_HINT_CLASS">
          <ArrowUpDown class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nombor lebih kecil akan dipaparkan dahulu
        </p>
      </div>

      <fieldset class="min-w-0">
        <legend :class="FORM_LABEL_CLASS">Tahap Pendidikan Berkaitan</legend>
        <div
          class="max-h-64 overflow-y-auto rounded-xl border-2 border-slate-200 p-2"
          data-testid="subject-levels-box"
        >
          <label
            v-for="level in levels?.data ?? []"
            :key="level.id"
            class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <input
              v-model="form.educationLevelIds"
              type="checkbox"
              name="educationLevelIds"
              :value="level.id"
              class="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
              data-testid="subject-level-option"
            />
            <span>{{ level.name }} ({{ level.nameEn }})</span>
          </label>
        </div>
      </fieldset>

      <FormActions
        :cancel-to="SUBJECTS_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Subjek' : 'Simpan Subjek'"
        :saving="saving"
        accent="indigo"
      />
    </form>
  </div>
</template>
