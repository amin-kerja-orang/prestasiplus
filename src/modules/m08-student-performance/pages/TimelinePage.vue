<script setup lang="ts">
/**
 * S16 `/timeline` "Timeline Saya" (M08-T3; FR-M08-97..99, FN-M08-6.1.*), from `GET /api/timeline`: heading,
 * "Tambah Post", the empty card or the posts (newest first, PROPOSED layout), and the "Profil Awam Anda"
 * box with the viewer's own public link (DV-19) and a copy button (`fa-copy` / `fa-check` for 2,000ms).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { DsEmptyState, DsIconChip, DsPage } from '@/ds'

import { fetchTimeline } from '../api/performance'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import PostCard from '../components/timeline/PostCard.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'
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
  await copyText(publicUrl.value)
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
  <DsPage data-testid="timeline-page">
    <PageLoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-title text-highlighted">📸 Timeline Saya</h1>
          <p class="text-body text-muted">Kongsi sijil, pencapaian, aktiviti &amp; cerita anda</p>
        </div>
        <UButton
          to="/timeline/create"
          icon="i-ph-plus"
          label="Tambah Post"
          size="lg"
          data-testid="add-post"
        />
      </div>

      <div v-if="posts.length === 0" data-testid="timeline-empty">
        <DsEmptyState
          title="Timeline Kosong"
          description="Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!"
          icon="i-ph-images"
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
          <DsIconChip icon="i-ph-image-duotone" accent="action" size="sm" class="mt-1 shrink-0" />
          <PostCard :post="p" class="grow" />
        </li>
      </ol>

      <UCard data-testid="public-profile-box">
       <div class="flex items-center gap-3">
        <DsIconChip icon="i-ph-globe" accent="action" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="text-label text-highlighted">Profil Awam Anda</p>
          <ULink
            :href="publicUrl"
            target="_blank"
            class="block min-h-6 text-caption break-all text-primary"
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
      </UCard>
    </template>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
