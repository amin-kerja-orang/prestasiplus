<script setup lang="ts">
/**
 * L45 S2 valid-token page (FR-L45-22..27; PROPOSED layout from the reference acceptance page, no
 * images, D22). Shared frame: back link, white card with a purple-gradient header (initials tile,
 * eyebrow, H1, school line), the body slot and the caption below. The body per state (guest,
 * non-parent, accepting, linked, error) is supplied by the page.
 */
import { ArrowLeft, School } from '@lucide/vue'
import { RouterLink } from 'vue-router'

defineProps<{
  initials: string
  eyebrow: string
  heading: string
  studentName: string
  schoolName: string | null
}>()

defineSlots<{ default: () => unknown }>()
</script>

<template>
  <main
    class="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 px-3 py-6 font-sans sm:px-4"
    data-testid="invite-valid"
  >
    <div class="w-full max-w-lg">
      <RouterLink
        to="/"
        class="mb-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        data-testid="invite-back"
      >
        <ArrowLeft class="h-4 w-4" />
        PRESTASIPLUS
      </RouterLink>

      <div class="overflow-hidden rounded-3xl bg-white shadow-xl">
        <div class="bg-linear-to-br from-indigo-600 to-purple-700 px-5 py-6 text-white sm:px-6">
          <div class="flex items-center gap-4">
            <span
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 font-heading text-xl font-bold"
              data-testid="invite-initials"
              >{{ initials }}</span
            >
            <div class="min-w-0">
              <p class="text-sm font-medium text-indigo-100" data-testid="invite-eyebrow">
                {{ eyebrow }}
              </p>
              <h1
                class="font-heading text-xl leading-snug font-bold break-words text-white"
                data-testid="invite-heading"
              >
                {{ heading }}
              </h1>
            </div>
          </div>
          <p
            v-if="schoolName"
            class="mt-3 flex items-center gap-2 text-sm text-indigo-100"
            data-testid="invite-school"
          >
            <School class="h-4 w-4 shrink-0" />
            <span class="min-w-0 break-words">{{ schoolName }}</span>
          </p>
        </div>
        <div class="space-y-4 p-5 sm:p-6">
          <slot />
        </div>
      </div>

      <p class="mt-4 text-center text-sm text-slate-500" data-testid="invite-caption">
        Pautan jemputan ini dikongsi oleh {{ studentName }} melalui PRESTASIPLUS.
      </p>
    </div>
  </main>
</template>
