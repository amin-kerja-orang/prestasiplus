<script setup lang="ts">
/**
 * "Badges" -> "Achievement System — Scan & Award Badges" (FR-M10-25, FN-M10-2.2.13, BR-M10-16; read-only):
 * three cards, "Senarai Lencana" chips (name, "{n} pelajar", rarity), "Top Pengumpul Lencana",
 * "Baru Dianugerahkan Hari Ini!"; a chip opens "Lencana: {nama}" (the holders of the badge).
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterAchievements } from '../../api/command-center'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { useOpenTab } from './composables'
import { rarityOf, studentPath } from './copy'
import type { DrillRow } from './drill-table'
import HoldersModal from './HoldersModal.vue'
import StatCards from './StatCards.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterAchievements({ signal }))
const openTab = useOpenTab()
const chosen = ref<{ id: number; name: string } | null>(null)
const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Pelajar', value: String(d?.totalStudents ?? 0) },
    { label: 'Lencana Baru Dianugerah', value: String(d?.totalNew ?? 0) },
    { label: 'Jenis Lencana Aktif', value: String(d?.badgeStats.length ?? 0) },
  ]
})
const COLLECTOR_HEADERS = ['#', 'Pelajar', 'Jumlah Lencana']
const collectors = computed<DrillRow[]>(() =>
  (data.value?.topCollectors ?? []).map((c, i) => ({
    cells: [{ text: String(i + 1) }, { text: c.name }, { text: String(c.count), mono: true }],
  })),
)
</script>

<template>
  <CcDialog
    title="Achievement System — Scan & Award Badges"
    testid="cc-badges-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-body text-error">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Mengimbas pencapaian semua pelajar...
    </p>
    <template v-else>
      <StatCards :cards="cards" :cols="3" />

      <h4 class="text-subheading text-highlighted">Senarai Lencana</h4>
      <ul class="flex flex-wrap gap-2" data-testid="cc-badge-chips">
        <li v-for="b in data.badgeStats" :key="b.id" class="max-w-full min-w-0">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-ph-medal"
            class="h-auto max-w-full gap-2 py-2 text-start"
            data-testid="cc-badge-chip"
            @click="chosen = b"
          >
            <span class="min-w-0 text-label break-words text-highlighted">{{ b.name }}</span>
            <span class="text-caption text-muted">{{ b.holders }} pelajar</span>
            <span :class="['text-caption', rarityOf(b.holders).tone]">{{
              rarityOf(b.holders).label
            }}</span>
          </UButton>
        </li>
      </ul>

      <template v-if="data.topCollectors.length">
        <h4 class="text-subheading text-highlighted">Top Pengumpul Lencana</h4>
        <CcTable
          :headers="COLLECTOR_HEADERS"
          :rows="collectors"
          testid="cc-collectors-table"
          row-testid="cc-collector-row"
          caption="Top Pengumpul Lencana"
        />
      </template>

      <template v-if="data.newAwards.length">
        <h4 class="text-subheading text-warning">Baru Dianugerahkan Hari Ini!</h4>
        <ul class="flex flex-col gap-1" data-testid="cc-new-awards">
          <li v-for="(a, i) in data.newAwards" :key="i" class="min-w-0">
            <UButton
              color="neutral"
              variant="ghost"
              block
              icon="i-ph-medal"
              class="h-auto justify-start gap-2 py-2 text-start"
              @click="openTab(studentPath(a.studentId))"
            >
              <span class="min-w-0 text-label break-words text-highlighted">{{ a.name }}</span>
              <span class="text-body text-muted">{{ a.badgeName }}</span>
            </UButton>
          </li>
        </ul>
      </template>
    </template>

    <HoldersModal v-if="chosen" :badge="chosen" @close="chosen = null" />
  </CcDialog>
</template>
