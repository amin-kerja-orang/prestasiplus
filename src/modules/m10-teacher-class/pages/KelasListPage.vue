<script setup lang="ts">
/**
 * R1-GUR-8 `/guru/kelas` "Kelas Saya" (S6-T14; was S4): the counter "{n} kelas · {n} pelajar" (distinct
 * pupils of the own classes), the button "Cipta Kelas", the class cards (1 / 2 / 3 per row, each with an
 * "Edit" link) or the empty state. No join code and no QR modal (DV-GUR-8-1).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsEmptyState, DsGrid, DsLoadError, DsPage, DsPanel, DsText } from '@/ds'

import { fetchGuruClasses, fetchGuruStudents } from '../api/guru'
import ClassCard from '../components/kelas/ClassCard.vue'
import { KELAS_COPY } from '../components/kelas/copy'

const { data, error, reload } = useApi((signal) => fetchGuruClasses({ signal }))
// Distinct pupils of the own classes: the "mine" roster lists each pupil once, whatever the classes.
const { data: roster } = useApi((signal) => fetchGuruStudents({ tab: 'mine' }, { signal }))

// Only active classes are listed and counted.
const classes = computed(() => (data.value?.data ?? []).filter((c) => c.isActive))
const counter = computed(() => {
  const kelas = `${String(classes.value.length)} kelas`
  return roster.value ? `${kelas} · ${String(roster.value.data.length)} pelajar` : kelas
})
</script>

<template>
  <DsPage :title="KELAS_COPY.title" data-testid="kelas-list-page">
    <template #actions>
      <UButton
        to="/guru/kelas/cipta"
        icon="i-ph-plus-circle-duotone"
        class="min-h-11"
        data-testid="kelas-create"
        >{{ KELAS_COPY.create }}</UButton
      >
    </template>
    <DsText variant="body" tone="muted" data-testid="kelas-active-count">{{ counter }}</DsText>

    <DsLoadError
      v-if="error"
      :message="KELAS_COPY.loadFailed"
      retry-label="Cuba Lagi"
      testid="kelas-error"
      @retry="reload"
    />
    <DsGrid
      v-else-if="!data"
      :cols="{ base: 1, sm: 2, lg: 3 }"
      aria-busy="true"
      data-testid="kelas-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-40 w-full" />
    </DsGrid>

    <DsPanel v-else-if="classes.length === 0" data-testid="kelas-empty">
      <DsEmptyState :title="KELAS_COPY.empty" icon="chalkboard-teacher">
        <template #actions>
          <UButton
            to="/guru/kelas/cipta"
            icon="i-ph-plus-circle-duotone"
            class="min-h-11"
            data-testid="kelas-empty-create"
            >{{ KELAS_COPY.create }}</UButton
          >
        </template>
      </DsEmptyState>
    </DsPanel>

    <DsGrid v-else as="ul" :cols="{ base: 1, sm: 2, lg: 3 }" data-testid="kelas-grid">
      <ClassCard v-for="item in classes" :key="item.id" :item="item" />
    </DsGrid>
  </DsPage>
</template>
