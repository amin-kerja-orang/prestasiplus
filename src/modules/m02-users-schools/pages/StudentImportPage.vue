<script setup lang="ts">
/**
 * S5 `/admin/import-students` "Import Pelajar (ID Delima)" (M02-T6; FR-M02-57…64, BR-15…17). Hero card, then
 * the card "Borang Import Pelajar": the school picker (chip once chosen), the quota panel, the existing
 * students toggle, the class radio cards, "Kaedah Import" (CSV or paste), "Kembali" (to `/admin`, as live)
 * and "Import"; the card "Nota Penting:" sits below.
 *
 * Choosing a school loads its quota (`GET .../quota`; a failed request reads as "no subscription", console
 * "Quota fetch error:") and narrows the class cards (SK, SJK(C), SJK(T) show Darjah, others Tingkatan; a
 * checked card that becomes hidden is unchecked). "Import" is never disabled by the quota (as live): the
 * server refuses with the red alert (no subscription, quota short), input kept. Success reloads S5 with the
 * green result flash (UNVERIFIED COPY, the API `status`) and the form
 * reset. The school is server-validated (the hidden `school_id` is not browser-checked, §5).
 */
import {
  ArrowLeft,
  FileUp,
  GraduationCap,
  IdCard,
  KeyRound,
  Landmark,
  Lightbulb,
  Mail,
  Info,
  LoaderCircle,
  School,
  UsersRound,
} from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useFlash } from '@/composables'

import {
  fetchSchoolQuota,
  importStudents,
  type ImportClassLevel,
  type ImportMode,
  type SchoolQuota,
} from '../api/imports'
import type { SchoolSummary } from '../api/schools'
import AdminSchoolPicker from '../components/AdminSchoolPicker.vue'
import ExistingStudentsPanel from '../components/ExistingStudentsPanel.vue'
import ImportSourceFields from '../components/ImportSourceFields.vue'
import QuotaPanel from '../components/QuotaPanel.vue'
import {
  classLevelInGroups,
  DELIMA_PASTE_PLACEHOLDER,
  PRIMARY_CLASS_LEVELS,
  SECONDARY_CLASS_LEVELS,
  visibleClassGroups,
} from '../lib/import-options'
import { errorLines } from '../lib/user-form-errors'

const flash = useFlash()

const school = ref<SchoolSummary | null>(null)
const quota = ref<SchoolQuota | null>(null)
const quotaLoading = ref(false)
const classLevel = ref<ImportClassLevel | ''>('')
const mode = ref<ImportMode>('paste')
const paste = ref('')
const file = ref<File | null>(null)

const submitting = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

const groups = computed(() => visibleClassGroups(school.value?.type ?? null))
let quotaController: AbortController | null = null

async function loadQuota(id: number): Promise<void> {
  quotaController?.abort()
  const current = new AbortController()
  quotaController = current
  quota.value = null
  quotaLoading.value = true
  try {
    const q = await fetchSchoolQuota(id, { signal: current.signal })
    if (quotaController === current) quota.value = q
  } catch (err) {
    if (quotaController !== current) return
    quota.value = null
    console.error('Quota fetch error:', err)
  } finally {
    if (quotaController === current) {
      quotaLoading.value = false
      quotaController = null
    }
  }
}

// FR-M02-58, 59, 61: choosing a school checks its quota; a checked card that becomes hidden is unchecked.
watch(school, (next) => {
  if (next) void loadQuota(next.id)
  else {
    quotaController?.abort()
    quotaController = null
    quota.value = null
    quotaLoading.value = false
  }
  if (!classLevelInGroups(classLevel.value, groups.value)) classLevel.value = ''
})

