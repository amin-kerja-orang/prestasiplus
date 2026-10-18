<script setup lang="ts">
/**
 * S5 `/admin/import-students` "Import Pelajar (ID Delima)" (M02-T6; FR-M02-57…64, BR-15…17), v2 staff theme.
 * Hero card, then the card "Borang Import Pelajar": the school picker (chip once chosen), the quota panel,
 * the existing students toggle, the class radio cards, "Kaedah Import" (CSV or paste), "Kembali" (to
 * `/admin`, as live) and "Import"; the card "Nota Penting:" sits below.
 *
 * Choosing a school loads its quota (`GET .../quota`; a failed request reads as "no subscription", console
 * "Quota fetch error:") and narrows the class cards (SK, SJK(C), SJK(T) show Darjah, others Tingkatan; a
 * checked card that becomes hidden is unchecked). "Import" is never disabled by the quota (as live): the
 * server refuses with the red alert (no subscription, quota short), input kept. Success reloads S5 with the
 * green result flash (UNVERIFIED COPY, the API `status`) and the form
 * reset. The school is server-validated (the hidden `school_id` is not browser-checked, 5).
 */
import { computed, nextTick, ref, watch } from 'vue'

import { useFlash } from '@/composables'
import { DsFormBar, DsFormSection, DsIconChip, DsPage, DsPanel } from '@/ds'

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

function levelItems(levels: readonly { value: string; label: string }[]) {
  return levels.map((o) => ({ value: o.value, label: o.label }))
}
/** One logical choice over two radio groups: a group shows the pick only when it holds it. */
function levelIn(levels: readonly { value: string }[]): string | undefined {
  return levels.some((o) => o.value === classLevel.value) ? classLevel.value : undefined
}
function pickLevel(value: unknown): void {
  if (typeof value === 'string') classLevel.value = value as ImportClassLevel
}
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
</script>

