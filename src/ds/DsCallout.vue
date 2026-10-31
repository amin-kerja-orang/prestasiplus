<script setup lang="ts">
/**
 * Inline notice (admin page templates G4): `UAlert` with typed tones, a default icon per tone, an
 * optional dismiss button and an optional collapsible body (a guide the user can fold away). With
 * `storageKey` the choice (dismissed / collapsed) is remembered in `localStorage` per browser.
 * `tone="error"` is announced (`role="alert"`), the other tones are plain content; the root takes
 * focus through `focus()` (exposed) so a form can move focus to its error summary.
 * Body = `description` text, then the default slot; `#actions` sits under the body.
 */
import { computed, onMounted, ref, useId, useSlots } from 'vue'

import DsIcon from './DsIcon.vue'
import type { DsIconProp } from './types'

type CalloutTone = 'info' | 'success' | 'warning' | 'error'

const props = withDefaults(
  defineProps<{
    tone?: CalloutTone
    title?: string
    description?: string
    /** Phosphor base name; default per tone. */
    icon?: DsIconProp
    /** Shows a close button (the callout is removed). */
    dismissible?: boolean
    /** The body folds under the title (the title becomes the toggle). Needs a `title`. */
    collapsible?: boolean
    /** Initial state of a collapsible callout when nothing is remembered (default: collapsed). */
    defaultOpen?: boolean
    /** Remembers dismissed / collapsed in `localStorage` (`pp:callout:<key>`). */
    storageKey?: string
  }>(),
  {
    tone: 'info',
    title: undefined,
    description: undefined,
    icon: undefined,
    dismissible: false,
    collapsible: false,
    defaultOpen: false,
    storageKey: undefined,
  },
)

const emit = defineEmits<{ dismiss: [] }>()
const slots = useSlots()

const TONE_ICON: Record<CalloutTone, string> = {
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  error: 'warning-circle',
}

const bodyId = useId()
const root = ref<{ $el: HTMLElement } | null>(null)
const open = ref(props.defaultOpen)
const dismissed = ref(false)

const storeKey = computed(() => (props.storageKey ? `pp:callout:${props.storageKey}` : undefined))
function read(): string | null {
  try {
    return storeKey.value ? window.localStorage.getItem(storeKey.value) : null
  } catch {
    return null
  }
}
function write(value: 'dismissed' | 'open' | 'collapsed'): void {
  try {
    if (storeKey.value) window.localStorage.setItem(storeKey.value, value)
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
}
onMounted(() => {
  const saved = read()
  if (saved === 'dismissed' && props.dismissible) dismissed.value = true
  else if (saved === 'collapsed' && props.collapsible) open.value = false
  else if (saved === 'open' && props.collapsible) open.value = true
})

function toggle(): void {
  open.value = !open.value
  write(open.value ? 'open' : 'collapsed')
}
function dismiss(): void {
  dismissed.value = true
  write('dismissed')
  emit('dismiss')
}

const hasBody = computed(() => Boolean(props.description) || Boolean(slots.default))
const role = computed(() => (props.tone === 'error' ? 'alert' : undefined))

function focus(): void {
  root.value?.$el.focus()
}
defineExpose({ focus })
</script>

<template>
  <UAlert
    v-if="!dismissed"
    ref="root"
    :color="tone"
    variant="subtle"
    :icon="`i-ph-${TONE_ICON[tone]}`"
    :close="dismissible"
    :role="role"
    tabindex="-1"
    :data-tone="tone"
    :data-collapsible="collapsible ? 'true' : undefined"
    :data-state="collapsible ? (open ? 'open' : 'closed') : undefined"
    :ui="collapsible ? { root: 'p-3 pe-4 sm:px-4', description: 'mt-0 max-w-prose', wrapper: 'min-w-0' } : undefined"
    data-ds="callout"
    @update:open="dismiss"
  >
    <template v-if="icon || collapsible" #leading>
      <!-- Collapsible: the icon sits in a row as tall as the toggle, so it centres on the title line. -->
      <span class="flex shrink-0 items-center" :class="collapsible ? 'h-10' : ''">
        <DsIcon v-if="icon" :name="icon" class="size-5 shrink-0" />
        <UIcon v-else :name="`i-ph-${TONE_ICON[tone]}`" class="size-5 shrink-0" />
      </span>
    </template>
    <template v-if="title" #title>
      <UButton
        v-if="collapsible"
        type="button"
        color="neutral"
        variant="ghost"
        block
        class="min-h-10 justify-between gap-3 px-0 text-start text-label hover:bg-transparent active:bg-transparent"
        :trailing-icon="open ? 'i-ph-caret-up-bold' : 'i-ph-caret-down-bold'"
        :aria-expanded="open"
        :aria-controls="bodyId"
        data-ds="callout-toggle"
        @click="toggle"
      >
        <span class="grow text-start">{{ title }}</span>
      </UButton>
      <template v-else>{{ title }}</template>
    </template>
    <template v-if="hasBody" #description>
      <div
        v-show="!collapsible || open"
        :id="bodyId"
        class="flex flex-col gap-2"
        :class="collapsible ? 'max-w-prose pb-1 text-body leading-relaxed' : ''"
        data-ds="callout-body"
      >
        <span v-if="description">{{ description }}</span>
        <slot />
      </div>
    </template>
    <template v-if="$slots.actions" #actions>
      <div v-show="!collapsible || open" class="mt-2 flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </template>
  </UAlert>
</template>
