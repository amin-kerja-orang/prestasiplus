<script setup lang="ts">
/**
 * "Badges" -> "Achievement System — Scan & Award Badges" (FR-M10-25, FN-M10-2.2.13, BR-M10-16; read-only):
 * three cards, "Senarai Lencana" chips (name, "{n} pelajar", rarity), "Top Pengumpul Lencana",
 * "Baru Dianugerahkan Hari Ini!"; a chip opens "Lencana: {nama}" (the holders of the badge).
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import { DsStatRow, DsCluster, DsStack, DsText, DsHeading } from '@/ds'

import { fetchCommandCenterAchievements } from '../../api/command-center'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { statItems, useOpenTab } from './composables'
import { rarityOf, studentPath } from './copy'
import type { DrillRow } from './drill-table'
import HoldersModal from './HoldersModal.vue'

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
    <DsText v-if="error" variant="body" tone="error">Ralat: {{ error.message }}</DsText>
    <DsText v-else-if="!data" variant="body" tone="muted" data-testid="cc-modal-loading">
      Mengimbas pencapaian semua pelajar...
    </DsText>
    <template v-else>
      <DsStatRow
        :items="statItems(cards)"
        prefix="cc-modal-card"
        :cols="3"
        data-testid="cc-modal-cards"
      />

      <DsHeading :level="4" variant="subheading">Senarai Lencana</DsHeading>
      <DsCluster as="ul" gap="xs" align="stretch" data-testid="cc-badge-chips">
        <li v-for="b in data.badgeStats" :key="b.id" class="max-w-full min-w-0">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-ph-medal"
            class="h-auto max-w-full gap-2 py-2 text-start"
            data-testid="cc-badge-chip"
            @click="chosen = b"
          >
            <DsText variant="label" tone="highlighted" wrap="anywhere" class="min-w-0">{{
              b.name
            }}</DsText>
            <DsText variant="caption" as="span">{{ b.holders }} pelajar</DsText>
            <span :class="['text-caption', rarityOf(b.holders).tone]">{{
              rarityOf(b.holders).label
            }}</span>
          </UButton>
        </li>
      </DsCluster>

      <template v-if="data.topCollectors.length">
        <DsHeading :level="4" variant="subheading">Top Pengumpul Lencana</DsHeading>
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
        <DsStack as="ul" gap="2xs" data-testid="cc-new-awards">
          <li v-for="(a, i) in data.newAwards" :key="i" class="min-w-0">
            <UButton
              color="neutral"
              variant="ghost"
              block
              icon="i-ph-medal"
              class="h-auto justify-start gap-2 py-2 text-start"
              @click="openTab(studentPath(a.studentId))"
            >
              <DsText variant="label" tone="highlighted" wrap="anywhere" class="min-w-0">{{
                a.name
              }}</DsText>
              <DsText variant="body" as="span" tone="muted">{{ a.badgeName }}</DsText>
            </UButton>
          </li>
        </DsStack>
      </template>
    </template>

    <HoldersModal v-if="chosen" :badge="chosen" @close="chosen = null" />
  </CcDialog>
</template>
