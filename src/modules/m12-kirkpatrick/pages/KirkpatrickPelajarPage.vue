<script setup lang="ts">
/**
 * S8 Student Kirkpatrick detail (FR-M12-77 ... 84; URS EP-M12-9). Mounted on `/admin/kirkpatrick/pelajar/:userId` and the
 * `/guru` twin. An id that is not an accessible student answers 403 and renders the standalone 403 page in
 * place (FR-M12-17; the live second ids 5571 / 5551 are not user ids here). The shell header and the tab title
 * are "Kirkpatrick — {nama}" (DV-M12-03).
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsBackLink, DsLoadError, DsPage, DsGrid } from '@/ds'

import { fetchKirkpatrickStudent } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
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
  reload,
} = useKirkpatrickPage(
  (signal) => fetchKirkpatrickStudent(props.userId, { signal }),
  () => props.userId,
)

/** `useApi` keeps the previous result while it reloads: show only the student of the current id (S8 to S8 navigation). */
const data = computed(() => (loaded.value?.student.id === props.userId ? loaded.value : null))

/** "{sekolah} · Tingkatan {n}" under the name. */
const subtitle = computed(() => {
  const d = data.value
  if (!d) return undefined
  return d.student.grade === null
    ? d.student.schoolName
    : `${d.student.schoolName} · Tingkatan ${tingkatanOf(d.student.grade)}`
})

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
  <DsPage
    data-testid="kirk-pelajar"
    :title="data?.student.name"
    :subtitle="subtitle"
    :show-title="true"
    title-testid="pel-name"
    subtitle-testid="pel-school"
  >
    <template v-if="data" #actions>
      <DsBackLink :to="paths.behavior" label="Kembali ke Tahap 3" data-testid="pel-back" />
    </template>
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
      <PelajarAlesa :data="data" />
      <DsGrid :cols="{ base: 1, md: 2 }">
        <PelajarHeadcount :headcount="data.headcount" />
        <PelajarPlatform :platform="data.platform" />
      </DsGrid>
    </template>
  </DsPage>
</template>
