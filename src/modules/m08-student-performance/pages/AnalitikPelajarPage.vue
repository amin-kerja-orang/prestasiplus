<script setup lang="ts">
/**
 * S7 `/analitik/pelajar` "Analitik Pembelajaran" (M08-T2; FR-M08-45…53), the viewer's own analytics from
 * `GET /api/analytics/me`: "Topik Perlu Perhatian Utama (n)" (the 4 weakest SPs of every subject, not
 * filtered by the tab), the "Lihat semua" toggle of the active subject, one tab per practised subject and
 * the pane of the active one. A viewer without an SP record sees only the block with 0 cards (PROPOSED,
 * OQ-M08-08). `showAllWeakTopics` is kept when the tab changes (FR-M08-46).
 */
import { ChevronDown, ChevronUp, TriangleAlert } from '@lucide/vue'
import { computed, ref } from 'vue'

import { AlertBox } from '@/components/feedback'

import { fetchAnalytics } from '../api/performance'
import SubjectPane from '../components/analitik/SubjectPane.vue'
import WeakTopicCard from '../components/analitik/WeakTopicCard.vue'
import { TOP_WEAK_LIMIT } from '../lib/analitik'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchAnalytics({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

/** The first subject is active on load. */
const activeId = ref<number | null>(null)
const showAll = ref(false)

const active = computed(() => {
  const subjects = data.value?.subjects ?? []
  return subjects.find((s) => s.subjectId === activeId.value) ?? subjects[0] ?? null
})
const trendOfCode = (code: string) =>
  data.value?.subjects.find((s) => s.code === code)?.trend ?? 'stable'

const extra = computed(() => Math.max((active.value?.weak.length ?? 0) - TOP_WEAK_LIMIT, 0))
const hasExtra = computed(() => (active.value?.weak.length ?? 0) > TOP_WEAK_LIMIT)

/** x-collapse equivalent: animate the height of the expanded list. */
function collapseEnter(el: Element, done: () => void): void {
  const node = el as HTMLElement
  node.style.overflow = 'hidden'
  node.style.height = '0px'
  void node.offsetHeight
  node.style.transition = 'height 250ms ease'
  node.style.height = `${String(node.scrollHeight)}px`
  window.setTimeout(() => {
    node.style.height = ''
    node.style.overflow = ''
    node.style.transition = ''
    done()
  }, 260)
}
function collapseLeave(el: Element, done: () => void): void {
  const node = el as HTMLElement
  node.style.overflow = 'hidden'
  node.style.height = `${String(node.scrollHeight)}px`
  void node.offsetHeight
  node.style.transition = 'height 250ms ease'
  node.style.height = '0px'
  window.setTimeout(done, 260)
}
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="analitik-page">
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
      <section class="min-w-0 space-y-3" data-testid="top-weak">
        <h2 class="flex items-center gap-3 text-base font-bold text-slate-800">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"
            ><TriangleAlert class="h-5 w-5"
          /></span>
          Topik Perlu Perhatian Utama ({{ data.topWeak.length }})
        </h2>
        <div v-if="data.topWeak.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WeakTopicCard
            v-for="sp in data.topWeak"
            :key="sp.spId"
            :sp="sp"
            :max="70"
            :level-id="data.userLevelId"
            :trend="trendOfCode(sp.subjectCode)"
          />
        </div>
      </section>

      <div
        v-if="hasExtra"
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow"
        data-testid="more-weak"
      >
        <p class="text-sm text-slate-600">
          Masih ada topik lemah lain untuk subjek ini.
          <strong data-testid="more-count">{{ extra }}</strong>
        </p>
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          data-testid="toggle-weak"
          @click="showAll = !showAll"
        >
          {{
            showAll
              ? 'Sembunyi senarai penuh'
              : `Lihat semua ${String(active?.weak.length ?? 0)} topik lemah`
          }}
          <ChevronUp v-if="showAll" class="h-4 w-4" />
          <ChevronDown v-else class="h-4 w-4" />
        </button>
      </div>

      <Transition :css="false" @enter="collapseEnter" @leave="collapseLeave">
        <div
          v-if="hasExtra && showAll && active"
          class="grid grid-cols-1 gap-3 md:grid-cols-2"
          data-testid="all-weak"
        >
          <WeakTopicCard
            v-for="sp in active.weak"
            :key="sp.spId"
            :sp="sp"
            :max="100"
            :level-id="data.userLevelId"
          />
        </div>
      </Transition>

      <template v-if="active">
        <div class="flex gap-2 overflow-x-auto pb-1" data-testid="subject-tabs">
          <button
            v-for="s in data.subjects"
            :key="s.subjectId"
            type="button"
            :class="[
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
              s.subjectId === active.subjectId
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50',
            ]"
            :data-testid="`tab-${s.subjectId}`"
            @click="activeId = s.subjectId"
          >
            {{ s.name }}
            <span class="text-xs opacity-75">{{ Math.round(s.accuracy) }}%</span>
          </button>
        </div>
        <SubjectPane :key="active.subjectId" :subject="active" />
      </template>
    </template>
  </div>
</template>
