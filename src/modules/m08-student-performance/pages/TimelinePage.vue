<script setup lang="ts">
/**
 * S16 `/timeline` "Timeline Saya" (M08-T3; FR-M08-97..99, FN-M08-6.1.*), from `GET /api/timeline`: heading,
 * "Tambah Post", the empty card or the posts (newest first, PROPOSED layout), and the "Profil Awam Anda"
 * box with the viewer's own public link (DV-19) and a copy button (`fa-copy` / `fa-check` for 2,000ms).
 */
import { Check, Copy, Globe, Images, Plus } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'

import { fetchTimeline } from '../api/performance'
import PostCard from '../components/timeline/PostCard.vue'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
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

const ADD_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="timeline-page">
    <div v-if="loadFailed" class="space-y-3" data-testid="page-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="data">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-xl font-bold text-slate-800 sm:text-2xl">
            📸 Timeline Saya
          </h2>
          <p class="text-sm text-slate-500">Kongsi sijil, pencapaian, aktiviti &amp; cerita anda</p>
        </div>
        <RouterLink to="/timeline/create" :class="ADD_BUTTON" data-testid="add-post">
          <Plus class="h-4 w-4" /> Tambah Post
        </RouterLink>
      </div>

      <div
        v-if="posts.length === 0"
        class="flex flex-col items-center px-4 py-12 text-center sm:py-16"
        data-testid="timeline-empty"
      >
        <span
          class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500"
        >
          <Images class="h-10 w-10" />
        </span>
        <h3 class="mt-5 text-lg font-bold text-slate-800">Timeline Kosong</h3>
        <p class="mt-2 max-w-md text-slate-500">
          Mula kongsi pencapaian, sijil, dan cerita anda untuk ditunjukkan pada profil awam anda!
        </p>
        <RouterLink to="/timeline/create" :class="[ADD_BUTTON, 'mt-5']" data-testid="add-first">
          <Plus class="h-4 w-4" /> Tambah Post Pertama
        </RouterLink>
      </div>

      <div v-else class="space-y-4" data-testid="timeline-posts">
        <PostCard v-for="p in posts" :key="p.id" :post="p" />
      </div>

      <div
        class="flex items-center gap-3 rounded-2xl bg-white/70 p-4 shadow-sm"
        data-testid="public-profile-box"
      >
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
        >
          <Globe class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-slate-800">Profil Awam Anda</p>
          <a
            :href="publicUrl"
            target="_blank"
            class="block text-xs break-all text-indigo-600 hover:underline"
            data-testid="public-url"
            >{{ publicUrl }}</a
          >
        </div>
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
          data-testid="copy-url"
          :data-copied="copied"
          @click="copy"
        >
          <Check v-if="copied" class="h-4 w-4" data-icon="fa-check" />
          <Copy v-else class="h-4 w-4" data-icon="fa-copy" />
        </button>
      </div>
    </template>
  </div>
</template>
