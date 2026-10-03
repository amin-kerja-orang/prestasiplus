<script setup lang="ts">
/**
 * FR-M05-21 / 22: the articles of S1 — `strip` is the horizontally scrolling "Artikel Untuk Kamu"
 * card row in the main column, `aside` the "Artikel Terkini" list of the 300 px column (≥1024 px;
 * the caller only renders it there). Both show M09's 5 newest articles.
 */
import { ArrowRight, Newspaper } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import type { DashboardArticle } from '../../api/types'

defineProps<{ articles: DashboardArticle[]; variant: 'strip' | 'aside' }>()

const when = (a: DashboardArticle): string => (a.publishedAt ? diffForHumans(a.publishedAt) : '')
</script>

<template>
  <div v-if="variant === 'strip'" class="card" data-testid="dash-articles">
    <div class="mb-3 flex items-center justify-between gap-3 sm:mb-6">
      <h2
        class="text-lg font-black text-slate-800 sm:text-2xl md:text-3xl"
        style="font-family: 'Outfit', sans-serif"
      >
        📚 Artikel Untuk Kamu
      </h2>
      <RouterLink
        to="/artikel"
        class="relative flex items-center gap-2 text-base font-black whitespace-nowrap text-indigo-600 transition after:absolute after:inset-x-0 after:-inset-y-2.5 hover:text-indigo-700"
        data-testid="dash-articles-all"
      >
        Lihat Semua <ArrowRight class="h-4 w-4" />
      </RouterLink>
    </div>
    <div class="scrollbar-hide flex gap-5 overflow-x-auto pb-6" data-testid="dash-articles-strip">
      <RouterLink
        v-for="a in articles"
        :key="a.slug"
        :to="`/artikel/${a.slug}`"
        class="group w-72 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-xl"
        data-testid="dash-article-card"
      >
        <div
          class="flex h-40 items-center justify-center bg-linear-to-br from-indigo-400 via-purple-400 to-pink-400"
        >
          <Newspaper class="h-8 w-8 text-white opacity-60" />
        </div>
        <div class="p-4">
          <span
            class="mb-2 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700 uppercase"
            data-testid="dash-article-chip"
          >
            {{ a.category }}
          </span>
          <p
            class="mb-2 line-clamp-2 text-base font-black text-slate-700 transition group-hover:text-indigo-600"
            style="font-family: 'Outfit', sans-serif"
          >
            {{ a.title }}
          </p>
          <p class="text-xs font-semibold text-slate-400">{{ when(a) }}</p>
        </div>
      </RouterLink>
    </div>
  </div>

  <div
    v-else
    class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm"
    data-testid="dash-aside"
  >
    <h3
      class="mb-4 flex items-center gap-2 text-lg font-black text-slate-800"
      style="font-family: 'Outfit', sans-serif"
    >
      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
        <Newspaper class="h-4 w-4 text-indigo-600" />
      </span>
      Artikel Terkini
    </h3>
    <div class="space-y-4">
      <RouterLink
        v-for="a in articles"
        :key="a.slug"
        :to="`/artikel/${a.slug}`"
        class="group flex gap-3"
        data-testid="dash-aside-article"
      >
        <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
          <div
            class="flex h-full w-full items-center justify-center bg-linear-to-br from-indigo-400 via-purple-400 to-pink-400"
          >
            <Newspaper class="h-3 w-3 text-white opacity-70" />
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <p
            class="line-clamp-2 text-sm leading-snug font-bold text-slate-700 transition group-hover:text-indigo-600"
          >
            {{ a.title }}
          </p>
          <p class="mt-1 text-xs font-medium text-slate-400">{{ when(a) }}</p>
        </div>
      </RouterLink>
    </div>
    <RouterLink
      to="/artikel"
      class="relative mt-4 block rounded-xl py-2 text-center text-sm font-bold text-indigo-600 transition after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-indigo-50 hover:text-indigo-700"
      data-testid="dash-aside-all"
    >
      Lihat Semua Artikel <ArrowRight class="ml-1 inline h-4 w-4" />
    </RouterLink>
  </div>
</template>
