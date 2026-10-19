<script setup lang="ts">
/**
 * Brand panel content of S1/S2 (FR-M01-02, FR-M01-15), v2 theme: sits on the gradient A1 surface
 * of `AuthLayout` (from `xl` only). Mascot bubble, the H2, the paragraph (slot) and three accent
 * tiles (lime, orange, violet) with 3D art instead of the flat emoji.
 */
import { DsArt3D, DsStack, DsText } from '@/ds'
import type { Art3DName, DsAccent } from '@/ds'
import { accentSolid } from '@/ds/accent'

import type { WelcomeTile } from './welcome-tiles'

defineProps<{ mascot: string; heading: string; tiles: readonly WelcomeTile[] }>()
defineSlots<{ default?: () => unknown }>()

/** One accent + 3D object per tile position: A2 lime, A3 orange, A4 violet. */
const TILE_LOOK: readonly { accent: DsAccent; art: Art3DName }[] = [
  { accent: 'win', art: 'trophy' },
  { accent: 'heat', art: 'bolt' },
  { accent: 'friend', art: 'books' },
]
</script>

<template>
  <DsStack gap="sm" class="relative">
    <div
      class="flex size-16 items-center justify-center rounded-full bg-primary-on/15 text-display"
      aria-hidden="true"
    >
      <span data-testid="auth-mascot">{{ mascot }}</span>
    </div>
    <h2 class="font-display text-title text-primary-on">{{ heading }}</h2>
    <DsText variant="body" class="max-w-prose"><slot /></DsText>
  </DsStack>
  <DsStack as="ul" gap="sm" class="relative">
    <li
      v-for="(tile, i) in tiles"
      :key="tile.title"
      class="flex items-center gap-3 rounded-card p-3 shadow-lift"
      :class="accentSolid[TILE_LOOK[i % TILE_LOOK.length]?.accent ?? 'action']"
      data-testid="auth-tile"
    >
      <DsArt3D :name="TILE_LOOK[i % TILE_LOOK.length]?.art ?? 'rocket'" size="lg" float />
      <div>
        <div class="font-display text-subheading">{{ tile.title }}</div>
        <DsText variant="label" as="div">{{ tile.text }}</DsText>
      </div>
    </li>
  </DsStack>
</template>
