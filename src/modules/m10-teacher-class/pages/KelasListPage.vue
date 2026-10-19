<script setup lang="ts">
/**
 * S4 `/guru/kelas` (FR-M10-28..30; URS FT-M10-3.1): "{n} kelas aktif", "Cipta Kelas Baru", the
 * empty card, PROPOSED class cards (1 / 2 / 3 per row) and the quick-QR modal.
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import { DsPage, DsPanel, DsLoadError, DsGrid, DsHeading, DsText } from '@/ds'

import { fetchGuruClasses } from '../api/guru'
import ClassCard from '../components/kelas/ClassCard.vue'
import { KELAS_COPY } from '../components/kelas/copy'
import QrModal from '../components/kelas/QrModal.vue'

const { data, error, reload } = useApi((signal) => fetchGuruClasses({ signal }))
// Only active classes are listed, as the "n kelas aktif" counter counts them.
const classes = computed(() => (data.value?.data ?? []).filter((c) => c.isActive))
const activeCount = computed(() => classes.value.length)
const qrClassId = ref<number | null>(null)
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
    <p class="-mt-2 text-body text-muted" data-testid="kelas-active-count">
      {{ activeCount }} kelas aktif
    </p>

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
      <div class="flex flex-col items-center gap-2 py-6 text-center">
        <UIcon name="i-ph-chalkboard-teacher-duotone" class="size-12 text-dimmed" />
        <DsHeading :level="2" variant="subheading">{{ KELAS_COPY.emptyTitle }}</DsHeading>
        <DsText variant="body" tone="muted">{{ KELAS_COPY.emptyBody }}</DsText>
        <UButton
          to="/guru/kelas/cipta"
          icon="i-ph-plus-circle-duotone"
          class="mt-3 min-h-11"
          data-testid="kelas-empty-create"
          >{{ KELAS_COPY.createShort }}</UButton
        >
      </div>
    </DsPanel>

    <DsGrid v-else :cols="{ base: 1, sm: 2, lg: 3 }" as="ul" data-testid="kelas-grid">
      <ClassCard v-for="item in classes" :key="item.id" :item="item" @qr="qrClassId = $event" />
    </DsGrid>

    <QrModal :class-id="qrClassId" @close="qrClassId = null" />
  </DsPage>
</template>
