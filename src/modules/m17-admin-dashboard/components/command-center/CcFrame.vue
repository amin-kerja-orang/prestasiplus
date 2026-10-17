<script setup lang="ts">
/**
 * Frame of S4-S7 (FN-M17-5.1.1, 5.2.1, 5.3.1, 5.4.1): the title "PrestasiPlus Command Center" with the back
 * link, the breadcrumb ("Command Center" is a link to the S2 board of the same scope), then the page body.
 * In the staff shell (the Guru mount) it is only the page column; on the `bare` admin routes it sits in
 * the staff frame with the brand bar and the theme switch.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsIcon, DsPage } from '@/ds'

import CcBoardFrame from '../frame/CcBoardFrame.vue'

export interface CcCrumb {
  label: string
  /** No `to` = the current page (or a level the viewer cannot open). */
  to?: string | undefined
}

defineProps<{ backTo: string; backLabel: string; crumbs: CcCrumb[] }>()

const route = useRoute()
const bare = computed(() => route.meta.layout === 'bare')
</script>

<template>
  <component :is="bare ? CcBoardFrame : 'div'" class="min-w-0">
    <DsPage data-testid="cc-page">
      <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 class="min-w-0 text-title text-highlighted" data-testid="cc-title">
          PrestasiPlus Command Center
        </h1>
        <UButton
          :to="backTo"
          class="ms-auto"
          color="neutral"
          variant="soft"
          :label="backLabel"
          data-testid="cc-back"
        />
      </header>

      <nav
        class="flex flex-wrap items-center gap-x-1 gap-y-1 text-body"
        aria-label="Breadcrumb"
        data-testid="cc-breadcrumb"
      >
        <template v-for="(crumb, i) in crumbs" :key="i">
          <DsIcon v-if="i > 0" name="arrow-right" class="size-4 text-muted" aria-hidden="true" />
          <UButton
            v-if="crumb.to"
            :to="crumb.to"
            variant="link"
            color="primary"
            :label="crumb.label"
            data-testid="cc-crumb"
          />
          <span v-else class="text-label text-highlighted" data-testid="cc-crumb-current">{{
            crumb.label
          }}</span>
        </template>
      </nav>
      <slot />
    </DsPage>
  </component>
</template>
