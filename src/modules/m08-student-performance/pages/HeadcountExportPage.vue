<script setup lang="ts">
/**
 * `/headcount/{id}/export` (M08-T6; FR-M08-132, FR-M08-137, CSV #29): opening the URL directly downloads
 * the CSV of the S23 table (`?sort=name` keeps the A-Z order) and goes back in the history (to S23 when
 * there is none), as a live download link leaves the viewer on the page they came from. An unknown id is the 404 page, a forbidden config the 403.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsPage } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadHeadcountCsv } from '../api/headcount'
import PageLoadError from '../components/shared/PageLoadError.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const sort = computed(() => (route.query.sort === 'name' ? 'name' : 'ranking'))

const { data, error, reload } = useRouteData((signal) =>
  downloadHeadcountCsv(id.value, { sort: sort.value, signal }),
)

watch(
  data,
  (file) => {
    if (!file) return
    saveBlob(file.blob, file.filename ?? `headcount-${String(id.value)}.csv`)
    const state = window.history.state as { back?: string | null } | null
    if (state?.back) router.back()
    else void router.replace(`/headcount/${String(id.value)}`)
  },
  { immediate: true },
)
</script>

<template>
  <DsPage data-testid="headcount-export-page">
    <PageLoadError v-if="isLoadError(error)" @retry="reload()" />
  </DsPage>
</template>
