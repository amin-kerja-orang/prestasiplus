<script setup lang="ts">
/**
 * S4 `/admin/users/bulk-import` "Import Pengguna Pukal" (M02-T6; FR-M02-51…56, BR-14), v2 staff theme. Hero
 * card, then the card "Borang Import Pengguna": role radio cards (none checked), the school picker for
 * Guru / Admin, "Kata Laluan Default" (pre-filled with the configured bulk default), "Kaedah Import" (CSV
 * or paste), the format box, "Kembali" and "Import"; the card "Nota Penting:" sits below.
 *
 * Native validation only, as live: the role radios are `required`; the school, the data and the rest are
 * server-validated (5). "Import" calls `POST /api/admin/users/bulk-import`; success reloads S4 with the
 * green result flash (UNVERIFIED COPY, the API `status`) and the form reset; a `VALIDATION_ERROR` shows in
 * the red alert above the form, input kept.
 */
import { computed, nextTick, onMounted, ref } from 'vue'

import { useFlash } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsIconChip, DsPage, DsPanel } from '@/ds'

import { importUsers, type BulkImportRole, type ImportMode } from '../api/imports'
import type { SchoolSummary } from '../api/schools'
import { fetchAdminDefaults } from '../api/users'
import BulkSchoolPicker from '../components/BulkSchoolPicker.vue'
import ImportSourceFields from '../components/ImportSourceFields.vue'
import {
  BULK_PASTE_PLACEHOLDER,
  BULK_ROLE_OPTIONS,
  roleNeedsSchool,
  STUDENT_IMPORT_PATH,
} from '../lib/import-options'
import { errorLines } from '../lib/user-form-errors'
import { USERS_LIST_PATH } from '../lib/user-form-options'

const flash = useFlash()

const role = ref<BulkImportRole | ''>('')
const school = ref<SchoolSummary | null>(null)
const configuredDefault = ref('')
const defaultPassword = ref('')
const mode = ref<ImportMode>('paste')
const paste = ref('')
const file = ref<File | null>(null)

const submitting = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

const showSchool = computed(() => roleNeedsSchool(role.value))

onMounted(() => {
  // FR-M02-53: the value and the placeholder are the configured bulk default; a failure leaves both empty.
  fetchAdminDefaults().then(
    (d) => {
      configuredDefault.value = d.bulkImportDefaultPassword
      if (defaultPassword.value === '') defaultPassword.value = d.bulkImportDefaultPassword
    },
    () => undefined,
  )
})

function reset(): void {
  role.value = ''
  school.value = null
  defaultPassword.value = configuredDefault.value
  mode.value = 'paste'
  paste.value = ''
  file.value = null
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  try {
    const result = await importUsers({
      role: role.value,
      schoolId: showSchool.value ? (school.value?.id ?? null) : null,
      defaultPassword: defaultPassword.value,
      importMode: mode.value,
      csvFile: mode.value === 'csv' ? file.value : null,
      pasteContent: mode.value === 'paste' ? paste.value : null,
    })
    reset()
    flash.show({ type: 'success', message: result.status })
    window.scrollTo?.({ top: 0 })
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    submitting.value = false
  }
}

const roleItems = computed(() =>
  BULK_ROLE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    icon: ROLE_ICONS[o.icon] ?? 'i-ph-buildings',
  })),
)
const ROLE_ICONS: Record<string, string> = {
  teacher: 'i-ph-chalkboard-teacher',
  parent: 'i-ph-users',
  admin: 'i-ph-shield-check',
  ppd: 'i-ph-buildings',
}
</script>

