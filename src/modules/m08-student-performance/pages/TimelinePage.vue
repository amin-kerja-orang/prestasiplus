<script setup lang="ts">
/**
 * S16 `/timeline` "Timeline Saya" (M08-T3; FR-M08-97..99, FN-M08-6.1.*), from `GET /api/timeline`: heading,
 * "Tambah Post", the empty card or the posts (newest first, PROPOSED layout), and the "Profil Awam Anda"
 * box with the viewer's own public link (DV-19) and a copy button (`fa-copy` / `fa-check` for 2,000ms, only when the write succeeds).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { DsEmptyState, DsIconChip, DsLoadError, DsPage, DsPanel } from '@/ds'

import { fetchTimeline } from '../api/performance'
import PostCard from '../components/timeline/PostCard.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { copyText } from '../lib/timeline/clipboard'
import { sortPosts } from '../lib/timeline/posts'
import { absoluteUrl } from '../lib/timeline/profile'

const { data, error, reload } = useRouteData((signal) => fetchTimeline({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const posts = computed(() => sortPosts(data.value?.posts ?? []))
const publicUrl = computed(() => (data.value ? absoluteUrl(data.value.profileUrl) : ''))

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(): Promise<void> {
  if (!(await copyText(publicUrl.value))) return
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

onBeforeUnmount(() => {
  clearTimeout(timer)
})
</script>

<template>
  <DsPage
    title="📸 Timeline Saya"
    subtitle="Kongsi sijil, pencapaian, aktiviti &amp; cerita anda"
    data-testid="timeline-page"
  >
    <template v-if="data" #actions>
      <UButton
        to="/timeline/create"
        icon="i-ph-plus"
        label="Tambah Post"
        size="lg"
        data-testid="add-post"
      />
    </template>

    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="posts.length === 0" data-testid="timeline-empty">
        <DsEmptyState
          title="Timeline Kosong"
          description="Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!"
          icon="images"
          friend="aisyah"
        >
          <template #actions>
            <UButton
              to="/timeline/create"
              icon="i-ph-plus"
              label="Tambah Post Pertama"
              size="lg"
              data-testid="add-first"
            />
          </template>
        </DsEmptyState>
      </div>

      <ol v-else class="flex flex-col gap-4" data-testid="timeline-posts">
        <li v-for="p in posts" :key="p.id" class="flex min-w-0 gap-3">
          <DsIconChip icon="i-ph-image-duotone" accent="heat" size="sm" class="mt-1 shrink-0" />
          <PostCard :post="p" class="grow" />
        </li>
      </ol>

      <DsPanel data-testid="public-profile-box">
        <div class="flex items-center gap-3">
        <DsIconChip icon="i-ph-globe" accent="friend" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="text-label text-highlighted">Profil Awam Anda</p>
          <ULink
            :href="publicUrl"
            target="_blank"
            class="block min-h-6 text-caption break-all text-primary-t"
            data-testid="public-url"
            >{{ publicUrl }}</ULink
          >
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          :icon="copied ? 'i-ph-check' : 'i-ph-copy'"
          :aria-label="copied ? 'Disalin' : 'Salin pautan'"
          data-testid="copy-url"
          :data-copied="copied"
          @click="copy"
        />
        </div>
      </DsPanel>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