function reset(): void {
  school.value = null
  classLevel.value = ''
  mode.value = 'paste'
  paste.value = ''
  file.value = null
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  try {
    const result = await importStudents({
      schoolId: school.value?.id ?? null,
      classLevel: classLevel.value,
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
const CARD =
  'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 peer-checked:border-transparent peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-orange-500 peer-checked:text-white peer-checked:shadow-lg peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300'
</script>

<template>
  <div class="space-y-5" data-testid="student-import-page">
    <section
      class="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm sm:p-5"
      data-testid="student-hero"
    >
      <div class="flex items-start gap-3 sm:gap-4">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow"
        >
          <IdCard class="h-6 w-6" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h3 class="text-base font-bold text-slate-800 sm:text-lg">
            Import Pelajar via ID Delima
          </h3>
          <p class="text-sm text-amber-800">
            Import pelajar dari Darjah 1 hingga Tingkatan 5 menggunakan ID Delima KPM.
          </p>
          <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              class="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-amber-800"
            >
              <KeyRound class="h-3.5 w-3.5" aria-hidden="true" /> Kata laluan DELIMa
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-orange-800"
            >
              <Mail class="h-3.5 w-3.5" aria-hidden="true" /> Email DELIMa
            </span>
          </div>
        </div>
      </div>
    </section>

    <form
      method="post"
      enctype="multipart/form-data"
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="student-form"
      @submit.prevent="submit"
    >
      <h2 class="mb-5 flex items-center gap-2 text-base font-bold text-slate-800">
        <FileUp class="h-5 w-5 text-indigo-500" aria-hidden="true" />
        Borang Import Pelajar
      </h2>

      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" class="mb-5" data-testid="student-alert" />
      </div>

      <div class="space-y-5">
        <div class="space-y-3">
          <!-- The shared S3 picker's label gets the live required star (FR-M02-58 "Sekolah *"). -->
          <div
            class="[&_label]:after:ml-1 [&_label]:after:text-red-500 [&_label]:after:content-['*']"
          >
            <AdminSchoolPicker v-model="school" />
          </div>
          <QuotaPanel v-if="school" :loading="quotaLoading" :quota="quota" />
          <ExistingStudentsPanel
            v-if="school && !quotaLoading && quota?.hasSubscription && (quota.used ?? 0) > 0"
            :key="school.id"
            :school-id="school.id"
            :school-type="school.type"
            :used="quota.used ?? 0"
          />
        </div>

        <fieldset data-testid="student-classes">
          <legend :class="LABEL">
            <GraduationCap class="h-4 w-4 text-blue-500" aria-hidden="true" />
            Darjah / Tingkatan <span class="text-red-500">*</span>
          </legend>
          <div v-if="groups.includes('primary')" class="mb-3" data-testid="class-group-primary">
            <p
              class="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-emerald-600 uppercase"
            >
              <School class="h-4 w-4" aria-hidden="true" />
              Sekolah Rendah
            </p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label v-for="o in PRIMARY_CLASS_LEVELS" :key="o.value" class="block">
                <input
                  v-model="classLevel"
                  type="radio"
                  name="class_level"
                  :value="o.value"
                  class="peer sr-only"
                />
                <span :class="CARD">{{ o.label }}</span>
              </label>
            </div>
          </div>
          <div v-if="groups.includes('secondary')" data-testid="class-group-secondary">
            <p
              class="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-blue-600 uppercase"
            >
              <Landmark class="h-4 w-4" aria-hidden="true" />
              Sekolah Menengah
            </p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <label v-for="o in SECONDARY_CLASS_LEVELS" :key="o.value" class="block">
                <input
                  v-model="classLevel"
                  type="radio"
                  name="class_level"
                  :value="o.value"
                  class="peer sr-only"
                />
                <span :class="CARD">{{ o.label }}</span>
              </label>
            </div>
          </div>
        </fieldset>

        <ImportSourceFields
          v-model:mode="mode"
          v-model:paste="paste"
          v-model:file="file"
          accent="amber"
          :paste-placeholder="DELIMA_PASTE_PLACEHOLDER"
        >
          <template #format="{ mode: current }">
            <div
              v-if="current === 'csv'"
              class="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-slate-600"
              data-testid="student-format-csv"
            >
              <p class="mb-1 flex items-center gap-1.5 font-semibold text-blue-700">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
                Format CSV:
              </p>
              <p class="font-mono break-words text-blue-600">
                Nama, Email DELIMa, Kata Laluan, No KP (pilihan)
              </p>
              <p class="mt-1 font-mono break-words">
                Contoh: Muhammad Fulan bin Fulan, m-XXXXXXXX@moe-dl.edu.my, katalaluan123,
                031215101234
              </p>
            </div>
            <div
              v-else
              class="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs"
              data-testid="student-format-paste"
            >
              <p class="mb-1 flex items-center gap-1.5 font-semibold text-blue-700">
                <Info class="h-3.5 w-3.5" aria-hidden="true" />
                Format DELIMa (3-4 baris per pelajar):
              </p>
              <p class="font-mono text-blue-600">NAMA PELAJAR</p>
              <p class="font-mono break-all text-emerald-700">m-XXXXXXXX@moe-dl.edu.my</p>
              <p class="font-mono text-orange-700">katalaluan123</p>
              <p class="font-mono text-purple-700">
                031215101234 <span class="text-slate-400">(No. KP — pilihan)</span>
              </p>
            </div>
          </template>
        </ImportSourceFields>
      </div>

      <div
        class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
      >
        <RouterLink
          to="/admin"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          data-testid="student-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Kembali
        </RouterLink>
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-white shadow transition hover:from-amber-600 hover:to-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="student-submit"
        >
          <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <UsersRound v-else class="h-4 w-4" aria-hidden="true" />
          Import
        </button>
      </div>
    </form>

    <section
      class="rounded-2xl border border-slate-200 bg-slate-50 p-5"
      data-testid="student-notes"
    >
      <h3 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Lightbulb class="h-4 w-4 text-amber-500" aria-hidden="true" />
        Nota Penting:
      </h3>
      <ul class="list-disc space-y-1 pl-9 text-sm text-slate-600">
        <li>
          Pelajar login guna <strong>email DELIMa</strong> dan <strong>kata laluan DELIMa</strong>
        </li>
        <li>ID yang sudah wujud akan dilangkau automatik</li>
        <li>Nama pelajar akan ditukar ke Title Case</li>
      </ul>
    </section>
  </div>
</template>
