<script setup lang="ts">
/**
 * S7 `/analitik/pelajar` "Analitik Pembelajaran" (M08-T2; FR-M08-45…53), the viewer's own analytics from
 * `GET /api/analytics/me`: "Topik Perlu Perhatian Utama (n)" (the 4 weakest SPs of every subject, not
 * filtered by the tab), the "Lihat semua" toggle of the active subject, one tab per practised subject and
 * the pane of the active one. A viewer without an SP record sees only the block with 0 cards (PROPOSED,
 * OQ-M08-08). `showAllWeakTopics` is kept when the tab changes (FR-M08-46).
 */
import { computed, ref } from 'vue'

import { DsIconChip, DsLoadError, DsPage, DsPageHeader, DsPanel } from '@/ds'

import { fetchAnalytics } from '../api/performance'
import SubjectPane from '../components/analitik/SubjectPane.vue'
import WeakTopicCard from '../components/analitik/WeakTopicCard.vue'
import { usePhIcon } from '../lib/icons'
import { TOP_WEAK_LIMIT } from '../lib/analitik'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchAnalytics({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const icon = usePhIcon()

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
  <DsPage data-testid="analitik-page">
    <DsPageHeader
      title="Analitik Pembelajaran"
      subtitle="Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan"
    />
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <section class="flex min-w-0 flex-col gap-3" data-testid="top-weak">
        <h2 class="flex items-center gap-3 text-heading text-highlighted">
          <DsIconChip :icon="icon('warning')" accent="heat" />
          Topik Perlu Perhatian Utama ({{ data.topWeak.length }})
        </h2>
        <div v-if="data.topWeak.length > 0" class="grid grid-cols-1 gap-3 md:grid-cols-2">
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

      <DsPanel v-if="hasExtra" data-testid="more-weak">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-body text-default">
            Masih ada topik lemah lain untuk subjek ini.
            <strong data-testid="more-count">{{ extra }}</strong>
          </p>
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            size="lg"
            :trailing-icon="showAll ? icon('caret-up') : icon('caret-down')"
            :label="
              showAll
                ? 'Sembunyi senarai penuh'
                : `Lihat semua ${String(active?.weak.length ?? 0)} topik lemah`
            "
            data-testid="toggle-weak"
            @click="showAll = !showAll"
          />
        </div>
      </DsPanel>

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
        <div class="flex max-w-full gap-2 overflow-x-auto pb-1" data-testid="subject-tabs">
          <UButton
            v-for="s in data.subjects"
            :key="s.subjectId"
            type="button"
            size="lg"
            class="shrink-0 whitespace-nowrap"
            :color="s.subjectId === active.subjectId ? 'primary' : 'neutral'"
            :variant="s.subjectId === active.subjectId ? 'solid' : 'soft'"
            :aria-pressed="s.subjectId === active.subjectId"
            :data-testid="`tab-${s.subjectId}`"
            @click="activeId = s.subjectId"
          >
            {{ s.name }}
            <span class="text-caption">{{ Math.round(s.accuracy) }}%</span>
          </UButton>
        </div>
        <SubjectPane :key="active.subjectId" :subject="active" />
      </template>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
