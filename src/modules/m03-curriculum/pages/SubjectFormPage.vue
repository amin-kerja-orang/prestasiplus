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
import { AdminFormSection, AdminPageHeader } from '@/ds/admin'

import {
  createSubject,
  fetchAdminLevels,
  fetchAdminSubject,
  updateSubject,
  type SubjectInputBody,
} from '../api/admin-subjects-levels'
import { DsFormField, DsLoadError } from '@/ds'
import FormActions from '../components/subjects-levels/FormActions.vue'
import { COPY, SUBJECTS_LIST_PATH, errorLines, isNotFoundError } from '../lib/subjects-levels'

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
const {
  data: levels,
  error: levelsError,
  reload: reloadLevels,
} = useApi((signal) => fetchAdminLevels({ signal }))

// S8: GET /api/admin/subjects/:id pre-fills the form.
const {
  data: loaded,
  error: loadError,
  reload: reloadSubject,
} = useApi(
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

/** Retry of the load-error box: reload whatever failed. */
function retryLoad(): void {
  if (levelsError.value !== null) void reloadLevels()
  if (loadError.value !== null) void reloadSubject()
}

function toggleLevel(id: number, checked: boolean | 'indeterminate'): void {
  const rest = form.educationLevelIds.filter((v) => v !== id)
  form.educationLevelIds = checked === true ? [...rest, id] : rest
}
</script>
<template>
  <DsPage data-testid="subject-form-page">
    <AdminPageHeader
      :title="editing ? 'Edit Subjek' : 'Tambah Subjek'"
      :subtitle="editing ? 'Kemaskini maklumat subjek.' : 'Daftarkan subjek baharu.'"
    >
      <template #actions>
        <UButton
          :to="SUBJECTS_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          data-testid="subject-back"
        >
          Kembali ke Senarai
        </UButton>
      </template>
    </AdminPageHeader>

    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="subject-load-error"
      @retry="retryLoad()"
    />

    <form
      v-else-if="ready"
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="subject-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="subject-form-alert"
      >
        <template #description>
          <p v-for="(line, i) in errors" :key="i">{{ line }}</p>
        </template>
      </UAlert>

      <AdminFormSection
        title="Maklumat Subjek"
        description="Nama, kod dan susunan paparan."
        icon="i-ph-book"
      >
        <DsFormField
          v-slot="{ id: fid }"
          native
          for="subject-name"
          label="Nama Subjek (Bahasa Melayu)"
          required
        >
          <UInput
            :id="fid"
            v-model="form.name"
            type="text"
            name="name"
            required
            placeholder="cth: Matematik"
            class="w-full"
            data-testid="subject-name"
          />
        </DsFormField>

        <DsFormField v-slot="{ id: fid }" native for="subject-name-en" label="Nama Subjek (English)" required>
          <UInput
            :id="fid"
            v-model="form.nameEn"
            type="text"
            name="nameEn"
            required
            placeholder="e.g: Mathematics"
            class="w-full"
            data-testid="subject-name-en"
          />
        </DsFormField>

        <DsFormField
          v-slot="{ id: fid }"
          native
          for="subject-code"
          label="Kod Subjek"
          required
          hint="Kod akan ditukar ke huruf besar automatik"
        >
          <UInput
            :id="fid"
            v-model="form.code"
            type="text"
            name="code"
            required
            maxlength="20"
            placeholder="cth: MATH01"
            class="w-full"
            data-testid="subject-code"
          />
        </DsFormField>

        <DsFormField
          v-slot="{ id: fid }"
          native
          for="subject-order"
          label="Susunan Paparan"
          hint="Nombor lebih kecil akan dipaparkan dahulu"
        >
          <UInput
            :id="fid"
            v-model.number="form.order"
            type="number"
            name="order"
            min="0"
            class="w-full"
            data-testid="subject-order"
          />
        </DsFormField>
      </AdminFormSection>

      <AdminFormSection
        title="Penampilan"
        description="Ikon, warna tema dan jenis subjek."
        icon="i-ph-palette"
      >
        <DsFormField v-slot="{ id: fid }" native for="subject-icon" label="Ikon (Font Awesome)">
          <UInput
            :id="fid"
            v-model="form.icon"
            type="text"
            name="icon"
            placeholder="cth: fas fa-calculator"
            class="w-full"
            data-testid="subject-icon-input"
          />
          <p class="text-caption text-muted">
            Lihat ikon di
            <ULink
              :href="FONT_AWESOME_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary"
              data-testid="subject-icon-link"
              >Font Awesome</ULink
            >
          </p>
        </DsFormField>

        <DsFormField v-slot="{ id: fid }" native for="subject-color" label="Warna Tema">
          <div class="flex items-center gap-3">
            <UInput
              :id="fid"
              v-model="form.color"
              type="color"
              name="color"
              class="w-16 shrink-0"
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
        </DsFormField>

        <div class="min-w-0 md:col-span-2">
          <UCheckbox
            v-model="form.isCore"
            name="isCore"
            value="1"
            label="Subjek Teras (Core Subject)"
            data-testid="subject-core"
          />
          <p class="mt-2 text-label text-muted">Tandakan jika subjek ini adalah subjek wajib</p>
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Tahap Pendidikan Berkaitan"
        description="Pilih tahap yang mempunyai subjek ini."
        icon="i-ph-graduation-cap"
      >
        <fieldset class="min-w-0 md:col-span-2">
          <legend class="sr-only">Tahap Pendidikan Berkaitan</legend>
          <div
            class="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2"
            data-testid="subject-levels-box"
          >
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
        </fieldset>
      </AdminFormSection>

      <FormActions
        :cancel-to="SUBJECTS_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Subjek' : 'Simpan Subjek'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
