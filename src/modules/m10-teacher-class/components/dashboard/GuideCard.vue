<script setup lang="ts">
/** FN-M10-2.1.1: dismissible "Mula Di Sini" guide and its pill (FR-M10-08). */
import { ref } from 'vue'

import { DsIconChip } from '@/ds'

import { DASH_COPY } from './copy'
import { readGuideHidden, writeGuideHidden } from './lib'

const hidden = ref(readGuideHidden())

function set(value: boolean): void {
  hidden.value = value
  writeGuideHidden(value)
}
</script>

<template>
  <div data-testid="guide-wrap">
    <UButton
      v-if="hidden"
      type="button"
      color="neutral"
      variant="ghost"
      icon="i-ph-question-duotone"
      data-testid="guide-show"
      @click="set(false)"
      >{{ DASH_COPY.showGuide }}</UButton
    >
    <UCard v-else data-testid="guide-card">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <DsIconChip icon="i-ph-rocket-launch-duotone" />
          <h2 class="text-subheading text-highlighted" data-testid="guide-title">
            {{ DASH_COPY.guideTitle }}
          </h2>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-ph-x"
          aria-label="Tutup"
          class="size-11 shrink-0 justify-center"
          data-testid="guide-close"
          @click="set(true)"
        />
      </div>
      <p class="mt-1 text-body text-muted">{{ DASH_COPY.guideIntro }}</p>
      <ol class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <li
          v-for="(s, i) in DASH_COPY.guideSteps"
          :key="s.title"
          class="min-w-0"
          data-testid="guide-step"
        >
          <UCard variant="subtle" class="h-full"
            ><div class="flex min-w-0 flex-col items-start gap-1">
              <UBadge color="primary" variant="subtle">{{ i + 1 }}</UBadge>
              <p class="text-label text-highlighted">{{ s.title }}</p>
              <p class="text-body text-muted">{{ s.text }}</p>
              <UButton :to="s.to" variant="link" class="px-0" data-testid="guide-link">{{
                s.link
              }}</UButton>
            </div></UCard
          >
        </li>
      </ol>
      <p class="mt-3 flex items-start gap-2 text-body text-muted">
        <UIcon name="i-ph-lightbulb-duotone" class="mt-1 size-4 shrink-0 text-primary" />
        <span
          ><strong>{{ DASH_COPY.tipLabel }}</strong> {{ DASH_COPY.tipText }}</span
        >
      </p>
    </UCard>
  </div>
</template>
