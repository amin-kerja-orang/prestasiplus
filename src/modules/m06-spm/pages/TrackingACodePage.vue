<script setup lang="ts">
/**
 * `/spm/ramalan/:code` (M06-T3; SRS M06 §2): without `year` and `set` the set list S6, with both the set
 * quiz Q3. One path, as live (`/spm/ramalan/{CODE}?year=2026&set=n` starts the set).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { parseSetQuery } from '../lib/tracking'
import TrackingASetQuizPage from './TrackingASetQuizPage.vue'
import TrackingASubjectPage from './TrackingASubjectPage.vue'

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
const set = computed(() => parseSetQuery(route.query))
</script>

<template>
  <TrackingASetQuizPage v-if="set" :code="code" :year="set.year" :set-no="set.setNo" />
  <TrackingASubjectPage v-else />
</template>
