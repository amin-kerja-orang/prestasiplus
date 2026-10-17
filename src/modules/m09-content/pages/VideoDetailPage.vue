<script setup lang="ts">
/**
 * S18 `/video/:id` (M09-T3; FR-M09-83..86, URS FT-M09-6.3). Header "Video" / {title}, tab
 * "{title} - Video PRESTASIPLUS", back link, the live YouTube player iframe (D22), h1, "{n} tontonan" ·
 * "dd Mon yyyy", chips, uploader, description and "Video Berkaitan". "Edit" and "Padam" show only
 * when the API says `canManage` (uploader or admin, BR-M09-21). An unknown or hidden id is the
 * global 404 page.
 *
 * L-7 (decided here): guests may open a video (the API is public, BR-M09-31); the page then renders
 * in the public layout (no CTA: that section is only for `/video`).
 *
 * v2 restyle (B04): player card, title block on a card, related strip of `DsMediaCard`s.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { confirmNative, useApi, useFlash, usePageMeta } from '@/composables'
import { DsMediaCard, DsPage } from '@/ds'
import { formatDateEn } from '@/lib/time'

import { deleteVideo, fetchVideo } from '../api/content'
import VideoPlayerFrame from '../components/video/VideoPlayerFrame.vue'
import {
  COPY,
  VIDEO_PATH,
  VIDEO_TITLES,
  errorLines,
  isStatus,
  videoEditPath,
  videoPath,
} from '../lib/video'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()

const { data: video, error } = useApi(
  (signal) => fetchVideo(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isStatus(error.value, 404))
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

watch(
  video,
  (row) => {
    if (!row) return
    pageMeta.setHeader({ title: COPY.detailHeader, subtitle: row.title })
    pageMeta.setTitle(VIDEO_TITLES.detail(row.title))
  },
  { immediate: true },
)

const busy = ref(false)
const failure = ref<string[]>([])

async function remove(): Promise<void> {
  if (!video.value || busy.value) return
  if (!confirmNative(COPY.confirmDelete)) return
  busy.value = true
  failure.value = []
  try {
    const result = await deleteVideo(video.value.id)
    flash.success(result.status)
    await router.push(VIDEO_PATH)
  } catch (err) {
    failure.value = errorLines(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage data-testid="video-detail-page">
    <UAlert
      v-if="error && !notFound"
      color="error"
      variant="soft"
      icon="i-ph-warning-duotone"
      :description="errorLines(error).join(' ')"
      data-testid="video-detail-error"
    />

    <template v-else-if="video">
      <nav
        class="flex min-w-0 items-center gap-2 text-label text-muted"
        aria-label="Breadcrumb"
        data-testid="video-breadcrumb"
      >
        <UButton
          :to="VIDEO_PATH"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left"
          class="shrink-0"
          data-testid="video-back"
          >{{ COPY.allVideos }}</UButton
        >
        <span aria-hidden="true">/</span>
        <span class="min-w-0 truncate text-default">{{ video.title }}</span>
      </nav>

      <VideoPlayerFrame
        :embed-url="video.embedUrl"
        :video-url="video.videoUrl"
        :title="video.title"
      />

      <UCard as="article" class="min-w-0">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h1 class="text-heading break-words text-highlighted" data-testid="video-title">
                {{ video.title }}
              </h1>
              <p class="mt-2 text-label text-muted" data-testid="video-meta">
                <span class="tabular" data-testid="video-views">{{ COPY.views(video.views) }}</span>
                <span class="mx-2" aria-hidden="true">·</span>
                <span class="tabular" data-testid="video-date">{{
                  formatDateEn(video.createdAt)
                }}</span>
              </p>
            </div>
            <div v-if="video.canManage" class="flex shrink-0 gap-2" data-testid="video-actions">
              <UButton
                :to="videoEditPath(video.id)"
                color="neutral"
                variant="soft"
                icon="i-ph-pencil-simple-duotone"
                data-testid="video-edit"
                >{{ COPY.edit }}</UButton
              >
              <UButton
                color="error"
                variant="soft"
                icon="i-ph-trash-duotone"
                :disabled="busy"
                data-testid="video-delete"
                @click="remove"
                >{{ COPY.remove }}</UButton
              >
            </div>
          </div>

          <UAlert
            v-if="failure.length"
            color="error"
            variant="soft"
            :description="failure.join(' ')"
          />

          <div class="flex flex-wrap gap-2" data-testid="video-chips">
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-ph-play-circle-duotone"
              :label="video.platformLabel"
              data-testid="video-chip-platform"
            />
            <UBadge
              color="neutral"
              variant="soft"
              :label="video.categoryLabel"
              data-testid="video-chip-category"
            />
            <UBadge
              v-if="video.subject"
              color="neutral"
              variant="soft"
              icon="i-ph-book-open-duotone"
              :label="video.subject.name"
              data-testid="video-chip-subject"
            />
          </div>

          <UCard variant="soft" data-testid="video-uploader">
            <div class="flex items-center gap-3">
              <UAvatar :text="video.uploader.initial" size="lg" />
              <div class="min-w-0">
                <p class="truncate text-label text-highlighted" data-testid="video-uploader-name">
                  {{ video.uploader.name }}
                </p>
                <p class="text-caption text-muted" data-testid="video-uploader-role">
                  {{ video.uploader.roleLabel }}
                </p>
              </div>
            </div>
          </UCard>

          <p
            v-if="video.description"
            class="max-w-prose text-body break-words whitespace-pre-line text-default"
            data-testid="video-description"
          >
            {{ video.description }}
          </p>
        </div>
      </UCard>

      <section
        v-if="video.related.length > 0"
        class="flex flex-col gap-3"
        data-testid="video-related"
      >
        <h2 class="text-heading text-highlighted">{{ COPY.related }}</h2>
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <li v-for="r in video.related" :key="r.id" class="min-w-0">
            <DsMediaCard
              kind="video"
              :title="r.title"
              :thumb="r.thumbnailUrl ?? undefined"
              :meta="`${r.uploader.name} · ${COPY.views(r.views)}`"
              :to="videoPath(r.id)"
              data-testid="video-related-card"
              :data-video-id="r.id"
            />
          </li>
        </ul>
      </section>
    </template>
  </DsPage>
</template>
