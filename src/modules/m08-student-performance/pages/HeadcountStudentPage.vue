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
import { DsEmptyState, DsPage } from '@/ds'

import { fetchHeadcountStudent } from '../api/headcount'
import StudentSection from '../components/headcount/StudentSection.vue'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

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
    <PageLoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <PageHeader
        :title="data.student.name"
        :subtitle="subtitle"
        title-testid="student-name"
        subtitle-testid="student-subtitle"
      >
        <template #leading>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-arrow-left"
            aria-label="Kembali"
            data-testid="back-button"
            @click="back"
          />
        </template>
      </PageHeader>

      <div v-if="data.sections.length === 0" data-testid="student-empty">
        <DsEmptyState title="Belum ada headcount." icon="i-ph-clipboard-text" />
      </div>

      <StudentSection v-for="s in data.sections" :key="s.configId" :section="s" />
    </template>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