<template>
  <DsPage
    title="Import Pelajar via ID Delima"
    subtitle="Import pelajar dari Darjah 1 hingga Tingkatan 5 menggunakan ID Delima KPM."
    :back-to="'/admin'"
    data-testid="student-import-page"
  >
    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
      <form
        method="post"
        enctype="multipart/form-data"
        class="flex min-w-0 flex-col gap-6 xl:col-span-2"
        data-testid="student-form"
        @submit.prevent="submit"
      >
        <h2 class="sr-only">Borang Import Pelajar</h2>

        <div ref="alertBox" class="empty:hidden">
          <UAlert
            v-if="errors.length > 0"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            role="alert"
            data-testid="student-alert"
          >
            <template #description>
              <div class="flex flex-col gap-1">
                <p v-for="m in errors" :key="m">{{ m }}</p>
              </div>
            </template>
          </UAlert>
        </div>

        <DsFormSection
          title="Sekolah"
          description="Pilih sekolah dan semak kuota pelajar."
          icon="buildings"
          accent="win"
          :columns="2"
        >
          <div class="flex flex-col gap-4 sm:col-span-2">
            <AdminSchoolPicker v-model="school" required />
            <QuotaPanel v-if="school" :loading="quotaLoading" :quota="quota" />
            <ExistingStudentsPanel
              v-if="school && !quotaLoading && quota?.hasSubscription && (quota.used ?? 0) > 0"
              :key="school.id"
              :school-id="school.id"
              :school-type="school.type"
              :used="quota.used ?? 0"
            />
          </div>
        </DsFormSection>

        <DsFormSection
          title="Darjah / Tingkatan"
          description="Pilih tahap pelajar yang diimport."
          icon="graduation-cap"
          accent="heat"
          :columns="2"
        >
          <div class="flex min-w-0 flex-col gap-4 sm:col-span-2" data-testid="student-classes">
            <p class="sr-only">Darjah / Tingkatan <span class="text-error">*</span></p>
            <div
              v-if="groups.includes('primary')"
              class="flex flex-col gap-3"
              data-testid="class-group-primary"
            >
              <p class="flex items-center gap-2 text-label text-muted">
                <UIcon name="i-ph-buildings" class="size-4" aria-hidden="true" />
                Sekolah Rendah
              </p>
              <URadioGroup
                :model-value="levelIn(PRIMARY_CLASS_LEVELS)"
                :items="levelItems(PRIMARY_CLASS_LEVELS)"
                legend="Sekolah Rendah"
                name="class_level"
                variant="card"
                color="info"
                indicator="hidden"
                orientation="horizontal"
                :ui="{
                  fieldset: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6',
                  item: 'min-h-11 items-center justify-center p-2 text-center',
                  wrapper: 'w-full text-center',
                  legend: 'sr-only',
                }"
                @update:model-value="pickLevel"
              />
            </div>
            <div
              v-if="groups.includes('secondary')"
              class="flex flex-col gap-3"
              data-testid="class-group-secondary"
            >
              <p class="flex items-center gap-2 text-label text-muted">
                <UIcon name="i-ph-bank" class="size-4" aria-hidden="true" />
                Sekolah Menengah
              </p>
              <URadioGroup
                :model-value="levelIn(SECONDARY_CLASS_LEVELS)"
                :items="levelItems(SECONDARY_CLASS_LEVELS)"
                legend="Sekolah Menengah"
                name="class_level"
                variant="card"
                color="info"
                indicator="hidden"
                orientation="horizontal"
                :ui="{
                  fieldset: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6',
                  item: 'min-h-11 items-center justify-center p-2 text-center',
                  wrapper: 'w-full text-center',
                  legend: 'sr-only',
                }"
                @update:model-value="pickLevel"
              />
            </div>
          </div>
        </DsFormSection>

        <DsFormSection
          title="Data Pelajar"
          description="Muat naik CSV atau tampal data DELIMa."
          icon="file-arrow-up"
          accent="friend"
          :columns="2"
        >
          <div class="sm:col-span-2">
            <ImportSourceFields
              v-model:mode="mode"
              v-model:paste="paste"
              v-model:file="file"
              :paste-placeholder="DELIMA_PASTE_PLACEHOLDER"
            >
              <template #format="{ mode: current }">
                <DsPanel v-if="current === 'csv'" tone="inset" data-testid="student-format-csv">
                  <div class="flex flex-col gap-1 text-label text-muted">
                    <p class="flex items-center gap-2 text-body text-default">
                      <UIcon name="i-ph-info" class="size-4" aria-hidden="true" />
                      Format CSV:
                    </p>
                    <p class="break-words">Nama, Email DELIMa, Kata Laluan, No KP (pilihan)</p>
                    <p class="break-words">
                      Contoh: Muhammad Fulan bin Fulan, m-XXXXXXXX@moe-dl.edu.my, katalaluan123,
                      031215101234
                    </p>
                  </div>
                </DsPanel>
                <DsPanel v-else tone="inset" data-testid="student-format-paste">
                  <div class="flex flex-col gap-1 text-label text-muted">
                    <p class="flex items-center gap-2 text-body text-default">
                      <UIcon name="i-ph-info" class="size-4" aria-hidden="true" />
                      Format DELIMa (3-4 baris per pelajar):
                    </p>
                    <p>NAMA PELAJAR</p>
                    <p class="break-all">m-XXXXXXXX@moe-dl.edu.my</p>
                    <p>katalaluan123</p>
                    <p>031215101234 <span class="text-dimmed">(No. KP — pilihan)</span></p>
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
          data-testid="student-footer"
        />
      </form>

      <aside class="flex min-w-0 flex-col gap-6">
        <DsPanel padding="none" data-testid="student-hero">
          <div class="flex flex-col gap-4 p-4 sm:p-6">
            <div class="flex items-center gap-4">
              <DsIconChip icon="identification-card" accent="trial" size="lg" />
              <h3 class="text-subheading text-highlighted">Login pelajar</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge
                color="neutral"
                variant="subtle"
                size="lg"
                icon="i-ph-key"
                label="Kata laluan DELIMa"
              />
              <UBadge
                color="neutral"
                variant="subtle"
                size="lg"
                icon="i-ph-envelope-simple"
                label="Email DELIMa"
              />
            </div>
          </div>
        </DsPanel>

        <DsPanel padding="none" data-testid="student-notes">
          <div class="p-4 sm:p-6">
            <h3 class="mb-3 flex items-center gap-2 text-body text-highlighted">
              <UIcon name="i-ph-lightbulb" class="size-5 text-muted" aria-hidden="true" />
              Nota Penting:
            </h3>
            <ul class="flex flex-col gap-2 text-body text-muted">
              <li>
                • Pelajar login guna <strong>email DELIMa</strong> dan
                <strong>kata laluan DELIMa</strong>
              </li>
              <li>• ID yang sudah wujud akan dilangkau automatik</li>
              <li>• Nama pelajar akan ditukar ke Title Case</li>
            </ul>
          </div>
        </DsPanel>
      </aside>
    </div>
  </DsPage>
</template>
