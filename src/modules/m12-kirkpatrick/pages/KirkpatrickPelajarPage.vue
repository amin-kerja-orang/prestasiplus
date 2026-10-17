<script setup lang="ts">
/**
 * S8 Student Kirkpatrick detail (FR-M12-77 ... 84; URS EP-M12-9). Mounted on `/admin/kirkpatrick/pelajar/:userId` and the
 * `/guru` twin. An id that is not an accessible student answers 403 and renders the standalone 403 page in
 * place (FR-M12-17; the live second ids 5571 / 5551 are not user ids here). The shell header and the tab title
 * are "Kirkpatrick — {nama}" (DV-M12-03).
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsPage } from '@/ds'

import { fetchKirkpatrickStudent } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
  kirkpatrickPaths,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import PelajarAlesa from '../components/kirkpatrick/pelajar/PelajarAlesa.vue'
import PelajarHeadcount from '../components/kirkpatrick/pelajar/PelajarHeadcount.vue'
import PelajarPlatform from '../components/kirkpatrick/pelajar/PelajarPlatform.vue'
import { tingkatanOf } from '../components/kirkpatrick/pelajar/pelajar-format'

const props = withDefaults(defineProps<{ userId: number; basePath?: string }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
})

const paths = computed(() => kirkpatrickPaths(props.basePath))
const pageMeta = usePageMeta()

const {
  data: loaded,
  error,
  loading,
} = useKirkpatrickPage(
  (signal) => fetchKirkpatrickStudent(props.userId, { signal }),
  () => props.userId,
)

/** `useApi` keeps the previous result while it reloads: show only the student of the current id (S8 to S8 navigation). */
const data = computed(() => (loaded.value?.student.id === props.userId ? loaded.value : null))

watch(
  data,
  (d) => {
    if (!d) return
    const title = `Kirkpatrick — ${d.student.name}`
    pageMeta.setTitle(title)
    pageMeta.setHeader({ title })
  },
  { immediate: true },
)
</script>

<template>
  <DsPage data-testid="kirk-pelajar">
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-title break-words text-highlighted" data-testid="pel-name">
            {{ data.student.name }}
          </h1>
          <p class="text-body text-muted" data-testid="pel-school">
            {{ data.student.schoolName
            }}<template v-if="data.student.grade !== null">
              · Tingkatan {{ tingkatanOf(data.student.grade) }}</template
            >
          </p>
        </div>
        <UButton
          :to="paths.behavior"
          size="lg"
          class="min-h-11"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left"
          label="Kembali ke Tahap 3"
          data-testid="pel-back"
        />
      </header>
      <PelajarAlesa :data="data" />
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PelajarHeadcount :headcount="data.headcount" />
        <PelajarPlatform :platform="data.platform" />
      </div>
    </template>
  </DsPage>
</template>
