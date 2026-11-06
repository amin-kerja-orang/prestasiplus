<script setup lang="ts">
/**
 * S15 `/headcount/student/{id}` "Headcount — Prestasi Individu" (M08-T6; FR-M08-92…96, 127). One section
 * per config that holds an entry of the pupil (config id ascending). The back control goes back in the
 * history, as live does (to `/headcount` when there is none). An unknown pupil is the 404 page, a pupil
 * or config the viewer may not open the 403 page (§9).
 *
 * Pupil mode (S10-T09, R1-MUR-3): another id than the own one is the 403 page with no request; the own id
 * reads `me/detail` with `?configId=`; an unknown or foreign config is the 404 page. Title "Headcount".
 */
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api'

import { usePageMeta } from '@/composables/usePageMeta'
import { DsBackLink, DsEmptyState, DsLoadError, DsPage, DsPageHeader } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { fetchHeadcountMeDetail, fetchHeadcountStudent } from '../api/headcount'
import StudentSection from '../components/headcount/StudentSection.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const session = useSessionStore()
const isPupil = computed(() => session.role === 'student')
const userId = computed(() => routeId(route.params.id))
// numeric compare, so /headcount/student/007 is still the pupil's own id
const own = computed(() => session.user?.id !== undefined && Number(route.params.id) === Number(session.user.id))
const configId = computed(() => {
  const q = route.query.configId
  const v = Array.isArray(q) ? q[0] : q
  return typeof v === 'string' && v !== '' ? v : null
})

const { data, error, reload } = useRouteData(
  (signal) => {
    if (!isPupil.value) return fetchHeadcountStudent(userId.value, { signal })
    // Another pupil's id: the 403 page, no request, no hint that it exists (AC-MUR-3-4).
    if (!own.value) {
      return Promise.reject(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' }))
    }
    return fetchHeadcountMeDetail(configId.value, { signal })
  },
  [userId, configId],
)

watchEffect(() => {
  const d = data.value
  if (!d) return
  if (isPupil.value) {
    pageMeta.setTitle('Headcount - PRESTASIPLUS')
    pageMeta.setHeader({ title: 'Headcount', subtitle: 'Selamat datang kembali' })
  } else pageMeta.setTitle(`Headcount ${d.student.name} - PRESTASIPLUS`)
})

const subtitle = computed(() => {
  if (isPupil.value) return 'Tracking prestasi murid — TOV, OTR, AR & RS'
  const school = data.value?.student.school
  return `Headcount — Prestasi Individu${school ? ` · ${school}` : ''}`
})

function back() {
  const state = window.history.state as { back?: string | null } | null
  if (state?.back) router.back()
  else void router.push('/headcount')
}
</script>

<template>
  <DsPage data-testid="headcount-student-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsPageHeader
        :show-title="true" :title="isPupil ? 'Headcount' : data.student.name"
        :subtitle="subtitle"
        title-testid="student-name"
        subtitle-testid="student-subtitle"
      >
        <template #breadcrumb>
          <DsBackLink to="/headcount" label="Kembali" data-testid="back-button" @click.prevent="back" />
        </template>
      </DsPageHeader>

      <div v-if="data.sections.length === 0" data-testid="student-empty">
        <DsEmptyState
          v-if="isPupil"
          title="Belum ada Headcount"
          description="Guru anda belum menyediakan headcount bagi kelas anda tahun ini."
          icon="clipboard-text"
        />
        <DsEmptyState v-else title="Belum ada headcount." icon="clipboard-text" />
      </div>

      <StudentSection v-for="s in data.sections" :key="s.configId" :section="s" :pupil="isPupil" />
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
