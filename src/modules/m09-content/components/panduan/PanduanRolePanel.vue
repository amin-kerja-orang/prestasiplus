<script setup lang="ts">
/**
 * One role panel of S26/S27 (FR-M09-114, FR-M09-115): the numbered steps ending in the "done"
 * step, the feature grid and the FAQ accordion. Every FAQ item toggles on its own (`open`).
 */
import { reactive } from 'vue'

import { DsIconChip, DsSurface, DsStack, DsGrid, DsHeading, DsText } from '@/ds'

import type { GuideRole, Segment } from '../../lib/panduan-content'

const props = defineProps<{ role: GuideRole }>()

const open = reactive<Record<number, boolean>>({})

function toggle(index: number): void {
  open[index] = !open[index]
}

function isBold(seg: Segment): seg is { b: string } {
  return typeof seg !== 'string'
}
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-6" :data-testid="`panduan-panel-${props.role.id}`">
    <UCard>
      <div class="flex flex-col gap-5">
        <DsHeading :level="2">{{ props.role.stepsTitle }}</DsHeading>
        <DsStack as="ol">
          <li v-for="(step, i) in props.role.steps" :key="step.title" class="flex gap-3">
            <UBadge
              color="primary"
              variant="solid"
              :label="String(i + 1)"
              class="size-9 shrink-0 justify-center rounded-full"
            />
            <div class="min-w-0">
              <DsHeading :level="3">{{ step.title }}</DsHeading>
              <DsText variant="label" as="p" tone="muted">
                <template v-for="(seg, j) in step.text" :key="j"
                  ><strong v-if="isBold(seg)" class="text-default">{{ seg.b }}</strong
                  ><template v-else>{{ seg }}</template></template
                >
              </DsText>
            </div>
          </li>
          <li class="flex gap-3" data-testid="panduan-done-step">
            <DsIconChip icon="i-ph-check-bold" accent="win" size="sm" />
            <div class="min-w-0">
              <DsHeading :level="3">{{ props.role.done.title }}</DsHeading>
              <DsText variant="label" as="p" tone="muted">
                <template v-for="(seg, j) in props.role.done.text" :key="j">{{ seg }}</template>
              </DsText>
            </div>
          </li>
        </DsStack>
      </div>
    </UCard>

    <UCard>
      <div class="flex flex-col gap-5">
        <DsHeading :level="2">{{ props.role.featuresTitle }}</DsHeading>
        <DsGrid :cols="{ base: 1, sm: 2, lg: 3 }" gap="sm" data-testid="panduan-features">
          <div
            v-for="(feature, i) in props.role.features"
            :key="`${feature.title}-${String(i)}`"
            class="flex flex-col gap-1 rounded-card bg-elevated p-4"
            data-testid="panduan-feature"
          >
            <DsIconChip icon="i-ph-star-four-duotone" size="sm" />
            <h3 class="mt-2 text-label text-highlighted">{{ feature.title }}</h3>
            <DsText variant="caption">{{ feature.text }}</DsText>
          </div>
        </DsGrid>
      </div>
    </UCard>

    <UCard>
      <DsStack>
        <DsHeading :level="2">{{ props.role.faqTitle }}</DsHeading>
        <DsStack gap="xs">
          <DsSurface
            v-for="(faq, i) in props.role.faqs"
            :key="faq.q"
            level="elevated"
            radius="card"
            padding="none"
            :clip="false"
            data-testid="panduan-faq"
          >
            <UButton
              color="neutral"
              variant="ghost"
              block
              :trailing-icon="open[i] ? 'i-ph-caret-up' : 'i-ph-caret-down'"
              class="h-auto justify-between py-3 text-start"
              data-testid="panduan-faq-toggle"
              @click="toggle(i)"
              >{{ faq.q }}</UButton
            >
            <p
              v-if="open[i]"
              class="px-4 pb-3 text-label text-muted"
              data-testid="panduan-faq-answer"
            >
              {{ faq.a }}
            </p>
          </DsSurface>
        </DsStack>
      </DsStack>
    </UCard>
  </div>
</template>
