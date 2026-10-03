<script setup lang="ts">
/**
 * S2 T1 Reaksi (FR-M12-32, 33; URS EP-M12-3): the tab strip and four cards, no filter, no count, no
 * breakdown. T1 is global: `school_id` and `state` in the URL change nothing.
 */
import { fetchKirkpatrickReaction } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
  KirkpatrickStatCard,
  KirkpatrickTabs,
  mean,
  STAT_TONE,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

withDefaults(defineProps<{ basePath?: string }>(), { basePath: KIRKPATRICK_ADMIN_BASE })

const { data, error, loading } = useKirkpatrickPage((signal) =>
  fetchKirkpatrickReaction({ signal }),
)
</script>

<template>
  <div class="min-w-0" data-testid="kirk-reaction-page">
    <KirkpatrickTabs :base-path="basePath" current="reaction" />

    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />

    <div
      v-if="data"
      class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      data-testid="kirk-reaction-cards"
    >
      <KirkpatrickStatCard
        label="NPS Pelajar"
        :value="`${mean(data.npsStudent)}/10`"
        :tone="STAT_TONE.purple"
        data-testid="kirk-nps-student"
      />
      <KirkpatrickStatCard
        label="NPS Guru"
        :value="`${mean(data.npsTeacher)}/10`"
        :tone="STAT_TONE.blue"
        data-testid="kirk-nps-teacher"
      />
      <KirkpatrickStatCard
        label="NPS Admin"
        :value="`${mean(data.npsAdmin)}/10`"
        :tone="STAT_TONE.amber"
        data-testid="kirk-nps-admin"
      />
      <KirkpatrickStatCard
        label="Kepuasan Purata"
        :value="`${mean(data.satisfaction)}/5`"
        :tone="STAT_TONE.emerald"
        data-testid="kirk-satisfaction"
      />
    </div>
  </div>
</template>
