<script setup lang="ts">
/**
 * Kertas Subjektif page-image document (`/kertas-subjektif/dokumen/:id`, V2 `/kertas-subjektif/{paper}`): the paper as page images and the
 * revealable scheme. Published documents only: a Draf or unknown id is the "not found" state (the API answers 404).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsEmptyState, DsLoadError, DsPage, DsStateView } from '@/ds'
import { useApi } from '@/composables/useApi'
import { isApiError } from '@/api'

import KertasDokumenViewer from '../components/KertasDokumenViewer.vue'
import { useLearnerTheme } from '../lib/use-bijak'
import { kertasDokumenServer } from '../server/documents-client'

useLearnerTheme()
const route = useRoute()
const server = kertasDokumenServer()
const id = computed(() => String(route.params.id ?? ''))

const { data: doc, error, reload } = useApi(() => server.get(id.value), id)
const missing = computed(() => error.value !== null && isApiError(error.value) && (error.value.status === 404 || error.value.status === 403))

const heading = computed(() => (doc.value ? `${doc.value.subjectName ?? 'Kertas'} — Kertas ${doc.value.kertas}` : 'Kertas Subjektif'))
const subheading = computed(() => {
  const d = doc.value
  if (!d) return undefined
  return d.negeri ? `${d.negeri}${d.year ? ` ${d.year}` : ''}` : d.title
})
</script>

<template>
  <DsPage
    :title="heading"
    :subtitle="subheading"
    :back-to="{ name: 'm28.kertas-subjektif' }"
    back-label="Semua kertas"
    data-testid="dokumen-page"
  >
    <DsEmptyState v-if="missing" title="Kertas ini tidak dijumpai." icon="i-ph-file-x" data-testid="dokumen-not-found">
      <template #actions>
        <UButton :to="{ name: 'm28.kertas-subjektif' }" size="lg">Kembali ke Kertas Subjektif</UButton>
      </template>
    </DsEmptyState>
    <DsLoadError v-else-if="error" message="Kertas tidak dapat dimuatkan." @retry="reload" />
    <DsStateView v-else-if="!doc" status="loading" skeleton="list" :rows="3" data-testid="dokumen-loading" />
    <KertasDokumenViewer v-else :doc="doc" />
  </DsPage>
</template>
