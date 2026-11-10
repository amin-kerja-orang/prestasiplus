<script setup lang="ts">
/**
 * Pratonton of a Kertas Subjektif page-image document (`/admin/kertas-subjektif/dokumen/:id`, V2 `Pratonton`): the view a pupil gets, readable
 * for a Draf document too. Read only; Terbit / Sembunyikan is on the list.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { useApi } from '@/composables/useApi'
import { DsCluster, DsEmptyState, DsHeading, DsPage, DsStack, DsStateView, DsStatusBadge, DsText } from '@/ds'

import KertasDokumenViewer from '../../components/KertasDokumenViewer.vue'
import { kertasDokumenServer } from '../../server/documents-client'
import { SUBJEKTIF_PATH } from '../builder/server/api'

const route = useRoute()
const server = kertasDokumenServer()
const id = computed(() => String(route.params.id ?? ''))
const { data: doc, error, loading, reload } = useApi(() => server.adminGet(id.value), id)
const missing = computed(() => error.value !== null && isApiError(error.value) && error.value.status === 404)
const status = computed(() => (loading.value && !doc.value ? 'loading' : error.value ? 'error' : doc.value ? 'ready' : 'loading'))
</script>

<template>
  <DsPage layout="detail" data-testid="sj-dokumen-page">
    <DsEmptyState v-if="missing" title="Kertas tidak ditemui." icon="i-ph-file-x" data-testid="sj-dokumen-missing">
      <template #actions>
        <UButton :to="SUBJEKTIF_PATH" size="lg">Kertas Subjektif</UButton>
      </template>
    </DsEmptyState>
    <DsStateView v-else :status="status" error="Tidak dapat memuatkan kertas." skeleton="text" data-testid="sj-dokumen-state" @retry="reload">
      <DsStack v-if="doc" gap="md">
        <DsStack gap="xs" align="start">
          <UButton :to="SUBJEKTIF_PATH" color="neutral" variant="ghost" icon="i-ph-arrow-left" label="Kertas Subjektif" data-testid="sj-dokumen-back" />
          <DsHeading :level="2" data-testid="sj-dokumen-title">{{ doc.title }}</DsHeading>
          <DsCluster gap="sm">
            <DsText variant="caption" tone="muted" data-testid="sj-dokumen-meta">
              {{ doc.subjectName ?? '—' }} · K{{ doc.kertas }} · {{ doc.negeri || '—' }} · {{ doc.year ?? '—' }}
            </DsText>
            <DsStatusBadge :status="doc.status === 'terbit' ? 'published' : 'draft'" />
          </DsCluster>
        </DsStack>
        <KertasDokumenViewer :doc="doc" />
      </DsStack>
    </DsStateView>
  </DsPage>
</template>
