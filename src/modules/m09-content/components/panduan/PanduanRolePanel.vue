<script setup lang="ts">
/**
 * One role panel of S26/S27 (FR-M09-114, FR-M09-115): the numbered steps ending in the "done"
 * step, the feature grid and the FAQ accordion. Every FAQ item toggles on its own (`open`).
 */
import { reactive } from 'vue'

import { DsIconChip } from '@/ds'

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
        <h2 class="text-heading text-highlighted">{{ props.role.stepsTitle }}</h2>
        <ol class="flex flex-col gap-4">
          <li v-for="(step, i) in props.role.steps" :key="step.title" class="flex gap-3">
            <UBadge
              color="primary"
              variant="solid"
              :label="String(i + 1)"
              class="size-9 shrink-0 justify-center rounded-full"
            />
            <div class="min-w-0">
              <h3 class="text-subheading text-highlighted">{{ step.title }}</h3>
              <p class="text-label text-muted">
                <template v-for="(seg, j) in step.text" :key="j"
                  ><strong v-if="isBold(seg)" class="text-default">{{ seg.b }}</strong
                  ><template v-else>{{ seg }}</template></template
                >
              </p>
            </div>
          </li>
          <li class="flex gap-3" data-testid="panduan-done-step">
            <DsIconChip icon="i-ph-check-bold" accent="win" size="sm" />
            <div class="min-w-0">
              <h3 class="text-subheading text-highlighted">{{ props.role.done.title }}</h3>
              <p class="text-label text-muted">
                <template v-for="(seg, j) in props.role.done.text" :key="j">{{ seg }}</template>
              </p>
            </div>
          </li>
        </ol>
      </div>
    </UCard>

    <UCard>
      <div class="flex flex-col gap-5">
        <h2 class="text-heading text-highlighted">{{ props.role.featuresTitle }}</h2>
        <div
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="panduan-features"
        >
          <div
            v-for="(feature, i) in props.role.features"
            :key="`${feature.title}-${String(i)}`"
            class="flex flex-col gap-1 rounded-card bg-elevated p-4"
            data-testid="panduan-feature"
          >
            <DsIconChip icon="i-ph-star-four-duotone" size="sm" />
            <h3 class="mt-2 text-label text-highlighted">{{ feature.title }}</h3>
            <p class="text-caption text-muted">{{ feature.text }}</p>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <div class="flex flex-col gap-4">
        <h2 class="text-heading text-highlighted">{{ props.role.faqTitle }}</h2>
        <div class="flex flex-col gap-2">
          <div
            v-for="(faq, i) in props.role.faqs"
            :key="faq.q"
            class="rounded-card bg-elevated"
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
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
