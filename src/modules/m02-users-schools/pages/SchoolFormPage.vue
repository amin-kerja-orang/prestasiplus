<script setup lang="ts">
/**
 * S10 `/admin/schools/create` "Tambah Sekolah" and S11 `/admin/schools/:id/edit` "Edit Sekolah"
 * (M02-T8; FR-M02-80, FR-M02-81), v2 staff theme. One form for both: `mode="create"` posts a new school
 * ("Simpan", "Sekolah Aktif" on by default), `mode="edit"` loads the school, pre-fills it and puts its name
 * in the shell header subtitle ("Kemaskini").
 *
 * Native HTML5 validation only (`required`, no `novalidate`; design-system 7.2). A server
 * `VALIDATION_ERROR` (e.g. a duplicate code) shows in the red alert above the form, marks the field
 * and keeps the input. Success queues the flash (UNVERIFIED COPY, from the API `status`) and goes
 * back to the list.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { DsPage } from '@/ds'

import {
  createSchool,
  fetchAdminSchool,
  updateSchool,
  type SchoolInputBody,
  type SchoolType,
} from '../api/schools-admin'
import AdminAlert from '../components/AdminAlert.vue'
import AdminField from '../components/AdminField.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
import UserFormSwitch from '../components/UserFormSwitch.vue'
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
</script>

<template>
  <DsPage data-testid="school-form-page">
    <div>
      <UButton
        :to="SCHOOLS_LIST_PATH"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        label="Kembali ke Senarai Sekolah"
        data-testid="school-back"
      />
    </div>

    <!-- S11 could not load the school (unknown id): red box + the way back. INFERRED. -->
    <div
      v-if="editing && loadError && !notFound"
      class="flex flex-col gap-3"
      data-testid="school-load-error"
    >
      <AdminAlert :messages="errorLines(loadError)" />
      <div>
        <UButton label="Cuba Lagi" @click="reloadSchool()" />
      </div>
    </div>

    <UCard v-else-if="!ready && !notFound" class="max-w-3xl" data-testid="school-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </UCard>

    <UCard v-else-if="!notFound" class="max-w-3xl">
      <form
        method="post"
        class="flex min-w-0 flex-col gap-6"
        data-testid="school-form"
        @submit.prevent="submit"
      >
        <AdminAlert :messages="errors" data-testid="school-form-alert" />

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <AdminField for="school-name" label="Nama Sekolah" required :error="fieldMessages.name">
              <UInput
                id="school-name"
                v-model="form.name"
                type="text"
                name="name"
                required
                placeholder="cth: SK TAMAN KLUANG BARU"
                :color="invalid('name') ? 'error' : undefined"
                size="lg"
                class="w-full"
                data-testid="school-name"
              />
            </AdminField>
          </div>

          <div class="sm:col-span-2">
            <AdminField for="school-code" label="Kod Sekolah" required :error="fieldMessages.code">
              <UInput
                id="school-code"
                v-model="form.code"
                type="text"
                name="code"
                required
                placeholder="cth: JBA1234"
                :color="invalid('code') ? 'error' : undefined"
                size="lg"
                class="w-full"
                data-testid="school-code"
              />
            </AdminField>
          </div>

          <AdminField for="school-type" label="Jenis" required :error="fieldMessages.type">
            <NativeSelect
              id="school-type"
              v-model="form.type"
              name="type"
              required
              :aria-invalid="invalid('type') ? 'true' : undefined"
              data-testid="school-type"
            >
              <option value="">Pilih jenis</option>
              <option v-for="type in SCHOOL_TYPE_OPTIONS" :key="type" :value="type">
                {{ type }}
              </option>
            </NativeSelect>
          </AdminField>

          <AdminField for="school-state" label="Negeri" required :error="fieldMessages.state">
            <NativeSelect
              id="school-state"
              v-model="form.state"
              name="state"
              required
              :aria-invalid="invalid('state') ? 'true' : undefined"
              data-testid="school-state"
            >
              <option value="">Pilih negeri</option>
              <option v-for="name in SCHOOL_STATE_OPTIONS" :key="name" :value="name">
                {{ name }}
              </option>
            </NativeSelect>
          </AdminField>

          <AdminField for="school-district" label="Daerah" :error="fieldMessages.district">
            <UInput
              id="school-district"
              v-model="form.district"
              type="text"
              name="district"
              placeholder="cth: KLUANG"
              :color="invalid('district') ? 'error' : undefined"
              size="lg"
              class="w-full"
              data-testid="school-district"
            />
          </AdminField>

          <AdminField for="school-city" label="Bandar" :error="fieldMessages.city">
            <UInput
              id="school-city"
              v-model="form.city"
              type="text"
              name="city"
              placeholder="cth: KLUANG"
              :color="invalid('city') ? 'error' : undefined"
              size="lg"
              class="w-full"
              data-testid="school-city"
            />
          </AdminField>

          <div class="sm:col-span-2">
            <UserFormSwitch
              v-model="form.isActive"
              name="is_active"
              label="Sekolah Aktif"
              testid="school-active"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton
            type="submit"
            icon="i-ph-floppy-disk"
            :label="editing ? 'Kemaskini' : 'Simpan'"
            :loading="saving"
            :disabled="saving"
            data-testid="school-submit"
          />
          <UButton
            :to="SCHOOLS_LIST_PATH"
            color="neutral"
            variant="soft"
            label="Batal"
            data-testid="school-cancel"
          />
        </div>
      </form>
    </UCard>
  </DsPage>
</template>
