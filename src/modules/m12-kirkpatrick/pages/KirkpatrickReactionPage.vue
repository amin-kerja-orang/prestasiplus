<script setup lang="ts">
/**
 * S2 T1 Reaksi (FR-M12-32, 33; URS EP-M12-3): the tab strip and four cards, no filter, no count, no
 * breakdown. T1 is global: `school_id` and `state` in the URL change nothing.
 */
import { DsLoadError, DsPage, DsStatRow, type StatItem } from '@/ds'
import { computed } from 'vue'

import { fetchKirkpatrickReaction } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickTabs,
  mean,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

withDefaults(defineProps<{ basePath?: string }>(), { basePath: KIRKPATRICK_ADMIN_BASE })

const { data, error, loading, reload } = useKirkpatrickPage((signal) =>
  fetchKirkpatrickReaction({ signal }),
)

const items = computed<StatItem[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      key: 'nps-student',
      label: 'NPS Pelajar',
      value: `${mean(d.npsStudent)}/10`,
      icon: 'i-ph-smiley', accent: 'friend',
    },
    {
      key: 'nps-teacher',
      label: 'NPS Guru',
      value: `${mean(d.npsTeacher)}/10`,
      icon: 'i-ph-chalkboard-teacher', accent: 'win',
    },
    {
      key: 'nps-admin',
      label: 'NPS Admin',
      value: `${mean(d.npsAdmin)}/10`,
      icon: 'i-ph-user-gear', accent: 'trial',
    },
    {
      key: 'satisfaction',
      label: 'Kepuasan Purata',
      value: `${mean(d.satisfaction)}/5`,
      icon: 'i-ph-heart', accent: 'heat',
    },
  ]
})
</script>

<template>
  <DsPage
    data-testid="kirk-reaction-page"
    subtitle="Kepuasan dan persepsi pengguna terhadap platform"
  >
    <KirkpatrickTabs :base-path="basePath" current="reaction" />

    <DsLoadError v-if="error" testid="kirk-error" @retry="reload" />
    <p
      v-else-if="data === null && loading"
      class="flex items-center gap-2 text-label text-muted"
      data-testid="kirk-loading"
      role="status"
    >
      <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
    </p>

    <DsStatRow
      v-if="data"
      :items="items"
      prefix="kirk"
      :cols="4"
      roomy
      data-testid="kirk-reaction-cards"
    />
  </DsPage>
</template>
