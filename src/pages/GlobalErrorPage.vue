<script setup lang="ts">
/**
 * Shared template of the standalone 404 and 403 pages (v2 shells section 7): no shell, so it
 * sets the personality itself (student = learner with the friend, every other role and a guest =
 * staff with the icon chip) and renders `DsErrorPage` with the two links as actions.
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { DsErrorPage } from '@/ds'
import { useSessionStore } from '@/stores/session'
import { useThemeMode, type Personality } from '@/theme/color-mode'

export interface ErrorPageLink {
  label: string
  to: RouteLocationRaw
}

defineProps<{
  code: 403 | 404
  heading: string
  message: string
  primary: ErrorPageLink
  secondary: ErrorPageLink
}>()

const session = useSessionStore()
const personality = computed<Personality>(() => (session.role === 'student' ? 'learner' : 'staff'))
useThemeMode(personality)
</script>

<template>
  <main class="min-h-screen bg-default">
    <DsErrorPage :code="code" :title="heading" :description="message">
      <template #actions>
        <UButton :to="primary.to" size="lg" :label="primary.label" />
        <UButton :to="secondary.to" size="lg" color="neutral" variant="soft" :label="secondary.label" />
      </template>
    </DsErrorPage>
    <p class="pb-8 text-center text-overline text-muted">PRESTASIPLUS</p>
  </main>
</template>
