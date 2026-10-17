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
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import {
  createSubject,
  fetchAdminLevels,
  fetchAdminSubject,
  updateSubject,
  type SubjectInputBody,
} from '../api/admin-subjects-levels'
import ErrorBox from '../components/ErrorBox.vue'
import NativeColor from '../components/native/NativeColor.vue'
import FormActions from '../components/subjects-levels/FormActions.vue'
import {
  COPY,
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
const FONT_AWESOME_URL = 'https://fontawesome.com/icons'

function toggleLevel(id: number, checked: boolean | 'indeterminate'): void {
  const rest = form.educationLevelIds.filter((v) => v !== id)
  form.educationLevelIds = checked === true ? [...rest, id] : rest
}
</script>
<template>
  <DsPage class="max-w-3xl" data-testid="subject-form-page">
    <div>
      <UButton
        :to="SUBJECTS_LIST_PATH"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        class="min-h-11"
        data-testid="subject-back"
      >
        Kembali ke Senarai
      </UButton>
    </div>

    <ErrorBox v-if="failed" :messages="COPY.loadFailed" data-testid="subject-load-error" />

    <form v-else-if="ready" method="post" data-testid="subject-form" @submit.prevent="submit">
      <UCard>
        <div class="flex min-w-0 flex-col gap-4">
          <ErrorBox :messages="errors" data-testid="subject-form-alert" />

          <div class="min-w-0">
            <label for="subject-name" class="mb-2 block text-label text-highlighted"
              >Nama Subjek (Bahasa Melayu) *</label
            >
            <UInput
              id="subject-name"
              v-model="form.name"
              type="text"
              name="name"
              required
              placeholder="cth: Matematik"
              class="w-full"
              data-testid="subject-name"
            />
          </div>

          <div class="min-w-0">
            <label for="subject-name-en" class="mb-2 block text-label text-highlighted"
              >Nama Subjek (English) *</label
            >
            <UInput
              id="subject-name-en"
              v-model="form.nameEn"
              type="text"
              name="nameEn"
              required
              placeholder="e.g: Mathematics"
              class="w-full"
              data-testid="subject-name-en"
            />
          </div>

          <div class="min-w-0">
            <label for="subject-code" class="mb-2 block text-label text-highlighted"
              >Kod Subjek *</label
            >
            <UInput
              id="subject-code"
              v-model="form.code"
              type="text"
              name="code"
              required
              maxlength="20"
              placeholder="cth: MATH01"
              class="w-full"
              data-testid="subject-code"
            />
            <p class="mt-1 flex items-start gap-2 text-caption text-muted">
              <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />
              Kod akan ditukar ke huruf besar automatik
            </p>
          </div>

          <div class="min-w-0">
            <label for="subject-icon" class="mb-2 block text-label text-highlighted"
              >Ikon (Font Awesome)</label
            >
            <UInput
              id="subject-icon"
              v-model="form.icon"
              type="text"
              name="icon"
              placeholder="cth: fas fa-calculator"
              class="w-full"
              data-testid="subject-icon-input"
            />
            <p class="mt-1 flex items-start gap-2 text-caption text-muted">
              <UIcon name="i-ph-lightbulb" class="mt-1 size-4 shrink-0" />
              <span
                >Lihat ikon di
                <ULink
                  :href="FONT_AWESOME_URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary"
                  data-testid="subject-icon-link"
                  >Font Awesome</ULink
                ></span
              >
            </p>
          </div>

          <div class="min-w-0">
            <label for="subject-color" class="mb-2 block text-label text-highlighted"
              >Warna Tema</label
            >
            <div class="flex items-center gap-3">
              <NativeColor
                id="subject-color"
                v-model="form.color"
                name="color"
                data-testid="subject-color"
              />
              <UInput
                :model-value="form.color"
                type="text"
                name="colorText"
                readonly
                aria-label="Kod warna"
                class="min-w-0 flex-1"
                data-testid="subject-color-text"
              />
            </div>
          </div>

          <div class="min-w-0">
            <UCheckbox
              v-model="form.isCore"
              name="isCore"
              value="1"
              label="Subjek Teras (Core Subject)"
              data-testid="subject-core"
            />
            <p class="mt-1 text-caption text-muted">Tandakan jika subjek ini adalah subjek wajib</p>
          </div>

          <div class="min-w-0">
            <label for="subject-order" class="mb-2 block text-label text-highlighted"
              >Susunan Paparan</label
            >
            <UInput
              id="subject-order"
              v-model.number="form.order"
              type="number"
              name="order"
              min="0"
              class="w-full"
              data-testid="subject-order"
            />
            <p class="mt-1 flex items-start gap-2 text-caption text-muted">
              <UIcon name="i-ph-arrows-down-up" class="mt-1 size-4 shrink-0" />
              Nombor lebih kecil akan dipaparkan dahulu
            </p>
          </div>

          <fieldset class="min-w-0">
            <legend class="mb-2 text-label text-highlighted">Tahap Pendidikan Berkaitan</legend>
            <UCard variant="subtle" :ui="{ body: 'p-2 sm:p-2' }" data-testid="subject-levels-box">
              <div class="max-h-64 overflow-y-auto">
                <div
                  v-for="level in levels?.data ?? []"
                  :key="level.id"
                  class="flex min-h-11 items-center"
                >
                  <UCheckbox
                    :model-value="form.educationLevelIds.includes(level.id)"
                    name="educationLevelIds"
                    :value="level.id"
                    :label="`${level.name} (${level.nameEn})`"
                    data-testid="subject-level-option"
                    @update:model-value="toggleLevel(level.id, $event)"
                  />
                </div>
              </div>
            </UCard>
          </fieldset>

          <FormActions
            :cancel-to="SUBJECTS_LIST_PATH"
            :submit-label="editing ? 'Kemaskini Subjek' : 'Simpan Subjek'"
            :saving="saving"
          />
        </div>
      </UCard>
    </form>
  </DsPage>
</template>
