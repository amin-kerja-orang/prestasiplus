<script setup lang="ts">
/**
 * Sticky action bar of a form, on `DsPanel tone="bar"`. Right-aligned order: `extra`, Batal
 * (tonal), submit (primary, `type="submit"`, loading while `saving`). `status` sits on the left.
 * Batal is a link when `cancelTo` is set, otherwise it emits `cancel`.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import DsPanel from './DsPanel.vue'
import { resolveIcon } from './icon'
import { usePersonality } from './personality'
import type { DsIconProp } from './types'

const props = withDefaults(
  defineProps<{
    submitLabel?: string
    cancelLabel?: string
    cancelTo?: RouteLocationRaw
    saving?: boolean
    disabled?: boolean
    showCancel?: boolean
    sticky?: boolean
    /** Phosphor base name of the submit button icon. */
    submitIcon?: DsIconProp
  }>(),
  {
    submitLabel: dsCopy.save,
    cancelLabel: dsCopy.cancel,
    cancelTo: undefined,
    saving: false,
    disabled: false,
    showCancel: true,
    sticky: true,
    // Bundle hint until `floppy-disk` joins `ds-icons.ts`: i-ph-floppy-disk i-ph-floppy-disk-duotone
    submitIcon: 'floppy-disk',
  },
)

const personality = usePersonality()

const emit = defineEmits<{ cancel: [] }>()

/*
 * A sticky bar hides whatever sits under it, and the browser does not scroll a focused field that
 * is "in view" but behind the bar (the last field of a long form on a phone). The scrolling
 * ancestor therefore gets `scroll-padding-bottom` = bar height + its offset, so a focused field,
 * an error summary link or a hash target always lands above the bar.
 */
const panel = ref<{ $el: HTMLElement } | null>(null)
let scroller: HTMLElement | null = null
let previous = ''
let observer: ResizeObserver | null = null

function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p
  }
  // No scrolling ancestor: the window scrolls (admin, learner and public shells), so the padding
  // goes on the root element.
  return document.documentElement
}
function pad(): void {
  const el = panel.value?.$el
  if (scroller && el) scroller.style.scrollPaddingBottom = `${Math.ceil(el.offsetHeight) + 16}px`
}
function attach(): void {
  const el = panel.value?.$el
  if (!props.sticky || !el || scroller) return
  scroller = scrollParent(el)
  previous = scroller.style.scrollPaddingBottom
  pad()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(pad)
    observer.observe(el)
  }
}
function detach(): void {
  observer?.disconnect()
  observer = null
  if (scroller) scroller.style.scrollPaddingBottom = previous
  scroller = null
}
onMounted(attach)
onBeforeUnmount(detach)
watch(
  () => props.sticky,
  (on) => (on ? attach() : detach()),
)
</script>

<template>
  <DsPanel ref="panel" tone="bar" :sticky="sticky" data-ds="form-bar">
    <div class="flex flex-wrap items-center justify-end gap-3">
      <div v-if="$slots.status" class="mr-auto min-w-0 text-caption text-muted">
        <slot name="status" />
      </div>
      <slot name="extra" />
      <UButton
        v-if="showCancel"
        :to="cancelTo"
        :type="cancelTo ? undefined : 'button'"
        color="neutral"
        variant="soft"
        :label="cancelLabel"
        class="min-h-11"
        data-testid="form-cancel"
        @click="cancelTo ? undefined : emit('cancel')"
      />
      <slot name="submit">
        <UButton
          type="submit"
          variant="solid"
          :icon="resolveIcon(submitIcon, personality)"
          :label="submitLabel"
          :loading="saving"
          :disabled="saving || disabled"
          class="min-h-11"
          data-testid="form-submit"
        />
      </slot>
    </div>
  </DsPanel>
</template>
