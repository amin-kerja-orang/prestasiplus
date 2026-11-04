<script setup lang="ts">
/**
 * `/admin/videos` "Video" (R1-ADM-N-01; BannerListPage pattern). Columns Tajuk, Kategori, Subjek,
 * Tontonan, Tarikh; filter Subjek (from the list facets); actions Tambah Video, Edit (`/video/:id/edit`)
 * and Padam (confirm "Padam video ini?"); 25 per page (`pageSize`). No Tingkatan, Bab, Status filter or
 * hide toggle (doc defect: the table has no such columns).
 */
import { ADMIN_VIDEO_PAGE_SIZE } from '@pp/contract'
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsLoadError, DsPage, DsPanel, DsRowActions, useConfirm } from '@/ds'
import type { CardField, RowAction } from '@/ds'

import { deleteVideo, fetchVideos } from '../api/content'
import type { VideoCard, VideoListQuery } from '../api/types'
import { COPY, dmy, errorLines } from '../lib/admin-media/common'
import { cellClass } from '../lib/table-cols'
import { VIDEO_ADD_PATH, videoEditPath } from '../lib/video'

const flash = useFlash()
const confirm = useConfirm()

const page = ref(1)
const subject = ref('all')

const { data, error, reload } = useApi(
  (signal) => {
    const query: VideoListQuery = { page: page.value, pageSize: ADMIN_VIDEO_PAGE_SIZE }
    if (subject.value !== 'all') query.subject = Number(subject.value)
    return fetchVideos(query, { signal })
  },
  [page, subject],
)

const rows = computed<VideoCard[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const filtered = computed(() => subject.value !== 'all')

/** The Subjek options come from the facets of the unfiltered list; kept so the select survives a filter. */
const subjectFacets = ref<{ id: number; name: string }[]>([])
watch(data, (d) => {
  if (d && subject.value === 'all') subjectFacets.value = d.meta.facets.subjects
})
const subjectItems = computed(() => [
  { label: 'Semua', value: 'all' },
  ...subjectFacets.value.map((s) => ({ label: s.name, value: String(s.id) })),
])
watch(subject, () => {
  page.value = 1
})

interface TableRow extends Record<string, unknown> {
  id: number
  title: string
  category: string
  subjectName: string
  views: number
  date: string
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((v) => ({
    id: v.id,
    title: v.title,
    category: v.categoryLabel,
    subjectName: v.subject?.name ?? '—',
    views: v.views,
    date: dmy(v.createdAt.slice(0, 10)),
  })),
)

const deleting = ref(false)

async function remove(id: number): Promise<void> {
  if (deleting.value) return
  const ok = await confirm({
    message: COPY.confirmDeleteVideo,
    confirmLabel: COPY.confirmDeleteYes,
    cancelLabel: COPY.confirmCancel,
    tone: 'error',
  })
  if (!ok) return
  deleting.value = true
  try {
    const result = await deleteVideo(id)
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    else await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}

function actionsOf(id: number): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-ph-pencil-simple', to: videoEditPath(id) },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      onSelect: () => void remove(id),
    },
  ]
}

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'title', header: 'Tajuk', ...cellClass('') },
  { accessorKey: 'category', header: 'Kategori', ...cellClass('w-32') },
  { accessorKey: 'subjectName', header: 'Subjek', ...cellClass('w-40') },
  { accessorKey: 'views', header: 'Tontonan', ...cellClass('w-24') },
  { accessorKey: 'date', header: 'Tarikh', ...cellClass('w-28') },
  { id: 'actions', header: 'Tindakan', ...cellClass('w-24 text-end') },
]
const cardFields: CardField[] = [
  { key: 'category', label: 'Kategori' },
  { key: 'subjectName', label: 'Subjek' },
  { key: 'views', label: 'Tontonan' },
  { key: 'date', label: 'Tarikh' },
]
</script>

<template>
  <DsPage :subtitle="`Jumlah: ${total} video`" subtitle-testid="videos-count" data-testid="admin-videos-page">
    <template #actions>
      <UButton
        :to="VIDEO_ADD_PATH"
        icon="i-ph-plus"
        label="Tambah Video"
        class="min-h-11"
        data-testid="videos-add"
      />
    </template>

    <div class="flex max-w-xs flex-col gap-1">
      <label for="video-subject-filter" class="text-label text-default">Subjek</label>
      <USelect
        id="video-subject-filter"
        v-model="subject"
        :items="subjectItems"
        class="w-full"
        data-testid="videos-subject-filter"
      />
    </div>

    <DsLoadError v-if="error" :message="COPY.loadFailed" testid="videos-error" @retry="reload()" />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="videos-empty">
      <DsEmptyState :title="COPY.videosEmpty" icon="i-ph-film-slate" />
    </DsPanel>

    <DsDataTable
      v-else
      v-model:page="page"
      variant="flush"
      layout="fixed"
      density="compact"
      :data="tableRows"
      :columns="columns"
      caption="Senarai video"
      :loading="firstLoad"
      :total="total"
      :page-size="ADMIN_VIDEO_PAGE_SIZE"
      :filtered="filtered"
      card-title="title"
      :card-fields="cardFields"
      data-testid="videos-table"
    >
      <template #title-cell="{ row }">
        <p
          class="line-clamp-2 text-label text-highlighted"
          :title="row.original.title"
          data-testid="video-row"
          :data-video-id="row.original.id"
        >
          {{ row.original.title }}
        </p>
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.id)" :inline="1" />
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="actionsOf((row as unknown as TableRow).id)" :inline="1" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
