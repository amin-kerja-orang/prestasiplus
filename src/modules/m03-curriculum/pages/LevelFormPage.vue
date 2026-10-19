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
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsFormSection, DsPage, DsPageHeader } from '@/ds'

import {
  createLevel,
  fetchAdminLevel,
  updateLevel,
  type LevelInputBody,
} from '../api/admin-subjects-levels'
import type { EducationStage } from '../api/lookups'
import { DsFormField, DsLoadError, DsNativeSelect } from '@/ds'
import FormActions from '../components/subjects-levels/FormActions.vue'
import {
  COPY,
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
const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
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
  <DsPage data-testid="level-form-page">
    <DsPageHeader
      :title="editing ? 'Edit Tahap Pendidikan' : 'Tambah Tahap Pendidikan'"
      :subtitle="editing ? 'Kemaskini maklumat tahap.' : 'Daftarkan tahap pendidikan baharu.'"
    >
      <template #actions>
        <UButton
          :to="LEVELS_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          data-testid="level-back"
        >
          Kembali ke Senarai
        </UButton>
      </template>
    </DsPageHeader>

    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="level-load-error"
      @retry="reload()"
    />

    <form
      v-else-if="ready"
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="level-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="level-form-alert"
      >
        <template #description>
          <p v-for="(line, i) in errors" :key="i">{{ line }}</p>
        </template>
      </UAlert>

      <DsFormSection
        title="Maklumat Tahap"
        description="Nama, kod, peringkat dan kurikulum."
        icon="graduation-cap"
        :columns="2"
      >
        <DsFormField
          v-slot="{ id: fid }"
          native
          for="level-name"
          label="Nama Tahap (Bahasa Melayu)"
          required
        >
          <UInput
            :id="fid"
            v-model="form.name"
            type="text"
            name="name"
            required
            placeholder="cth: Tahun 1"
            class="w-full"
            data-testid="level-name"
          />
        </DsFormField>

        <DsFormField v-slot="{ id: fid }" native for="level-name-en" label="Nama Tahap (English)" required>
          <UInput
            :id="fid"
            v-model="form.nameEn"
            type="text"
            name="nameEn"
            required
            placeholder="e.g: Year 1"
            class="w-full"
            data-testid="level-name-en"
          />
        </DsFormField>

        <DsFormField
          v-slot="{ id: fid }"
          native
          for="level-code"
          label="Kod Tahap"
          required
          hint="Kod akan ditukar ke huruf besar automatik"
        >
          <UInput
            :id="fid"
            v-model="form.code"
            type="text"
            name="code"
            required
            maxlength="10"
            placeholder="cth: Y1"
            class="w-full"
            data-testid="level-code"
          />
        </DsFormField>

        <DsFormField v-slot="{ id: fid }" native for="level-stage" label="Peringkat" required>
          <DsNativeSelect
            :id="fid"
            v-model="form.stage"
            name="stage"
            required
            data-testid="level-stage"
          >
            <option value="">-- Pilih Peringkat --</option>
            <option v-for="option in STAGE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField
          v-slot="{ id: fid }"
          native
          for="level-curriculum"
          label="Kurikulum"
          required
          hint="Nama kurikulum yang diguna pakai"
        >
          <UInput
            :id="fid"
            v-model="form.curriculum"
            type="text"
            name="curriculum"
            required
            placeholder="cth: KSSR, KSSM"
            class="w-full"
            data-testid="level-curriculum"
          />
        </DsFormField>

        <DsFormField
          v-slot="{ id: fid }"
          native
          for="level-order"
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
            data-testid="level-order"
          />
        </DsFormField>
      </DsFormSection>

      <FormActions
        :cancel-to="LEVELS_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Tahap' : 'Simpan Tahap'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