<template>
  <DsPage
    title="Import Pengguna Pukal"
    subtitle="Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal."
    :back-to="USERS_LIST_PATH"
    data-testid="bulk-import-page"
  >
    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
      <form
        method="post"
        enctype="multipart/form-data"
        class="flex min-w-0 flex-col gap-6 xl:col-span-2"
        data-testid="bulk-form"
        @submit.prevent="submit"
      >
        <h2 class="sr-only">Borang Import Pengguna</h2>

        <div ref="alertBox" class="empty:hidden">
          <UAlert
            v-if="errors.length > 0"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            role="alert"
            data-testid="bulk-alert"
          >
            <template #description>
              <div class="flex flex-col gap-1">
                <p v-for="m in errors" :key="m">{{ m }}</p>
              </div>
            </template>
          </UAlert>
        </div>

        <DsFormSection
          title="Peranan dan Sekolah"
          description="Pilih jenis pengguna dan sekolah mereka."
          icon="user-check"
          :columns="2"
        >
          <div class="flex min-w-0 flex-col gap-3 sm:col-span-2">
            <p class="text-label text-default">
              Peranan Pengguna <span class="text-error">*</span>
            </p>
            <URadioGroup
              :model-value="role === '' ? undefined : role"
              :items="roleItems"
              legend="Peranan Pengguna"
              name="role"
              required
              variant="card"
              color="info"
              indicator="hidden"
              orientation="horizontal"
              :ui="{
                fieldset: 'grid grid-cols-2 gap-3 md:grid-cols-4',
                item: 'min-h-11 items-center justify-center p-2 text-center',
                wrapper: 'w-full text-center',
                legend: 'sr-only',
              }"
              @update:model-value="(v) => (role = v as BulkImportRole)"
            >
            </URadioGroup>
          </div>

          <div v-if="showSchool" class="sm:col-span-2">
            <BulkSchoolPicker v-model="school" />
          </div>

          <div class="sm:col-span-2">
            <DsFormField
              native
              for="bulk-default-password"
              label="Kata Laluan Default (untuk pengguna tanpa kata laluan)"
              hint="Kata laluan jika tidak dinyatakan dalam data import."
            >
              <UInput
                id="bulk-default-password"
                v-model="defaultPassword"
                type="text"
                name="default_password"
                autocomplete="off"
                :placeholder="configuredDefault"
                class="w-full"
                data-testid="bulk-default-password"
              />
            </DsFormField>
          </div>
        </DsFormSection>

        <DsFormSection
          title="Data Pengguna"
          description="Muat naik CSV atau tampal data secara manual."
          icon="file-arrow-up"
          :columns="2"
        >
          <div class="sm:col-span-2">
            <ImportSourceFields
              v-model:mode="mode"
              v-model:paste="paste"
              v-model:file="file"
              :paste-placeholder="BULK_PASTE_PLACEHOLDER"
            >
              <template #format>
                <DsPanel tone="inset" data-testid="bulk-format">
                  <div class="flex flex-col gap-1 text-label text-muted">
                    <p class="flex items-center gap-2 text-body text-default">
                      <UIcon name="i-ph-info" class="size-4" aria-hidden="true" />
                      Format CSV:
                    </p>
                    <p class="break-words">Nama, Emel, Telefon (pilihan), Kata Laluan (pilihan)</p>
                    <p class="break-words">
                      Contoh: Muhammad Fulan bin Fulan, ahmad@email.com, 0123456789, pass123
                    </p>
                    <p>Baris pertama akan dilangkau jika ia mengandungi tajuk (header).</p>
                  </div>
                </DsPanel>
              </template>
            </ImportSourceFields>
          </div>
        </DsFormSection>

        <DsFormBar
          :show-cancel="false"
          submit-label="Import"
          submit-icon="i-ph-users-three"
          :saving="submitting"
          data-testid="bulk-footer"
        />
      </form>

      <aside class="flex min-w-0 flex-col gap-6">
        <DsPanel padding="none" data-testid="bulk-hero">
          <div class="flex flex-col gap-4 p-4 sm:p-6">
            <div class="flex items-center gap-4">
              <DsIconChip icon="users-three" size="lg" />
              <h3 class="text-subheading text-highlighted">Jenis pengguna</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge
                color="neutral"
                variant="subtle"
                size="lg"
                icon="i-ph-chalkboard-teacher"
                label="Guru"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                size="lg"
                icon="i-ph-users"
                label="Ibu Bapa"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                size="lg"
                icon="i-ph-shield-check"
                label="Admin"
              />
            </div>
          </div>
        </DsPanel>

        <DsPanel padding="none" data-testid="bulk-notes">
          <div class="p-4 sm:p-6">
            <h3 class="mb-3 flex items-center gap-2 text-body text-highlighted">
              <UIcon name="i-ph-lightbulb" class="size-5 text-muted" aria-hidden="true" />
              Nota Penting:
            </h3>
            <ul class="flex flex-col gap-2 text-body text-muted">
              <li>• Emel sedia ada akan dilangkau automatik</li>
              <li>• Guru &amp; admin sekolah dikaitkan dengan sekolah dipilih</li>
              <li>• Kata laluan boleh dinyatakan per-pengguna di lajur ke-4</li>
              <li>
                • Pelajar DELIMa &rarr;
                <ULink
                  :to="STUDENT_IMPORT_PATH"
                  class="text-primary-t"
                  data-testid="bulk-students-link"
                >
                  Import Pelajar
                </ULink>
              </li>
            </ul>
          </div>
        </DsPanel>
      </aside>
    </div>
  </DsPage>
</template>
