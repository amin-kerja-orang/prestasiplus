<script setup lang="ts">
/**
 * S2 `/pksk/level/:level` "Dashboard PKSK - {L}" (M07-T2; FR-M07-06..10, FN-M07-1.2.*): readiness
 * hero, the three shortcut cards and "Penguasaan Domain" (Bahagian B domains only). The level gate
 * (403 -> `/pksk`) is in `usePkskData`.
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { usePageMeta } from '@/composables'
import { AppIcon } from '@/components/icon'

import { fetchPkskDashboard } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import MasteryBar from '../components/MasteryBar.vue'
import { tint } from '../lib/levels'
import { isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({
      title: `Dashboard PKSK - ${level}`,
      subtitle: 'Pantau kemajuan latihan anda',
    })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData((signal) => fetchPkskDashboard(props.level, { signal }), [
  () => props.level,
])
const loadFailed = computed(() => isLoadError(error.value))

const shortcuts = computed(() => [
  {
    key: 'domains',
    icon: 'fa-brain',
    tone: 'bg-blue-100 text-blue-600',
    title: 'Latih Tubi Domains',
    text: 'Fokus pada topik tertentu',
    to: `/pksk/level/${props.level}/domains`,
  },
  {
    key: 'exam',
    icon: 'fa-file-alt',
    tone: 'bg-purple-100 text-purple-600',
    title: 'Peperiksaan Penuh',
    text: 'Simulasi peperiksaan sebenar',
    to: `/pksk/level/${props.level}/exam`,
  },
  {
    key: 'history',
    icon: 'fa-history',
    tone: 'bg-pink-100 text-pink-600',
    title: 'Sejarah',
    text: 'Lihat prestasi lepas',
    to: `/pksk/level/${props.level}/history`,
  },
])
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="pksk-dashboard">
    <BackLink to="/pksk" label="Kembali ke PKSK" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <div
        class="grid grid-cols-1 gap-6 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-xl sm:p-8 md:grid-cols-2 md:items-center"
        data-testid="readiness"
      >
        <div class="min-w-0 text-center md:text-left">
          <p class="text-sm font-medium text-white/90">Skor Kesediaan Anda</p>
          <p class="text-7xl leading-none font-bold text-white" data-testid="score">
            {{ data.readiness.scorePct }}%
          </p>
          <span
            class="mt-3 inline-flex rounded-full bg-white/25 px-4 py-1 text-lg font-bold text-white"
            data-testid="grade"
            >{{ data.readiness.grade }}</span
          >
          <p class="mt-2 text-sm text-white/90">Teruskan usaha anda!</p>
        </div>
        <div class="grid min-w-0 grid-cols-1 gap-3">
          <div class="rounded-2xl bg-white/20 p-4 text-center">
            <p class="text-sm text-white/90">Jumlah Peperiksaan</p>
            <p class="text-3xl font-bold text-white" data-testid="exam-count">
              {{ data.examCount }}
            </p>
          </div>
          <div class="rounded-2xl bg-white/20 p-4 text-center">
            <p class="text-sm text-white/90">Purata Bahagian B</p>
            <p class="text-3xl font-bold text-white" data-testid="avg-b">
              {{ data.bahagianBAvgPct.toFixed(1) }}%
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RouterLink
          v-for="s in shortcuts"
          :key="s.key"
          :to="s.to"
          class="flex min-h-11 min-w-0 items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition hover:scale-105 hover:shadow-md"
          :data-testid="`shortcut-${s.key}`"
        >
          <span
            :class="['flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', s.tone]"
          >
            <AppIcon :name="s.icon" class="h-6 w-6" />
          </span>
          <span class="min-w-0">
            <span class="block font-bold text-slate-800">{{ s.title }}</span>
            <span class="block text-sm text-slate-500">{{ s.text }}</span>
          </span>
        </RouterLink>
      </div>

      <section data-testid="mastery-section">
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
          <AppIcon name="fa-chart-line" class="h-5 w-5 text-indigo-600" /> Penguasaan Domain
        </h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="d in data.domains"
            :key="d.code"
            class="flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm"
            data-testid="domain-card"
            :data-code="d.code"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                :style="{ backgroundColor: tint(d.color), color: d.color }"
                data-testid="domain-icon"
              >
                <AppIcon :name="d.icon" class="h-6 w-6" />
              </span>
              <div class="min-w-0">
                <h3 class="font-bold break-words text-slate-800">{{ d.name }}</h3>
                <p class="text-xs text-slate-500">{{ d.code }}</p>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm">
              <span class="text-slate-600">Penguasaan</span>
              <span class="font-bold" :style="{ color: d.color }" data-testid="mastery-pct"
                >{{ d.masteryPct }}%</span
              >
            </div>
            <MasteryBar :pct="d.masteryPct" :color="d.color" />
            <RouterLink
              :to="`/pksk/level/${level}/domain/${d.code}`"
              class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-80"
              :style="{ backgroundColor: tint(d.color), color: d.color }"
              data-testid="practice-link"
            >
              <AppIcon name="fa-play" class="h-4 w-4" /> Latih Sekarang
            </RouterLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
