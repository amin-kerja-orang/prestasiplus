<script setup lang="ts">
/**
 * L45 S2 valid-token page (FR-L45-22..27; PROPOSED layout from the reference acceptance page, no
 * images, D22). Shared frame: back link, a raised card with a brand-gradient header (initials tile,
 * eyebrow, H1, school line), the body slot and the caption below. The body per state (guest,
 * non-parent, accepting, linked, error) is supplied by the page.
 */
import { useThemeMode } from '@/theme/color-mode'

defineProps<{
  initials: string
  eyebrow: string
  heading: string
  studentName: string
  schoolName: string | null
}>()

defineSlots<{ default: () => unknown }>()

useThemeMode('learner')
</script>

<template>
  <main
    class="flex min-h-dvh flex-col items-center justify-center bg-muted px-3 py-6 sm:px-4"
    data-testid="invite-valid"
  >
    <div class="flex w-full max-w-lg flex-col gap-2">
      <UButton
        to="/"
        variant="link"
        color="neutral"
        icon="i-ph-arrow-left"
        class="min-h-11 self-start"
        data-testid="invite-back"
        >PRESTASIPLUS</UButton
      >

      <div class="overflow-hidden rounded-sheet bg-default shadow-lift">
        <div class="bg-gradient-primary px-5 py-6 text-primary-on sm:px-6">
          <div class="flex items-center gap-4">
            <span
              class="flex size-16 shrink-0 items-center justify-center rounded-chip bg-primary-on/15 font-display text-heading"
              data-testid="invite-initials"
              >{{ initials }}</span
            >
            <div class="min-w-0">
              <p class="text-label" data-testid="invite-eyebrow">{{ eyebrow }}</p>
              <h1
                class="font-display text-heading leading-snug break-words"
                data-testid="invite-heading"
              >
                {{ heading }}
              </h1>
            </div>
          </div>
          <p
            v-if="schoolName"
            class="mt-3 flex items-center gap-2 text-label"
            data-testid="invite-school"
          >
            <UIcon name="i-ph-buildings-duotone" class="size-4 shrink-0" />
            <span class="min-w-0 break-words">{{ schoolName }}</span>
          </p>
        </div>
        <div class="flex flex-col gap-4 p-5 sm:p-6">
          <slot />
        </div>
      </div>

      <p class="text-center text-label text-muted" data-testid="invite-caption">
        Pautan jemputan ini dikongsi oleh {{ studentName }} melalui PRESTASIPLUS.
      </p>
    </div>
  </main>
</template>
