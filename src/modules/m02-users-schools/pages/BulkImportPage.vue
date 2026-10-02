<script setup lang="ts">
/**
 * S4 `/admin/users/bulk-import` "Import Pengguna Pukal" (M02-T6; FR-M02-51…56, BR-14). Hero card, then the
 * card "Borang Import Pengguna": role radio cards (none checked), the school picker for Guru / Admin,
 * "Kata Laluan Default" (pre-filled with the configured bulk default), "Kaedah Import" (CSV or paste), the
 * format box, "Kembali" and "Import"; the card "Nota Penting:" sits below.
 *
 * Native validation only, as live: the role radios are `required`; the school, the data and the rest are
 * server-validated (§5). "Import" calls `POST /api/admin/users/bulk-import`; success reloads S4 with the
 * green result flash (UNVERIFIED COPY, the API `status`) and the form reset; a `VALIDATION_ERROR` shows in the red alert above the form, input kept.
 */
import {
  ArrowLeft,
  Building,
  FileUp,
  Info,
  KeyRound,
  Lightbulb,
  LoaderCircle,
  Presentation,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
} from '@lucide/vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useFlash } from '@/composables'

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

const LABEL = 'mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700'
const CARD_BASE =
  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 peer-checked:border-transparent peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-indigo-600 peer-checked:text-white peer-checked:shadow-lg peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300'
</script>

<template>
  <div class="space-y-5" data-testid="bulk-import-page">
    <section
      class="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 shadow-sm sm:p-5"
      data-testid="bulk-hero"
    >
      <div class="flex items-start gap-3 sm:gap-4">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow"
        >
          <UsersRound class="h-6 w-6" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h3 class="text-base font-bold text-slate-800 sm:text-lg">Import Pengguna Pukal</h3>
          <p class="text-sm text-indigo-700">
            Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal.
          </p>
          <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700"
            >
              <Presentation class="h-3.5 w-3.5" aria-hidden="true" /> Guru
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-pink-700"
            >
              <Users class="h-3.5 w-3.5" aria-hidden="true" /> Ibu Bapa
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700"
            >
              <ShieldCheck class="h-3.5 w-3.5" aria-hidden="true" /> Admin
            </span>
          </div>
        </div>
      </div>
    </section>

    <form
      method="post"
      enctype="multipart/form-data"
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="bulk-form"
      @submit.prevent="submit"
    >
      <h2 class="mb-5 flex items-center gap-2 text-base font-bold text-slate-800">
        <FileUp class="h-5 w-5 text-indigo-500" aria-hidden="true" />
        Borang Import Pengguna
      </h2>

      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" class="mb-5" data-testid="bulk-alert" />
      </div>

      <div class="space-y-5">
        <fieldset>
          <legend :class="LABEL">
            <UserCheck class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Peranan Pengguna <span class="text-red-500">*</span>
          </legend>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label
              v-for="o in BULK_ROLE_OPTIONS"
              :key="o.value"
              class="block"
              :data-testid="`bulk-role-${o.value}`"
            >
              <input
                v-model="role"
                type="radio"
                name="role"
                :value="o.value"
                required
                class="peer sr-only"
              />
              <span :class="CARD_BASE">
                <Presentation v-if="o.icon === 'teacher'" class="h-4 w-4" aria-hidden="true" />
                <Users v-else-if="o.icon === 'parent'" class="h-4 w-4" aria-hidden="true" />
                <ShieldCheck v-else-if="o.icon === 'admin'" class="h-4 w-4" aria-hidden="true" />
                <Building v-else class="h-4 w-4" aria-hidden="true" />
                {{ o.label }}
              </span>
            </label>
          </div>
        </fieldset>

        <BulkSchoolPicker v-if="showSchool" v-model="school" />

        <div>
          <label for="bulk-default-password" :class="LABEL">
            <KeyRound class="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span>
              Kata Laluan Default
              <span class="text-xs font-normal text-slate-400"
                >(untuk pengguna tanpa kata laluan)</span
              >
            </span>
          </label>
          <input
            id="bulk-default-password"
            v-model="defaultPassword"
            type="text"
            name="default_password"
            autocomplete="off"
            :placeholder="configuredDefault"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="bulk-default-password"
          />
          <p class="mt-1 text-xs text-slate-500">
            Kata laluan jika tidak dinyatakan dalam data import.
          </p>
        </div>

        <ImportSourceFields
          v-model:mode="mode"
          v-model:paste="paste"
          v-model:file="file"
          accent="indigo"
          :paste-placeholder="BULK_PASTE_PLACEHOLDER"
        >
          <template #format>
            <div
              class="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-slate-600"
              data-testid="bulk-format"
            >
              <p class="mb-1 flex items-center gap-1.5 font-semibold text-blue-700">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
                Format CSV:
              </p>
              <p class="font-mono break-words text-blue-600">
                Nama, Emel, Telefon (pilihan), Kata Laluan (pilihan)
              </p>
              <p class="mt-1 font-mono break-words">
                Contoh: Muhammad Fulan bin Fulan, ahmad@email.com, 0123456789, pass123
              </p>
              <p class="mt-1">Baris pertama akan dilangkau jika ia mengandungi tajuk (header).</p>
            </div>
          </template>
        </ImportSourceFields>
      </div>

      <div
        class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
      >
        <RouterLink
          :to="USERS_LIST_PATH"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="bulk-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Kembali
        </RouterLink>
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="bulk-submit"
        >
          <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <UsersRound v-else class="h-4 w-4" aria-hidden="true" />
          Import
        </button>
      </div>
    </form>

    <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5" data-testid="bulk-notes">
      <h3 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Lightbulb class="h-4 w-4 text-amber-500" aria-hidden="true" />
        Nota Penting:
      </h3>
      <ul class="list-disc space-y-1 pl-9 text-sm text-slate-600">
        <li>Emel sedia ada akan dilangkau automatik</li>
        <li>Guru &amp; admin sekolah dikaitkan dengan sekolah dipilih</li>
        <li>Kata laluan boleh dinyatakan per-pengguna di lajur ke-4</li>
        <li>
          Pelajar DELIMa &rarr;
          <RouterLink
            :to="STUDENT_IMPORT_PATH"
            class="inline-flex min-h-11 items-center text-indigo-600 underline hover:text-indigo-800 sm:min-h-0"
            data-testid="bulk-students-link"
          >
            Import Pelajar
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
