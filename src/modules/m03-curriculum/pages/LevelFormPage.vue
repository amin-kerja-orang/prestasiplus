<script setup lang="ts">
/**
 * S10 `/admin/education-levels/create` "Tambah Tahap Pendidikan - Admin PRESTASIPLUS" and S11
 * `/admin/education-levels/:id/edit` "Edit Tahap Pendidikan - Admin PRESTASIPLUS" (M03-T2;
 * FR-M03-63..68). One form for both: `mode="create"` posts a new level ("Simpan Tahap"),
 * `mode="edit"` loads it and pre-fills ("Kemaskini Tahap"). Pink accent (FR-57).
 *
 * Native HTML5 validation only. A server `VALIDATION_ERROR` shows in the red box above the form and
 * keeps the input. Success queues the flash (UNVERIFIED COPY, API `status`) and returns to S9. An
 * unknown id goes back to S9 with the one-time flash "Tahap Pendidikan tidak dijumpai." (FR-62).
 * No "Aktif" field (FR-68).
 */
import { ArrowLeft, ArrowUpDown, BookOpen, Info } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import {
  createLevel,
  fetchAdminLevel,
  updateLevel,
  type LevelInputBody,
} from '../api/admin-subjects-levels'
import type { EducationStage } from '../api/lookups'
import FormActions from '../components/subjects-levels/FormActions.vue'
import {
  ACCENT_INPUT_CLASS,
  COPY,
  FORM_HINT_CLASS,
  FORM_LABEL_CLASS,
  LEVELS_LIST_PATH,
  STAGE_OPTIONS,
  errorLines,
  isNotFoundError,
} from '../lib/subjects-levels'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: number }>(), { id: 0 })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')

interface LevelForm {
  name: string
  nameEn: string
  code: string
  stage: EducationStage | ''
  curriculum: string
  order: number | string
}

const form = reactive<LevelForm>({
  name: '',
  nameEn: '',
  code: '',
  stage: '',
  curriculum: '',
  order: 0,
})

// S11: GET /api/admin/education-levels/:id pre-fills the form.
const { data: loaded, error: loadError } = useApi(
  (signal) => fetchAdminLevel(props.id, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' },
)

watch(
  loaded,
  (level) => {
    if (!level) return
    form.name = level.name
    form.nameEn = level.nameEn
    form.code = level.code
    form.stage = level.stage
    form.curriculum = level.curriculum
    form.order = level.order
  },
  { immediate: true },
)

/** FR-62: an unknown level returns to S9 with the one-time error flash. */
watch(
  loadError,
  (err) => {
    if (err && isNotFoundError(err)) {
      flash.error(COPY.levelNotFound)
      void router.replace(LEVELS_LIST_PATH)
    }
  },
  { immediate: true },
)

const failed = computed(() => loadError.value !== null && !isNotFoundError(loadError.value))
const ready = computed(() => !editing.value || loaded.value !== null)

const saving = ref(false)
const errors = ref<string[]>([])

/** Server errors show only in the red box above the form (FR-27); no per-field marker. */
function inputClass(): string {
  return ACCENT_INPUT_CLASS.pink
}

async function submit(): Promise<void> {
  if (saving.value || form.stage === '') return
  saving.value = true
  errors.value = []
  const body: LevelInputBody = {
    name: form.name,
    nameEn: form.nameEn,
    code: form.code,
    stage: form.stage,
    curriculum: form.curriculum,
    order: form.order === '' ? 0 : Number(form.order),
  }
  try {
    const result = editing.value ? await updateLevel(props.id, body) : await createLevel(body)
    flash.success(result.status)
    await router.push(LEVELS_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="level-form-page">
    <RouterLink
      :to="LEVELS_LIST_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      data-testid="level-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke Senarai
    </RouterLink>

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="level-load-error" />

    <form
      v-else-if="ready"
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="level-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="errors" data-testid="level-form-alert" />

      <div>
        <label for="level-name" :class="FORM_LABEL_CLASS"
          >Nama Tahap (Bahasa Melayu) <span class="text-red-500">*</span></label
        >
        <input
          id="level-name"
          v-model="form.name"
          type="text"
          name="name"
          required
          placeholder="cth: Tahun 1"
          :class="inputClass()"
          data-testid="level-name"
        />
      </div>

      <div>
        <label for="level-name-en" :class="FORM_LABEL_CLASS"
          >Nama Tahap (English) <span class="text-red-500">*</span></label
        >
        <input
          id="level-name-en"
          v-model="form.nameEn"
          type="text"
          name="nameEn"
          required
          placeholder="e.g: Year 1"
          :class="inputClass()"
          data-testid="level-name-en"
        />
      </div>

      <div>
        <label for="level-code" :class="FORM_LABEL_CLASS"
          >Kod Tahap <span class="text-red-500">*</span></label
        >
        <input
          id="level-code"
          v-model="form.code"
          type="text"
          name="code"
          required
          maxlength="10"
          placeholder="cth: Y1"
          :class="[inputClass(), 'font-mono uppercase']"
          data-testid="level-code"
        />
        <p :class="FORM_HINT_CLASS">
          <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Kod akan ditukar ke huruf besar automatik
        </p>
      </div>

      <div>
        <label for="level-stage" :class="FORM_LABEL_CLASS"
          >Peringkat <span class="text-red-500">*</span></label
        >
        <select
          id="level-stage"
          v-model="form.stage"
          name="stage"
          required
          :class="inputClass()"
          data-testid="level-stage"
        >
          <option value="">-- Pilih Peringkat --</option>
          <option v-for="option in STAGE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div>
        <label for="level-curriculum" :class="FORM_LABEL_CLASS"
          >Kurikulum <span class="text-red-500">*</span></label
        >
        <input
          id="level-curriculum"
          v-model="form.curriculum"
          type="text"
          name="curriculum"
          required
          placeholder="cth: KSSR, KSSM"
          :class="inputClass()"
          data-testid="level-curriculum"
        />
        <p :class="FORM_HINT_CLASS">
          <BookOpen class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nama kurikulum yang diguna pakai
        </p>
      </div>

      <div>
        <label for="level-order" :class="FORM_LABEL_CLASS">Susunan Paparan</label>
        <input
          id="level-order"
          v-model.number="form.order"
          type="number"
          name="order"
          min="0"
          :class="inputClass()"
          data-testid="level-order"
        />
        <p :class="FORM_HINT_CLASS">
          <ArrowUpDown class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nombor lebih kecil akan dipaparkan dahulu
        </p>
      </div>

      <FormActions
        :cancel-to="LEVELS_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Tahap' : 'Simpan Tahap'"
        :saving="saving"
        accent="pink"
      />
    </form>
  </div>
</template>
