<script setup lang="ts">
/**
 * Announcement carousel (violet "info" card; FR-M05-04…08). One slide at a time, per-slide
 * "Baca Selanjutnya" / "Tutup" toggle, dots and arrows. Copy comes from the dashboard banners.
 */
import { computed, reactive } from 'vue'

import { DsCarousel, DsIconChip } from '@/ds'

import type { DashboardBanner } from '../../api/types'
import { bannerKind } from '../dashboard/dashboard-lib'

const props = defineProps<{ banners: DashboardBanner[] }>()

const expanded = reactive<Record<number, boolean>>({})
const items = computed(() =>
  props.banners.map((b, index) => ({
    index,
    type: b.type,
    kind: bannerKind(b),
    title: b.title,
    body: b.body ?? '',
  })),
)
</script>

<template>
  <section class="min-w-0 sm:px-12" aria-label="Pengumuman" data-testid="dash-carousel">
    <DsCarousel :items="items" label="Pengumuman" arrows>
      <template #item="{ item }">
        <UCard
          :ui="{ body: 'flex items-start gap-3 p-4' }"
          :data-testid="`dash-slide-${item.index}`"
        >
          <DsIconChip icon="i-ph-sparkle-duotone" accent="friend" size="lg" />
          <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
            <UBadge color="neutral" variant="subtle" data-testid="dash-slide-badge">{{
              item.type
            }}</UBadge>
            <h3 class="text-subheading text-highlighted" data-testid="dash-slide-title">
              {{ item.title }}
            </h3>
            <template v-if="item.body">
              <p
                class="text-label break-words text-muted"
                :class="expanded[item.index] ? '' : 'line-clamp-2'"
                data-testid="dash-slide-body"
              >
                {{ item.body }}
              </p>
              <UButton
                color="neutral"
                variant="link"
                size="md"
                class="min-h-11 px-0"
                :aria-expanded="expanded[item.index] ? 'true' : 'false'"
                data-testid="dash-slide-toggle"
                @click="expanded[item.index] = !expanded[item.index]"
                >{{ expanded[item.index] ? 'Tutup' : 'Baca Selanjutnya' }}</UButton
              >
            </template>
          </div>
        </UCard>
      </template>
    </DsCarousel>
  </section>
</template>
