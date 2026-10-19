<script setup lang="ts">
/**
 * Live Alpine modal (F-15; overview §9, design-system §7.7, NFR-RESP-07).
 *
 * Closes without submitting through the `close()` function the default slot receives (for the
 * screen's own "Batal" / `X` buttons, whose markup stays in the screen) and, where the variant
 * or the props allow it, on backdrop click or Esc (live `@keydown.escape.window`). Every close
 * emits `update:open` (false) and `close` with the reason. Behaviour defaults per variant are in
 * `MODAL_BEHAVIOUR` (the sheet closes only through its own buttons and has no transition).
 *
 * D10: no `role="dialog"`, `aria-modal`, focus trap, focus move or scroll lock — live modals
 * have none. Extra attributes (`data-testid`, classes) go to the panel.
 */
import { computed, onBeforeUnmount, watch } from 'vue'

import {
  MODAL_BEHAVIOUR,
  MODAL_CLASSES,
  MODAL_PANEL_TRANSITION,
  MODAL_TRANSITION,
  type ModalCloseReason,
  type ModalTransition,
  type ModalVariant,
} from './classes'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    open: boolean
    variant?: ModalVariant
    /** Replace the variant's classes (a screen whose live modal differs, e.g. `max-w-2xl`). */
    containerClass?: string
    backdropClass?: string
    panelClass?: string
    /** Default per variant: margin true, sheet false. */
    closeOnBackdrop?: boolean
    /** Default per variant: margin true, sheet false. */
    closeOnEsc?: boolean
    /** Default per variant: margin `fade`, sheet `none`. */
    transition?: ModalTransition
    teleportTo?: string
    teleportDisabled?: boolean
  }>(),
  {
    variant: 'margin',
    containerClass: undefined,
    backdropClass: undefined,
    panelClass: undefined,
    closeOnBackdrop: undefined,
    closeOnEsc: undefined,
    transition: undefined,
    teleportTo: 'body',
    teleportDisabled: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: false]
  close: [reason: ModalCloseReason]
}>()

defineSlots<{ default?: (props: { close: () => void }) => unknown }>()

const classes = computed(() => {
  const preset = MODAL_CLASSES[props.variant]
  return {
    container: props.containerClass ?? preset.container,
    backdrop: props.backdropClass ?? preset.backdrop,
    panel: props.panelClass ?? preset.panel,
  }
})

const behaviour = computed(() => {
  const preset = MODAL_BEHAVIOUR[props.variant]
  return {
    closeOnBackdrop: props.closeOnBackdrop ?? preset.closeOnBackdrop,
    closeOnEsc: props.closeOnEsc ?? preset.closeOnEsc,
    transition: props.transition ?? preset.transition,
  }
})

// `css: false` with no JS hooks makes <Transition> insert and remove at once.
const NO_TRANSITION = { css: false } as const
const outerTransition = computed(() =>
  behaviour.value.transition === 'none' ? NO_TRANSITION : MODAL_TRANSITION,
)
const panelTransition = computed(() =>
  behaviour.value.transition === 'none' ? NO_TRANSITION : MODAL_PANEL_TRANSITION,
)

function requestClose(reason: ModalCloseReason) {
  if (!props.open) return
  emit('update:open', false)
  emit('close', reason)
}

function close() {
  requestClose('button')
}

function onBackdrop() {
  if (behaviour.value.closeOnBackdrop) requestClose('backdrop')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && behaviour.value.closeOnEsc) requestClose('esc')
}

watch(
  () => props.open,
  (open) => {
    if (typeof window === 'undefined') return
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport :to="teleportTo" :disabled="teleportDisabled">
    <Transition v-bind="outerTransition">
      <div
        v-if="open"
        :class="classes.container"
        :data-variant="variant"
        :data-transition="behaviour.transition"
        data-testid="cmp-modal"
      >
        <div :class="classes.backdrop" data-testid="cmp-modal-backdrop" @click="onBackdrop" />
        <Transition v-bind="panelTransition" appear>
          <div :class="classes.panel" v-bind="$attrs">
            <slot :close="close" />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
