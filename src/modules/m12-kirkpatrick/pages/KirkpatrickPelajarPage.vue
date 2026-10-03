<script setup lang="ts">
/**
 * S8 Student Kirkpatrick detail (FR-M12-77 ... 84; URS EP-M12-9). Mounted on `/admin/kirkpatrick/pelajar/:userId` and the
 * `/guru` twin. An id that is not an accessible student answers 403 and renders the standalone 403 page in
 * place (FR-M12-17; the live second ids 5571 / 5551 are not user ids here). The shell header and the tab title
 * are "Kirkpatrick — {nama}" (DV-M12-03).
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { usePageMeta } from '@/composables'

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
  <div class="mx-auto max-w-5xl min-w-0 space-y-4" data-testid="kirk-pelajar">
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1
            class="font-heading text-xl font-bold break-words text-gray-900 sm:text-2xl"
            data-testid="pel-name"
          >
            {{ data.student.name }}
          </h1>
          <p class="text-sm text-gray-500" data-testid="pel-school">
            {{ data.student.schoolName
            }}<template v-if="data.student.grade !== null">
              · Tingkatan {{ tingkatanOf(data.student.grade) }}</template
            >
          </p>
        </div>
        <RouterLink
          :to="paths.behavior"
          class="flex min-h-11 items-center text-sm text-indigo-600 hover:underline"
          data-testid="pel-back"
          >← Kembali ke Tahap 3</RouterLink
        >
      </header>
      <PelajarAlesa :data="data" />
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PelajarHeadcount :headcount="data.headcount" />
        <PelajarPlatform :platform="data.platform" />
      </div>
    </template>
  </div>
</template>
