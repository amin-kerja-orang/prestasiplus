<script setup lang="ts">
/**
 * Frame of S4-S7 (FN-M17-5.1.1, 5.2.1, 5.3.1, 5.4.1): the title "PrestasiPlus Command Center" with the back
 * link, the breadcrumb ("Command Center" is a link to the S2 board of the same scope), then the page body.
 * The header is the standard `DsPageHeader` of `DsPage`. In the staff shell (the Guru mount) and the
 * Portal Pentadbiran it is only the page column; on the other `bare` admin routes it sits in the staff
 * frame with the brand bar and the theme switch (`CcBoardFrame`).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsBackLink, DsBreadcrumb, DsPage } from '@/ds'

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
    <DsPage
      data-testid="cc-page"
      title="PrestasiPlus Command Center"
      show-title="auto"
      title-testid="cc-title"
    >
      <template #breadcrumb>
        <DsBreadcrumb :items="crumbs" data-testid="cc-breadcrumb" />
      </template>
      <template #actions>
        <DsBackLink :to="backTo" :label="backLabel" data-testid="cc-back" />
      </template>
      <slot />
    </DsPage>
  </component>
</template>
