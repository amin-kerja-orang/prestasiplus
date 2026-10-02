<script setup lang="ts">
/**
 * S17 grid card (URS FN-M09-6.1.6; FR-M09-79): thumbnail with the platform chip and the hover
 * `fa-play` overlay, title, uploader initial + name + role label, "{n} tontonan" and the relative
 * date. The whole card links to the detail page.
 */
import { Play } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import type { VideoCard } from '../../api/types'
import { COPY, videoPath } from '../../lib/video'
import VideoThumb from './VideoThumb.vue'

defineProps<{ video: VideoCard }>()
</script>

<template>
  <RouterLink
    :to="videoPath(video.id)"
    class="group block min-w-0 overflow-hidden rounded-2xl bg-white shadow transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    data-testid="video-card"
    :data-video-id="video.id"
  >
    <div class="relative aspect-video overflow-hidden bg-slate-200">
      <VideoThumb :thumbnail-url="video.thumbnailUrl" />
      <span
        class="absolute top-2 left-2 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
        data-testid="video-card-platform"
        >{{ video.platformLabel }}</span
      >
      <div
        class="absolute inset-0 hidden items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100 lg:flex"
        data-testid="video-card-overlay"
      >
        <Play class="h-10 w-10 fill-white text-white" aria-hidden="true" />
      </div>
    </div>
    <div class="p-3 sm:p-4">
      <h3
        class="line-clamp-2 min-h-10 font-heading text-sm leading-5 font-bold text-slate-800"
        data-testid="video-card-title"
      >
        {{ video.title }}
      </h3>
      <div class="mt-3 flex min-w-0 items-center gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-orange-500 text-xs font-bold text-white"
          data-testid="video-card-initial"
          >{{ video.uploader.initial }}</span
        >
        <div class="min-w-0 leading-tight">
          <p
            class="truncate text-xs font-semibold text-slate-700"
            data-testid="video-card-uploader"
          >
            {{ video.uploader.name }}
          </p>
          <p class="text-xs text-slate-400 capitalize" data-testid="video-card-role">
            {{ video.uploader.roleLabel }}
          </p>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap justify-between gap-x-2 text-xs text-slate-500">
        <span data-testid="video-card-views">{{ COPY.views(video.views) }}</span>
        <span data-testid="video-card-date">{{ diffForHumans(video.createdAt) }}</span>
      </div>
    </div>
  </RouterLink>
</template>
