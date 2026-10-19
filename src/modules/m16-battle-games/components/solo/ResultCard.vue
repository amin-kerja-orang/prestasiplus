<script setup lang="ts">
/**
 * The result of S13-S16 (URS FN-M16-6.2.4, 6.3.4, 6.4.4, 6.5.5) as a modal over a scrim: the 3D art
 * and the title emoji, the title (white-on-surface contrast, DV-M16-45), the subtitle, the stat tiles,
 * "🏆 REKOD BARU!" when the server says `is_new_record`, then the replay button and "🎮 Hub". The
 * syiling tile is built by the page from the credited amount (DV-M16-23).
 */
import { computed } from 'vue'

import { DsArt3D, DsSticker, DsGrid, DsText } from '@/ds'
import type { Art3DName } from '@/ds'

import CoinFly from './CoinFly.vue'

const props = withDefaults(
  defineProps<{
    /** "✅ HEBAT!": the emoji is shown big, the rest is the heading. */
    title: string
    subtitle: string
    /** `tone` is a token text class: text-primary, text-success, text-warning or text-info. */
    tiles: { label: string; value: string; tone: string; wide?: boolean }[]
    newRecord: boolean
    againLabel: string
    coinsCredited: number
    theme: 'indigo' | 'cyan' | 'ember' | 'teal'
    /** Label of the hub link (S17 uses "🏠 Hub"). */
    hubLabel?: string
    /** Test id of the scrim (S17 uses `solo-overlay`). */
    overlayTestid?: string
  }>(),
  { hubLabel: '🎮 Hub', overlayTestid: 'solo-result-overlay' },
)

defineEmits<{ again: [] }>()

const ART: Record<typeof props.theme, Art3DName> = {
  indigo: 'trophy',
  cyan: 'bolt',
  ember: 'fire',
  teal: 'party',
}

const parts = computed(() => {
  const i = props.title.indexOf(' ')
  return i < 0
    ? { emoji: '', text: props.title }
    : { emoji: props.title.slice(0, i), text: props.title.slice(i + 1) }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-200 flex items-center justify-center overflow-y-auto bg-inverted/60 p-4"
      :data-testid="overlayTestid"
    >
      <section
        class="relative flex w-full max-w-md flex-col items-center gap-4 rounded-3xl bg-default p-6 text-center shadow-modal motion-safe:animate-ds-rise"
        role="dialog"
        aria-modal="true"
        :aria-label="parts.text"
        data-testid="solo-result"
      >
        <CoinFly :coins="coinsCredited" />
        <DsArt3D :name="ART[theme]" size="hero" float />
        <div class="text-title" aria-hidden="true" data-testid="solo-result-emoji">
          {{ parts.emoji }}
        </div>
        <h2
          class="font-display text-title font-extrabold text-highlighted"
          data-testid="solo-result-title"
        >
          {{ parts.text }}
        </h2>
        <DsText variant="body" tone="muted">{{ subtitle }}</DsText>
        <DsGrid :cols="2" gap="sm" class="w-full">
          <div
            v-for="tile in tiles"
            :key="tile.label"
            class="min-w-0 rounded-card bg-elevated p-3"
            :class="tile.wide ? 'col-span-2' : ''"
            data-testid="solo-result-tile"
          >
            <div
              class="tabular font-display text-heading font-extrabold break-words"
              :class="tile.tone"
            >
              {{ tile.value }}
            </div>
            <div class="text-caption font-semibold text-muted">{{ tile.label }}</div>
          </div>
        </DsGrid>
        <DsSticker v-if="newRecord" art="trophy" data-testid="solo-new-record">
          🏆 REKOD BARU!
        </DsSticker>
        <DsGrid :cols="2" gap="sm" class="w-full">
          <UButton
            type="button"
            size="xl"
            color="primary"
            variant="solid"
            class="min-h-12 justify-center"
            data-testid="solo-again"
            @click="$emit('again')"
          >
            {{ againLabel }}
          </UButton>
          <UButton
            to="/permainan"
            size="xl"
            color="neutral"
            variant="soft"
            class="min-h-12 justify-center"
          >
            {{ hubLabel }}
          </UButton>
        </DsGrid>
      </section>
    </div>
  </Teleport>
</template>
