<script setup lang="ts">
/**
 * S12 `/headcount` "Headcount" (M08-T6; FR-M08-75…81, FR-M08-122, BR-M08-21). The viewer's own configs
 * newest first (the admin and the school admin own none: the empty state, OD-R3); the Auto-Setup modal
 * creates configs for the ticked levels. The card layout is PROPOSED (UNVERIFIED L-4, OQ-M08-03).
 */
import { ChartLine, ClipboardList, Gauge, Plus, Users, WandSparkles } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { fetchHeadcounts } from '../api/headcount'
import AutoSetupModal from '../components/headcount/AutoSetupModal.vue'
import HeadcountHero from '../components/headcount/HeadcountHero.vue'
import LoadError from '../components/headcount/LoadError.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchHeadcounts({ signal }))
const showAutoSetup = ref(false)

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold text-white transition sm:text-sm'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-list-page">
    <HeadcountHero
      title="Headcount"
      subtitle="Tracking prestasi murid — TOV, OTR, AR & RS"
      :icon="ChartLine"
    >
      <RouterLink
        to="/headcount/dashboard"
        :class="[BTN, 'bg-white/20 hover:bg-white/30']"
        data-testid="hero-dashboard"
      >
        <Gauge class="h-4 w-4" />Dashboard
      </RouterLink>
      <RouterLink
        to="/headcount/create"
        :class="[BTN, 'bg-white/20 hover:bg-white/30']"
        data-testid="hero-create"
      >
        <Plus class="h-4 w-4" />Buat Baru
      </RouterLink>
      <button
        type="button"
        :class="[BTN, 'bg-emerald-500/80 hover:bg-emerald-500']"
        data-testid="hero-auto-setup"
        @click="showAutoSetup = true"
      >
        <WandSparkles class="h-4 w-4" />Auto-Setup
      </button>
    </HeadcountHero>

    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <section
        v-if="data.length === 0"
        class="rounded-2xl bg-white p-8 text-center shadow"
        data-testid="headcount-empty"
      >
        <ClipboardList class="mx-auto h-14 w-14 text-slate-300" />
        <h3 class="mt-3 text-lg font-bold text-slate-700">Belum ada headcount.</h3>
        <RouterLink
          to="/headcount/create"
          class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          data-testid="headcount-create-now"
        >
          <Plus class="h-4 w-4" />Buat Sekarang
        </RouterLink>
      </section>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="headcount-list"
      >
        <RouterLink
          v-for="c in data"
          :key="c.id"
          :to="`/headcount/${c.id}`"
          class="block min-w-0 rounded-2xl bg-white p-5 shadow transition hover:-translate-y-0.5 hover:shadow-md"
          :data-testid="`headcount-card-${c.id}`"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="min-w-0 text-base font-bold break-words text-slate-800">
              {{ c.className }}
            </h3>
            <span
              :class="[
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                c.mode === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700',
              ]"
              >{{ c.mode === 'auto' ? 'Auto' : 'Manual' }}</span
            >
          </div>
          <p class="mt-1 text-sm font-semibold break-words text-indigo-600">{{ c.subjectName }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ c.levelName }} · {{ c.year }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{{ c.activeOtrs }} OTR</span>
            <span class="inline-flex items-center gap-1"
              ><Users class="h-3.5 w-3.5" />{{ c.students }} murid</span
            >
          </div>
        </RouterLink>
      </div>
    </template>

    <AutoSetupModal v-model:open="showAutoSetup" @done="reload()" />
  </div>
</template>
