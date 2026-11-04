<script setup lang="ts">
/**
 * Full-screen frame of the attempt (design: "quiz full-screen"). Mobile: one column, with a
 * sticky stimulus chip under the header. From `lg`: pinned stimulus panel on the left (it stays
 * while the questions of its group change), the question in the middle, the question map on the
 * right. The frame owns the fixed positioning so pages stay free of layering utilities.
 */
defineProps<{ hasStimulus: boolean }>()
</script>

<template>
  <!-- Teleported to <body> so the frame sits above the legacy shell's bottom nav and below the
       drawers / modals opened later (same layer, later in the DOM). -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col bg-default text-default"
      data-testid="attempt-shell"
    >
      <div class="shrink-0 px-3 pt-3 pb-2 sm:px-6">
        <slot name="header" />
      </div>
      <slot name="banner" />
      <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" data-testid="attempt-scroll">
        <div class="mx-auto grid w-full max-w-7xl gap-4 px-3 pb-6 sm:px-6 lg:grid-cols-12">
          <aside
            v-if="hasStimulus"
            class="hidden lg:col-span-4 lg:block"
            aria-label="Rajah kekal dipapar"
          >
            <div class="sticky top-0 pt-2" data-testid="pinned-stimulus">
              <slot name="stimulus" />
            </div>
          </aside>
          <div class="min-w-0" :class="hasStimulus ? 'lg:col-span-5' : 'lg:col-span-9'">
            <div v-if="hasStimulus" class="sticky top-0 z-10 bg-default py-2 lg:hidden">
              <slot name="chip" />
            </div>
            <slot name="main" />
          </div>
          <aside class="hidden lg:col-span-3 lg:block">
            <div class="sticky top-0 pt-2">
              <slot name="rail" />
            </div>
          </aside>
        </div>
      </div>
      <footer class="shrink-0 bg-elevated px-3 py-2 shadow-bar-up sm:px-6">
        <slot name="footer" />
      </footer>
    </div>
  </Teleport>
</template>
