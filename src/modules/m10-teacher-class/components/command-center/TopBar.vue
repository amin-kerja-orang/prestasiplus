<script setup lang="ts">
/**
 * Header of S2 (FR-M10-14, FN-M10-2.2.1): "← Dashboard", h1 "Command Center", the LANGSUNG badge, the MYT
 * clock, the pause and full-screen controls and the six links. The links scroll inside their own row.
 */
import { computed } from 'vue'

import { isHttpMode } from '@/api'
import { scopeHomePath } from '@/app/prototype-scope'
import { DsBackLink, DsLiveBadge, DsPageHeader } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { useClock } from './composables'
import { NAV_LINKS, type NavAction, REKOD_PATH, S2_COPY } from './copy'

defineProps<{ paused: boolean; fullscreen: boolean }>()
defineEmits<{ open: [action: NavAction]; pause: []; fullscreen: [] }>()

const clock = useClock()
const session = useSessionStore()

/**
 * "← Dashboard": the teacher's `/guru`. `/guru` is teacher-only in http mode (DV-M10-37), so the admin goes
 * to the admin home instead; in mock mode `/guru` admits the admin and stays the target.
 */
const backTo = computed(() =>
  isHttpMode() && session.role === 'admin' ? scopeHomePath('admin') : '/guru',
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3" data-testid="cc-topbar">
    <DsPageHeader :title="S2_COPY.title" :show-title="true" title-testid="cc-title">
      <template #breadcrumb>
        <DsBackLink
          :to="backTo"
          label="Dashboard"
          :aria-label="S2_COPY.back"
          data-testid="cc-back"
        />
      </template>
      <template #actions>
      <div class="flex flex-wrap items-center gap-2" data-testid="cc-live">
        <DsLiveBadge v-if="!paused" :label="S2_COPY.live" data-testid="cc-live-badge" />
        <UBadge v-else color="neutral" variant="soft" size="md" data-testid="cc-live-badge"
          >DIJEDA</UBadge
        >
        <span class="tabular text-label text-highlighted" data-testid="cc-clock">{{ clock }}</span>
        <span class="text-caption text-muted">{{ S2_COPY.tz }}</span>
        <UButton
          color="neutral"
          variant="soft"
          :icon="paused ? 'i-ph-play' : 'i-ph-pause'"
          :label="paused ? 'Sambung' : 'Jeda'"
          data-testid="cc-pause"
          @click="$emit('pause')"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-ph-corners-out"
          label="Skrin Penuh"
          :aria-pressed="fullscreen"
          data-testid="cc-fullscreen"
          @click="$emit('fullscreen')"
        />
      </div>
      </template>
    </DsPageHeader>
    <nav class="flex w-full items-center gap-2 overflow-x-auto" data-testid="cc-links">
      <template v-for="l in NAV_LINKS" :key="l.id">
        <UButton
          v-if="l.id === 'rekod'"
          :to="REKOD_PATH"
          color="primary"
          variant="soft"
          :icon="l.icon"
          :label="l.label"
          class="shrink-0"
          data-testid="cc-link-rekod"
        />
        <UButton
          v-else
          color="primary"
          variant="soft"
          :icon="l.icon"
          :label="l.label"
          class="shrink-0"
          :data-testid="`cc-link-${l.id}`"
          @click="$emit('open', l.id)"
        />
      </template>
    </nav>
  </div>
</template>
