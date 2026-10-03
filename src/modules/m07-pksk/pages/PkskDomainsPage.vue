<script setup lang="ts">
/**
 * S3 `/pksk/level/:level/domains` "Domain PKSK - {L}" (M07-T2; FR-M07-11..13, FN-M07-1.3.*): the three
 * Bahagian sections with one link card per domain (question count, mastery).
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AppIcon } from '@/components/icon'
import { usePageMeta } from '@/composables'

import { fetchPkskDomainSections } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import MasteryBar from '../components/MasteryBar.vue'
import { SECTION_STYLE, tint } from '../lib/levels'
import { isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({
      title: `Domain PKSK - ${level}`,
      subtitle: 'Pilih domain untuk latih tubi',
    })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskDomainSections(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="pksk-domains">
    <BackLink :to="`/pksk/level/${level}`" label="Kembali ke Dashboard" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <section
        v-for="s in data"
        :key="s.bahagian"
        :data-testid="`section-${s.bahagian}`"
        class="min-w-0"
      >
        <div class="mb-4 flex items-center gap-3">
          <span
            :class="[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white',
              SECTION_STYLE[s.bahagian].badge,
            ]"
            data-testid="section-badge"
            >{{ s.bahagian }}</span
          >
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-slate-800 sm:text-xl">{{ s.name }}</h2>
            <p class="text-sm text-slate-500">{{ s.subtitle }}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="d in s.domains"
            :key="d.code"
            :to="`/pksk/level/${level}/domain/${d.code}`"
            :class="[
              'block min-w-0 rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition hover:scale-105 hover:shadow-xl',
              SECTION_STYLE[s.bahagian].hover,
            ]"
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
              <span class="inline-flex items-center gap-1.5 text-slate-600">
                <AppIcon name="fa-question-circle" class="h-4 w-4" /> Soalan
              </span>
              <span class="font-bold text-slate-800" data-testid="question-count">{{
                d.questionCount
              }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between text-sm">
              <span class="text-slate-600">Penguasaan</span>
              <span class="font-bold" :style="{ color: d.color }" data-testid="mastery-pct"
                >{{ d.masteryPct }}%</span
              >
            </div>
            <MasteryBar :pct="d.masteryPct" :color="d.color" />
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
