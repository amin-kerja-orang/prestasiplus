<script setup lang="ts">
/**
 * S28 `/sekolah-bersaing` (`?week=`; FR-M16-127..131, BR-M16-35; URS FN-M16-10.1.1 ... 10.1.6): the
 * amber hero, the week line "Minggu {dd Mon yyyy} · {n} sekolah dalam pertandingan", the header row,
 * the stored rows in stored rank order and the footer tip. A week without a snapshot shows the hero and
 * "📊 Data minggu ini belum dijana.". `?week=` has no UI control (as live); an invalid value is ignored
 * by #50 (DV-M16-30). User shell for every role (DV-M16-02), the school admin included.
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
  <div class="mx-auto max-w-4xl min-w-0 space-y-4" data-testid="m16-sekolah-bersaing-page">
    <section
      class="rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 p-4 text-white shadow-lg sm:p-6"
      data-testid="sb-hero"
    >
      <h1 class="text-xl font-bold text-white sm:text-2xl">{{ COPY.heading }}</h1>
      <p class="mt-1 text-sm text-white">{{ COPY.sub }}</p>
      <p v-if="data && data.rows.length > 0" class="mt-3 text-sm text-white" data-testid="sb-week">
        {{ COPY.weekPrefix }} <strong data-testid="sb-week-date">{{ weekLabel }}</strong> ·
        <strong data-testid="sb-count">{{ data.count }}</strong> {{ COPY.weekSuffix }}
      </p>
    </section>

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!data"
      class="flex justify-center py-10 text-slate-400"
      data-testid="sb-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <div
      v-else-if="data.rows.length === 0"
      class="rounded-2xl bg-white p-8 text-center shadow-sm"
      data-testid="sb-empty"
    >
      <p class="font-bold text-slate-800">{{ COPY.emptyTitle }}</p>
      <p class="mt-1 text-sm text-slate-600">{{ COPY.emptyHint }}</p>
    </div>

    <template v-else>
      <section
        class="lb-table overflow-hidden rounded-2xl bg-white shadow-sm"
        data-testid="sb-table"
      >
        <div
          class="grid items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600 sm:px-3"
          :class="SB_GRID"
          data-testid="sb-header"
        >
          <div class="text-center">{{ COPY.headers[0] }}</div>
          <div>{{ COPY.headers[1] }}</div>
          <div class="text-center">{{ COPY.headers[2] }}</div>
          <div class="hidden text-center md:block">{{ COPY.headers[3] }}</div>
          <div class="hidden text-center md:block">{{ COPY.headers[4] }}</div>
        </div>
        <div class="divide-y divide-slate-100">
          <SchoolRow v-for="row in data.rows" :key="row.rank" :row="row" />
        </div>
      </section>

      <p class="rounded-xl bg-amber-50 p-3 text-sm text-slate-700" data-testid="sb-tip">
        💡 <strong>{{ COPY.tipLabel }}</strong> {{ COPY.tip }}
      </p>
    </template>
  </div>
</template>
