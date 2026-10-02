<script setup lang="ts">
/**
 * Laravel Tailwind paginator, replicated (F-16; overview §9; M01 FR-M01-57, M02 FR-M02-18,
 * M04 FR-M04-10, M05 §8.1, M09 BR-M09-32, M15 FR-M15-19..21, M19 FR-M19-15, M21 FR-M21-16).
 *
 * English copy, exact. Below 640 px "« Previous" / "Next »" (links, or plain spans at the
 * bounds); from 640 px "Showing {from} to {to} of {total} results" plus the numbered strip.
 * Hidden when there is one page, unless `alwaysShow` (M13 S2 "Showing 0 of 0 results") or the
 * requested page is beyond the last (M15, M19 S5, M21: "Showing 0 of {total} results").
 *
 * Links are real `<a href>` built from `path` + `query` (+ `page` last). A plain left click
 * emits `change(page)` and is prevented, so the page can `router.push` (keeping the SPA);
 * modified clicks fall through to the browser.
 */
import { computed } from 'vue'

import { PAGER_CLASSES as C } from './classes'
import { pageHref, type PagerQueryValue } from './page-href'
import { pagerNumbers, pagerWindow } from './pager-window'

const props = withDefaults(
  defineProps<{
    /** Current page, 1-based (may be beyond the last). */
    page: number
    total: number
    perPage: number
    /** Path the links point at; default keeps the current path (`?page=n`). */
    path?: string
    /** Other query values to keep on every link (empty values are dropped). */
    query?: Record<string, PagerQueryValue>
    /** Render even when there is a single page (M13 S2). */
    alwaysShow?: boolean
    /** Name of the page query parameter (default `page`; M04 S11 uses `mcq_page` / `str_page`). */
    pageParam?: string
  }>(),
  { path: '', query: undefined, alwaysShow: false, pageParam: 'page' },
)

const emit = defineEmits<{ change: [page: number] }>()

/** Live aria-label values are these literal strings (the entity text is not decoded). */
const PREV_LABEL = '&laquo; Previous'
const NEXT_LABEL = 'Next &raquo;'

const current = computed(() => Math.max(1, Math.floor(props.page) || 1))
const nums = computed(() => pagerNumbers(props.total, props.perPage, current.value))
const visible = computed(
  () => props.alwaysShow || nums.value.lastPage > 1 || current.value > nums.value.lastPage,
)
const items = computed(() => pagerWindow(current.value, nums.value.lastPage))
const hasPrev = computed(() => current.value > 1)
const hasNext = computed(() => current.value < nums.value.lastPage)

function href(page: number): string {
  return pageHref(props.path, props.query, page, props.pageParam)
}

function go(event: MouseEvent, page: number) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('change', page)
}
</script>

<template>
  <nav v-if="visible" role="navigation" aria-label="Pagination Navigation" :class="C.nav">
    <div :class="C.mobileRow">
      <a
        v-if="hasPrev"
        :href="href(current - 1)"
        :class="C.mobileLink"
        @click="go($event, current - 1)"
      >
        &laquo; Previous
      </a>
      <span v-else :class="C.mobileDisabled">&laquo; Previous</span>
      <a
        v-if="hasNext"
        :href="href(current + 1)"
        :class="C.mobileLinkNext"
        @click="go($event, current + 1)"
      >
        Next &raquo;
      </a>
      <span v-else :class="C.mobileDisabledNext">Next &raquo;</span>
    </div>

    <div :class="C.desktopRow">
      <div>
        <p v-if="nums.from !== null" :class="C.summary">
          Showing <span :class="C.summaryNumber">{{ nums.from }}</span> to
          <span :class="C.summaryNumber">{{ nums.to }}</span> of
          <span :class="C.summaryNumber">{{ total }}</span> results
        </p>
        <p v-else :class="C.summary">
          Showing <span :class="C.summaryNumber">{{ nums.count }}</span> of
          <span :class="C.summaryNumber">{{ total }}</span> results
        </p>
      </div>

      <div>
        <span :class="C.strip">
          <a
            v-if="hasPrev"
            :href="href(current - 1)"
            rel="prev"
            :class="C.arrowPrev"
            :aria-label="PREV_LABEL"
            @click="go($event, current - 1)"
          >
            <svg :class="C.arrowIcon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
          <span v-else aria-disabled="true" :aria-label="PREV_LABEL">
            <span :class="C.arrowPrevDisabled" aria-hidden="true">
              <svg :class="C.arrowIcon" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </span>

          <template v-for="(item, i) in items" :key="item.kind === 'page' ? item.page : `gap-${i}`">
            <span v-if="item.kind === 'gap'" aria-disabled="true">
              <span :class="C.gap">...</span>
            </span>
            <span v-else-if="item.page === current" aria-current="page">
              <span :class="C.current">{{ item.page }}</span>
            </span>
            <a
              v-else
              :href="href(item.page)"
              :class="C.page"
              :aria-label="`Go to page ${item.page}`"
              @click="go($event, item.page)"
            >
              {{ item.page }}
            </a>
          </template>

          <a
            v-if="hasNext"
            :href="href(current + 1)"
            rel="next"
            :class="C.arrowNext"
            :aria-label="NEXT_LABEL"
            @click="go($event, current + 1)"
          >
            <svg :class="C.arrowIcon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
          <span v-else aria-disabled="true" :aria-label="NEXT_LABEL">
            <span :class="C.arrowNextDisabled" aria-hidden="true">
              <svg :class="C.arrowIcon" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </span>
        </span>
      </div>
    </div>
  </nav>
</template>
