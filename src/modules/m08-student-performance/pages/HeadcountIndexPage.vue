<script setup lang="ts">
/**
 * `/headcount` (S10-T09): one route, two screens. The pupil gets the read view of the own configs
 * (`HeadcountMuridPage`, API-RPT-08); every other role the list of S12 (`HeadcountListPage`). The switch
 * is here so the pupil page never calls the staff API (and the staff page never the pupil API).
 */
import { computed } from 'vue'

import { useSessionStore } from '@/stores/session'

import HeadcountListPage from './HeadcountListPage.vue'
import HeadcountMuridPage from './HeadcountMuridPage.vue'

const session = useSessionStore()
const isPupil = computed(() => session.role === 'student')
</script>

<template>
  <HeadcountMuridPage v-if="isPupil" />
  <HeadcountListPage v-else />
</template>
