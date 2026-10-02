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
 */
import { ArrowLeft, BookOpen, Pencil, Trash2, CirclePlay } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { confirmNative, useApi, useFlash, usePageMeta } from '@/composables'
import { formatDateEn } from '@/lib/time'

import { deleteVideo, fetchVideo } from '../api/content'
import VideoPlayerFrame from '../components/video/VideoPlayerFrame.vue'
import VideoThumb from '../components/video/VideoThumb.vue'
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

const ACTION =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2'
</script>

<template>
  <div class="min-w-0 space-y-5 sm:space-y-6" data-testid="video-detail-page">
    <AlertBox
      v-if="error && !notFound"
      :messages="errorLines(error)"
      data-testid="video-detail-error"
    />

    <template v-else-if="video">
      <nav
        class="flex min-w-0 items-center gap-2 text-sm text-slate-500"
        aria-label="Breadcrumb"
        data-testid="video-breadcrumb"
      >
        <RouterLink
          :to="VIDEO_PATH"
          class="inline-flex min-h-11 shrink-0 items-center gap-2 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="video-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          {{ COPY.allVideos }}
        </RouterLink>
        <span aria-hidden="true">/</span>
        <span class="min-w-0 truncate font-medium text-slate-700">{{ video.title }}</span>
      </nav>

      <VideoPlayerFrame
        :embed-url="video.embedUrl"
        :video-url="video.videoUrl"
        :title="video.title"
      />

      <article class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h1
              class="font-heading text-xl font-bold break-words text-slate-900 sm:text-2xl"
              data-testid="video-title"
            >
              {{ video.title }}
            </h1>
            <p class="mt-2 text-sm text-slate-500" data-testid="video-meta">
              <span data-testid="video-views">{{ COPY.views(video.views) }}</span>
              <span class="mx-2" aria-hidden="true">·</span>
              <span data-testid="video-date">{{ formatDateEn(video.createdAt) }}</span>
            </p>
          </div>
          <div v-if="video.canManage" class="flex shrink-0 gap-2" data-testid="video-actions">
            <RouterLink
              :to="videoEditPath(video.id)"
              :class="[
                ACTION,
                'border-blue-200 bg-blue-50 text-blue-600 focus-visible:ring-blue-300',
              ]"
              data-testid="video-edit"
            >
              <Pencil class="h-4 w-4" aria-hidden="true" />
              {{ COPY.edit }}
            </RouterLink>
            <button
              type="button"
              :disabled="busy"
              :class="[ACTION, 'border-red-200 bg-red-50 text-red-600 focus-visible:ring-red-300']"
              data-testid="video-delete"
              @click="remove"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" />
              {{ COPY.remove }}
            </button>
          </div>
        </div>

        <AlertBox v-if="failure.length" :messages="failure" class="mt-4" />

        <div class="mt-3 flex flex-wrap gap-2" data-testid="video-chips">
          <span
            class="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
            data-testid="video-chip-platform"
          >
            <CirclePlay class="h-3.5 w-3.5" aria-hidden="true" />
            {{ video.platformLabel }}
          </span>
          <span
            class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-orange-700"
            data-testid="video-chip-category"
            >{{ video.categoryLabel }}</span
          >
          <span
            v-if="video.subject"
            class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
            data-testid="video-chip-subject"
          >
            <BookOpen class="h-3.5 w-3.5" aria-hidden="true" />
            {{ video.subject.name }}
          </span>
        </div>

        <div
          class="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3"
          data-testid="video-uploader"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-orange-500 font-bold text-white"
            >{{ video.uploader.initial }}</span
          >
          <div class="min-w-0 leading-tight">
            <p
              class="truncate text-sm font-semibold text-slate-800"
              data-testid="video-uploader-name"
            >
              {{ video.uploader.name }}
            </p>
            <p class="text-xs text-slate-500 capitalize" data-testid="video-uploader-role">
              {{ video.uploader.roleLabel }}
            </p>
          </div>
        </div>

        <p
          v-if="video.description"
          class="mt-4 text-sm leading-6 break-words whitespace-pre-line text-slate-700"
          data-testid="video-description"
        >
          {{ video.description }}
        </p>
      </article>

      <section v-if="video.related.length > 0" data-testid="video-related">
        <h2 class="mb-3 font-heading text-lg font-bold text-slate-800">{{ COPY.related }}</h2>
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="r in video.related" :key="r.id" class="min-w-0">
            <RouterLink
              :to="videoPath(r.id)"
              class="block overflow-hidden rounded-2xl bg-white shadow transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              data-testid="video-related-card"
              :data-video-id="r.id"
            >
              <div class="aspect-video overflow-hidden bg-slate-200">
                <VideoThumb :thumbnail-url="r.thumbnailUrl" />
              </div>
              <div class="p-3">
                <h3 class="line-clamp-2 text-sm font-semibold text-slate-800">{{ r.title }}</h3>
                <p class="mt-1 truncate text-xs text-slate-500">
                  {{ r.uploader.name }} · {{ COPY.views(r.views) }}
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
