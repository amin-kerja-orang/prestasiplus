<script setup lang="ts">
/**
 * S3 `/spm/latih-tubi` "Latih Tubi SPM" (M06-T2; FR-M06-22…24, BR-M06-03/04/06, DV-M06-03).
 *
 * "Subjek Teras ({n})" and "Subjek Elektif ({n})" cards linking to S4, each with the pool count and a
 * target chip. A subject whose count is below its target is the locked card (live: Bahasa Arab):
 * amber, `href="javascript:void(0)"` and `pointer-events-none`; S4 stays reachable by URL.
 */
import { ArrowLeft, Brain, ChevronRight, Crown, Lock, Puzzle, Target } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchLatihTubiList, type LatihTubiCard } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import SubjectIcon from '../components/SubjectIcon.vue'
import { targetName } from '../lib/latih-tubi'

const { data, error, reload } = useApi((signal) => fetchLatihTubiList({ signal }))

const targetText = (c: LatihTubiCard): string | null =>
  c.targetType !== null && c.targetSize !== null
    ? `Target ${targetName(c.targetType)}: ${String(c.targetSize)}`
    : null
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="spm-latih-tubi-page">
    <div class="mx-auto max-w-7xl">
      <RouterLink
        to="/spm"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Mod SPM
      </RouterLink>

      <div class="mb-5 sm:mb-8">
        <h1
          class="flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-800 sm:text-3xl"
          data-testid="spm-heading"
        >
          <Brain class="h-6 w-6 shrink-0 text-blue-600 sm:h-7 sm:w-7" aria-hidden="true" />
          Latih Tubi SPM
        </h1>
        <p class="mt-1 text-sm text-slate-600 sm:text-base" data-testid="spm-sub">
          Pilih subjek untuk mula berlatih (Tingkatan 4 &amp; 5)
        </p>
      </div>

      <template v-if="data">
        <section
          v-for="g in [
            {
              id: 'teras',
              title: 'Subjek Teras',
              icon: Crown,
              cls: 'text-amber-500',
              cards: data.teras,
            },
            {
              id: 'elektif',
              title: 'Subjek Elektif',
              icon: Puzzle,
              cls: 'text-teal-600',
              cards: data.elektif,
            },
          ]"
          :key="g.id"
          class="mb-6 sm:mb-8"
          :data-testid="`latih-tubi-section-${g.id}`"
        >
          <h2
            class="mb-3 flex items-center gap-2 font-heading text-lg font-extrabold text-slate-800 sm:text-xl"
            data-testid="section-heading"
          >
            <component :is="g.icon" :class="['h-5 w-5', g.cls]" aria-hidden="true" />
            {{ g.title }} ({{ g.cards.length }})
          </h2>
          <div class="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            <component
              :is="c.locked ? 'a' : RouterLink"
              v-for="c in g.cards"
              :key="c.code"
              v-bind="
                c.locked ? { href: 'javascript:void(0)' } : { to: `/spm/latih-tubi/${c.code}` }
              "
              :class="[
                'group flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition',
                c.locked
                  ? 'pointer-events-none border-amber-300 bg-amber-50'
                  : 'border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-lg',
              ]"
              :data-testid="`latih-tubi-card-${c.code}`"
              :data-locked="c.locked ? 'true' : 'false'"
            >
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                :style="{ background: `${c.color}22`, color: c.color }"
                data-testid="latih-tubi-icon"
              >
                <SubjectIcon :icon="c.icon" class="h-6 w-6" />
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  class="font-heading text-base font-extrabold break-words text-slate-800"
                  data-testid="latih-tubi-name"
                >
                  {{ c.name }}
                </h3>
                <p class="text-xs text-slate-500" data-testid="latih-tubi-name-en">
                  {{ c.nameEn }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    class="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700"
                    data-testid="latih-tubi-count"
                  >
                    <Brain class="h-3 w-3" aria-hidden="true" />
                    {{ formatCount(c.total) }} soalan
                  </span>
                  <span
                    v-if="targetText(c)"
                    class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"
                    data-testid="latih-tubi-target"
                  >
                    <Target class="h-3 w-3" aria-hidden="true" />
                    {{ targetText(c) }}
                  </span>
                  <span
                    v-if="c.locked"
                    class="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800"
                    data-testid="latih-tubi-locked"
                  >
                    <Lock class="h-3 w-3" aria-hidden="true" />
                    Locked: {{ c.total }}/{{ c.targetSize }}
                  </span>
                </div>
              </div>
              <Lock v-if="c.locked" class="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <ChevronRight v-else class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            </component>
          </div>
        </section>
      </template>
      <LoadError v-else-if="error" @retry="reload()" />
      <SkeletonCards v-else />
    </div>
  </div>
</template>
