<script setup lang="ts">
/** FN-M10-2.1.1: dismissible "Mula Di Sini" guide and its pill (FR-M10-08). */
import { ref } from 'vue'

import { DsIconChip, DsPanel, DsCluster, DsStack, DsHeading, DsText } from '@/ds'

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
    <DsPanel v-else data-testid="guide-card">
      <DsCluster align="start" justify="between" :wrap="false">
        <DsCluster :wrap="false">
          <DsIconChip icon="rocket-launch" />
          <DsHeading :level="2" variant="subheading" data-testid="guide-title">
            {{ DASH_COPY.guideTitle }}
          </DsHeading>
        </DsCluster>
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
      </DsCluster>
      <p class="mt-1 text-body text-muted">{{ DASH_COPY.guideIntro }}</p>
      <ol class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <li
          v-for="(s, i) in DASH_COPY.guideSteps"
          :key="s.title"
          class="min-w-0"
          data-testid="guide-step"
        >
          <DsPanel tone="inset" class="h-full"
            ><DsStack gap="2xs" align="start">
              <UBadge color="primary" variant="subtle">{{ i + 1 }}</UBadge>
              <DsText variant="label" as="p" tone="highlighted">{{ s.title }}</DsText>
              <DsText variant="body" tone="muted">{{ s.text }}</DsText>
              <UButton :to="s.to" variant="link" class="px-0" data-testid="guide-link">{{
                s.link
              }}</UButton>
            </DsStack></DsPanel
          >
        </li>
      </ol>
      <p class="mt-3 flex items-start gap-2 text-body text-muted">
        <UIcon name="i-ph-lightbulb-duotone" class="mt-1 size-4 shrink-0 text-primary-t" />
        <span
          ><strong>{{ DASH_COPY.tipLabel }}</strong> {{ DASH_COPY.tipText }}</span
        >
      </p>
    </DsPanel>
  </div>
</template>
