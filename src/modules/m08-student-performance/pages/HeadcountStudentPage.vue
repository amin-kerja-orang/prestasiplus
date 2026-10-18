<script setup lang="ts">
/**
 * S15 `/headcount/student/{id}` "Headcount — Prestasi Individu" (M08-T6; FR-M08-92…96, 127). One section
 * per config that holds an entry of the pupil (config id ascending). The back control goes back in the
 * history, as live does (to `/headcount` when there is none). An unknown pupil is the 404 page, a pupil
 * or config the viewer may not open the 403 page (§9).
 */
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePageMeta } from '@/composables/usePageMeta'
import { DsBackLink, DsEmptyState, DsLoadError, DsPage, DsPageHeader } from '@/ds'

import { fetchHeadcountStudent } from '../api/headcount'
import StudentSection from '../components/headcount/StudentSection.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const userId = computed(() => Number(route.params.id))
const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountStudent(userId.value, { signal }),
  [userId],
)

watchEffect(() => {
  const d = data.value
  if (d) pageMeta.setTitle(`Headcount ${d.student.name} - PRESTASIPLUS`)
})

const subtitle = computed(() => {
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
        :show-title="true" :title="data.student.name"
        :subtitle="subtitle"
        title-testid="student-name"
        subtitle-testid="student-subtitle"
      >
        <template #breadcrumb>
          <DsBackLink to="/headcount" label="Kembali" data-testid="back-button" @click.prevent="back" />
        </template>
      </DsPageHeader>

      <div v-if="data.sections.length === 0" data-testid="student-empty">
        <DsEmptyState title="Belum ada headcount." icon="clipboard-text" />
      </div>

      <StudentSection v-for="s in data.sections" :key="s.configId" :section="s" />
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
