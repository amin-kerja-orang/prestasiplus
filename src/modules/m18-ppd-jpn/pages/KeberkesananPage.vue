<script setup lang="ts">
/**
 * S21 `/amaran/keberkesanan` "Keberkesanan Intervensi" (M18 SRS S21, endpoint #24; design `m18-amaran-summary`
 * section 5): the school admin's own school only (the server derives it from the session). Four tiles, a
 * doughnut, a 6-month trend, and with data the type, teacher and follow-up cards. "Perbandingan Sekolah Daerah"
 * (`bySchool`) is not shown for one school; the follow-up arrow to S24 is hidden until S24 exists.
 * States: loading, error (server message + "Cuba Semula"), 403 (global 403 page in place), zero, data.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBackLink, DsLoadError, DsPage, DsStack } from '@/ds'

import { fetchAmaranEffectiveness } from '../api/amaran'
import KbCharts from '../components/keberkesanan/KbCharts.vue'
import KbFollowUps from '../components/keberkesanan/KbFollowUps.vue'
import KbNone from '../components/keberkesanan/KbNone.vue'
import { KB_TITLE, tabTitle } from '../components/keberkesanan/kb-format'
import KbTeacherTable from '../components/keberkesanan/KbTeacherTable.vue'
import KbTiles from '../components/keberkesanan/KbTiles.vue'
import KbTypeList from '../components/keberkesanan/KbTypeList.vue'
import { loadErrorMessage } from '../lib/load-error'

const pageMeta = usePageMeta()

const { data, error, loading, reload } = useApi((signal) => fetchAmaranEffectiveness({ signal }), [])

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

// Sub-line = the school name; the tab title carries the school name too, never a pupil name.
watch(
  data,
  (d) => {
    if (!d) return
    pageMeta.setHeader({ title: KB_TITLE, subtitle: d.school.name })
    pageMeta.setTitle(tabTitle(d.school.name))
  },
  { immediate: true },
)

const report = computed(() => data.value?.report ?? null)
</script>

<template>
  <DsPage data-testid="kb-page">
    <DsBackLink to="/amaran/sekolah" label="Kembali ke Amaran" data-testid="kb-back" />
    <template v-if="report">
      <KbTiles :cards="report.cards" />
      <KbCharts :doughnut="report.doughnut" :trend="report.trend" />
      <KbNone v-if="report.cards.total === 0" />
      <template v-else>
        <KbTypeList :rows="report.byType" />
        <KbTeacherTable :rows="report.byTeacher" />
        <KbFollowUps :rows="report.followUps" />
      </template>
    </template>
    <DsLoadError
      v-else-if="error && !refused"
      :message="loadErrorMessage(error)"
      testid="kb-error"
      @retry="reload"
    />
    <DsStack v-else-if="loading" gap="md" aria-busy="true" data-testid="kb-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
