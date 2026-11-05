<script setup lang="ts">
/**
 * Admin Pusat central views of the school reports (R1-ADM-M-07; PM-12, 13, 15, 21, 22, 23, 27, 28;
 * `/admin/laporan-sekolah/{view}`). One component, the `view` prop picks the report (Decided D-T13-1).
 *
 * Top to bottom: the required field `Sekolah` (the M02 school picker; placeholder "Pilih sekolah", error
 * "Sila pilih sekolah." after the field is cleared or submitted empty), then the EXISTING school page for the
 * chosen school (no second model: AC-ADM-M07.1). The M27 pages read through `?schoolId=` (API-ADM-22); the Amaran
 * pages read `GET /api/amaran/schools/:id`. `analisa-item` opens the M08 school page of the chosen school.
 * A school the API does not know (404 / 422) shows "Tiada data untuk sekolah ini." in the school page.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  AmaranSekolahPage,
  DskpHeatmapPage,
  LaporanAktivitiPage,
  LaporanBulananPage,
  StatistikPenggunaanPage,
} from '@/modules/m27-school-admin'
import { DsPage, DsStack } from '@/ds'
import { AdminSchoolPicker, type SchoolSummary } from '@/modules/m02-users-schools'

import type { CentralReportView } from '../routes/laporan'

const props = defineProps<{ view: Exclude<CentralReportView, 'sekolah-bersaing'> }>()

const route = useRoute()
const router = useRouter()

const REQUIRED_ERROR = 'Sila pilih sekolah.'
const PLACEHOLDER = 'Pilih sekolah'
// our own error shows instead of the browser bubble (DsStack declares no `novalidate` prop)
const FORM_ATTRS = { novalidate: true }

const school = ref<SchoolSummary | null>(null)
const submitted = ref(false)
// the error shows once the field was emptied again (or submitted empty), not on first load
const error = computed(() => (submitted.value && school.value === null ? REQUIRED_ERROR : undefined))

watch(school, (now, before) => {
  if (now === null && before !== null) submitted.value = true
  if (now !== null && props.view === 'analisa-item') {
    void router.push(`/analisa-item/sekolah/${String(now.id)}`)
  }
})

/** The M27 pages: the picked school is a prop and the pills stay on this route. */
const SCHOOL_PAGES = {
  'laporan-aktiviti': LaporanAktivitiPage,
  'amaran-wellbeing': AmaranSekolahPage,
  'statistik-penggunaan': StatistikPenggunaanPage,
  'dskp-heatmap': DskpHeatmapPage,
  'amaran-awal': AmaranSekolahPage,
  'laporan-bulanan': LaporanBulananPage,
} as const

const schoolPage = computed(() =>
  props.view in SCHOOL_PAGES ? SCHOOL_PAGES[props.view as keyof typeof SCHOOL_PAGES] : null,
)
</script>

<template>
  <DsPage layout="report" :data-view="view" data-testid="central-page">
    <DsStack
      as="form"
      v-bind="FORM_ATTRS"
      data-testid="central-form"
      @submit.prevent="submitted = true"
    >
      <AdminSchoolPicker v-model="school" required :placeholder="PLACEHOLDER" :error="error" />
    </DsStack>
    <component
      :is="schoolPage"
      v-if="school && schoolPage"
      :key="`${view}-${String(school.id)}`"
      :school-id="school.id"
      :school-name="school.name"
      :base-path="route.path"
    />
  </DsPage>
</template>
