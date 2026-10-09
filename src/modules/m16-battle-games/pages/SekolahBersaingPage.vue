<script setup lang="ts">
/**
 * S28 `/sekolah-bersaing` (`?week=`; FR-M16-127..131, BR-M16-35; URS FN-M16-10.1.1 ... 10.1.6): the
 * centred yellow-amber hero, the week line "Minggu {dd Mon yyyy} · {n} sekolah dalam pertandingan" in
 * its own white card, the header row, the stored rows in stored rank order and the footer tip. A week
 * without a snapshot shows the hero and the plain centred "📊 Data minggu ini belum dijana." (no week
 * line). `?week=` has no UI control (as live); an invalid value is ignored by #50 (DV-M16-30). User
 * shell for every role (DV-M16-02), the school admin included. Visuals follow
 * `sekolah-bersaing-desktop.png` and `sekolah-bersaing-week-empty.png`.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatDateEn } from '@/lib/time'

import { fetchSekolahBersaing } from '../api'
import PageLoadError from '../components/competition/PageLoadError.vue'
import { SB_COPY as COPY } from '../components/sekolah-bersaing/copy'
import { SB_GRID } from '../components/sekolah-bersaing/grid'
import SchoolRow from '../components/sekolah-bersaing/SchoolRow.vue'

const route = useRoute()

/** The raw `?week=` text (a repeated key uses its first value); `undefined` when absent. */
const week = computed(() => {
  const q = route.query.week
  const v = Array.isArray(q) ? q[0] : q
  return typeof v === 'string' && v !== '' ? v : undefined
})

const view = useApi((signal) => fetchSekolahBersaing(week.value, { signal }), week)
const data = computed(() => view.data.value)
const weekLabel = computed(() => (data.value ? formatDateEn(data.value.weekStart) : ''))
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="m16-sekolah-bersaing-page">
    <section
      class="rounded-3xl bg-linear-to-br from-yellow-400 to-amber-500 px-4 py-8 text-center shadow-lg sm:px-6 sm:py-10"
      data-testid="sb-hero"
    >
      <!-- DV-M16-40 (D9): live paints this text white on yellow-400 to amber-500 (about 1.5 to
           2.2:1, unreadable); the rebuild keeps the gradient and uses dark amber-brown text. -->
      <h1 class="font-heading text-2xl font-bold text-amber-900 sm:text-3xl">{{ COPY.heading }}</h1>
      <p class="mt-2 text-sm font-semibold text-amber-900 sm:text-base">{{ COPY.sub }}</p>
    </section>

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!data"
      class="flex justify-center py-10 text-slate-400"
      data-testid="sb-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <div v-else-if="data.rows.length === 0" class="py-12 text-center" data-testid="sb-empty">
      <p class="font-bold text-slate-700">{{ COPY.emptyTitle }}</p>
      <p class="mt-2 text-sm text-slate-500">{{ COPY.emptyHint }}</p>
    </div>

    <div v-else class="space-y-4 px-4 lg:px-9">
      <p class="rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm" data-testid="sb-week">
        {{ COPY.weekPrefix }}
        <strong class="text-amber-800" data-testid="sb-week-date">{{ weekLabel }}</strong> ·
        <strong class="text-amber-800" data-testid="sb-count">{{ data.count }}</strong>
        {{ COPY.weekSuffix }}
      </p>

      <section
        class="lb-table overflow-hidden rounded-2xl bg-white shadow-sm"
        data-testid="sb-table"
      >
        <div
          class="grid items-center gap-2 bg-amber-100 px-3 py-3 text-xs font-bold tracking-wide text-amber-900 uppercase sm:px-4"
          :class="SB_GRID"
          data-testid="sb-header"
        >
          <div>{{ COPY.headers[0] }}</div>
          <div>{{ COPY.headers[1] }}</div>
          <div class="text-right text-slate-700">{{ COPY.headers[2] }}</div>
          <div class="hidden text-right text-slate-700 md:block">{{ COPY.headers[3] }}</div>
          <div class="hidden text-right text-slate-700 md:block">{{ COPY.headers[4] }}</div>
        </div>
        <div class="divide-y divide-slate-100">
          <SchoolRow v-for="row in data.rows" :key="row.rank" :row="row" />
        </div>
      </section>

      <p class="rounded-xl bg-amber-50 p-3 text-sm text-slate-700" data-testid="sb-tip">
        💡 <strong>{{ COPY.tipLabel }}</strong> {{ COPY.tip }}
      </p>
    </div>
  </div>
</template>
