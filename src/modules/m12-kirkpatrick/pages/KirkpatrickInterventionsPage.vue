<script setup lang="ts">
/**
 * S7 Intervensi (FR-M12-70 ... 76; URS EP-M12-8). Mounted on `/admin/kirkpatrick/interventions` and the `/guru`
 * twin. Both query parameters are ignored. A saved record reloads the KPIs and the list.
 */
import { DsLoadError, DsPage } from '@/ds'

import { fetchKirkpatrickInterventions } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickTabs,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import InterventionForm from '../components/kirkpatrick/interventions/InterventionForm.vue'
import InterventionKpis from '../components/kirkpatrick/interventions/InterventionKpis.vue'
import InterventionList from '../components/kirkpatrick/interventions/InterventionList.vue'

withDefaults(defineProps<{ basePath?: string }>(), { basePath: KIRKPATRICK_ADMIN_BASE })

const { data, error, loading, reload } = useKirkpatrickPage((signal) =>
  fetchKirkpatrickInterventions({ signal }),
)
</script>

<template>
  <DsPage
    data-testid="kirk-interventions"
    subtitle="Rekod tindakan intervensi berdasarkan amaran Kirkpatrick"
  >
    <KirkpatrickTabs :base-path="basePath" current="interventions" />
    <DsLoadError v-if="error" testid="kirk-error" @retry="reload" />
    <p
      v-else-if="data === null && loading"
      class="flex items-center gap-2 text-label text-muted"
      data-testid="kirk-loading"
      role="status"
    >
      <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
    </p>
    <template v-if="data">
      <InterventionKpis :kpi="data.kpi" />
      <InterventionForm @saved="reload" />
      <InterventionList :rows="data.rows" />
    </template>
  </DsPage>
</template>
