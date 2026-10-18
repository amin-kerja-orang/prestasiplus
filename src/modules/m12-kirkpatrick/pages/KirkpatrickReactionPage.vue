<script setup lang="ts">
/**
 * S2 T1 Reaksi (FR-M12-32, 33; URS EP-M12-3): the tab strip and four cards, no filter, no count, no
 * breakdown. T1 is global: `school_id` and `state` in the URL change nothing.
 */
import { DsPage } from '@/ds'

import { fetchKirkpatrickReaction } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
  KirkpatrickStatCard,
  KirkpatrickTabs,
  mean,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

withDefaults(defineProps<{ basePath?: string }>(), { basePath: KIRKPATRICK_ADMIN_BASE })

const { data, error, loading } = useKirkpatrickPage((signal) =>
  fetchKirkpatrickReaction({ signal }),
)
</script>

<template>
  <DsPage
    data-testid="kirk-reaction-page"
    subtitle="Kepuasan dan persepsi pengguna terhadap platform"
  >
    <KirkpatrickTabs :base-path="basePath" current="reaction" />

    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />

    <div
      v-if="data"
      class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"
      data-testid="kirk-reaction-cards"
    >
      <KirkpatrickStatCard
        label="NPS Pelajar"
        icon="i-ph-smiley"
        accent="friend"
        :value="`${mean(data.npsStudent)}/10`"
        data-testid="kirk-nps-student"
      />
      <KirkpatrickStatCard
        label="NPS Guru"
        icon="i-ph-chalkboard-teacher"
        accent="win"
        :value="`${mean(data.npsTeacher)}/10`"
        data-testid="kirk-nps-teacher"
      />
      <KirkpatrickStatCard
        label="NPS Admin"
        icon="i-ph-user-gear"
        accent="trial"
        :value="`${mean(data.npsAdmin)}/10`"
        data-testid="kirk-nps-admin"
      />
      <KirkpatrickStatCard
        label="Kepuasan Purata"
        icon="i-ph-heart"
        accent="heat"
        :value="`${mean(data.satisfaction)}/5`"
        data-testid="kirk-satisfaction"
      />
    </div>
  </DsPage>
</template>
