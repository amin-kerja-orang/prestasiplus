<script setup lang="ts">
/**
 * S1 `/prestasi/sekolah` "Dashboard Sekolah" (M08-T5; FR-M08-11…21). From `GET /api/performance/school`:
 * the admin sees the platform, the school admin and every other role the own school (FR-M08-13).
 * GPS, grade distribution, subject rows and the teacher On Track / Below come from the headcount
 * figures (M08-T1b) and show "—", 0 and "Tiada data headcount" until they exist.
 */
import { computed } from 'vue'

import { DsLoadError, DsPage, DsPageHeader, DsPanel, DsStatRow } from '@/ds'

import { fetchSchoolPerformance } from '../api/performance'
import GpsCard from '../components/prestasi/GpsCard.vue'
import GpsTrendCard from '../components/prestasi/GpsTrendCard.vue'
import GradeDistribution from '../components/prestasi/GradeDistribution.vue'
import LevelAndTeachers from '../components/prestasi/LevelAndTeachers.vue'
import SubjectGpsTable from '../components/prestasi/SubjectGpsTable.vue'
import { usePhIcon } from '../lib/icons'
import { grouped, pct1, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const { data, error, reload } = useRouteData((signal) => fetchSchoolPerformance({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const icon = usePhIcon()

const cards = computed<StatSpec[]>(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    { id: 'murid', label: 'Murid', value: plain(s.students), icon: 'users' },
    { id: 'guru', label: 'Guru', value: plain(s.teachers), icon: 'chalkboard-teacher' },
    { id: 'kelas', label: 'Kelas', value: plain(s.classes), icon: 'chalkboard' },
    { id: 'subjek', label: 'Subjek', value: plain(s.subjects), icon: 'books' },
    { id: 'sesi', label: 'Sesi Latihan', value: plain(s.sessions), icon: 'lightning' },
    { id: 'soalan', label: 'Soalan Dijawab', value: grouped(s.answered), icon: 'question' },
    { id: 'ketepatan', label: 'Purata Ketepatan', value: pct1(s.accuracy), icon: 'target' },
  ]
})

const quickNav = computed(() => [
  {
    to: '/prestasi/tingkatan',
    label: '🎓 Dashboard Tingkatan',
    icon: icon.value('graduation-cap'),
  },
  { to: '/prestasi/kelas', label: '📊 Dashboard Kelas', icon: icon.value('chart-bar') },
  { to: '/headcount', label: '📈 Headcount', icon: icon.value('chart-line-up') },
  { to: '/analisa-item/sekolah', label: '🔬 Analisa Item', icon: icon.value('list-numbers') },
])
</script>

<template>
  <DsPage data-testid="prestasi-sekolah-page">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div data-testid="school-header">
        <DsPageHeader
          title="Dashboard Sekolah"
          :subtitle="`Ringkasan prestasi keseluruhan · ${plain(data.header.classCount)} kelas · ${plain(data.header.studentCount)} murid`"
          subtitle-testid="header-summary"
        >
          <template #actions>
            <UButton
              to="/prestasi/tingkatan"
              color="neutral"
              variant="soft"
              size="lg"
              :icon="icon('graduation-cap')"
              label="Tingkatan"
            />
            <UButton
              to="/prestasi/kelas"
              color="neutral"
              variant="soft"
              size="lg"
              :icon="icon('chalkboard')"
              label="Kelas"
            />
          </template>
        </DsPageHeader>
      </div>

      <DsStatRow :items="statItems(cards)" data-testid="stat-cards" :cols="5" prefix="stat" />

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <GpsCard :gps="data.gps" />
        <GradeDistribution :distribution="data.distribution" />
      </div>

      <GpsTrendCard :trend="data.trend" />
      <SubjectGpsTable :subjects="data.subjects" />
      <LevelAndTeachers :levels="data.levels" :teachers="data.teachers" />

      <DsPanel data-testid="quick-nav">
        <div class="flex flex-col gap-4">
          <h2 class="text-subheading text-highlighted">🔗 Navigasi Pantas</h2>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UButton
              v-for="n in quickNav"
              :key="n.to"
              :to="n.to"
              color="neutral"
              variant="soft"
              size="xl"
              block
              :icon="n.icon"
              :label="n.label"
            />
          </div>
        </div>
      </DsPanel>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
