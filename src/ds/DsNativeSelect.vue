<script setup lang="ts">
/**
 * Dropdown select (name kept for compatibility; see also the `DsSelect` alias). Renders a themed
 * Nuxt UI `USelect` (`USelectMenu` with `searchable`): same height, radius and fill as `UInput`, a
 * trailing caret with its own padding, and a raised option list (radius lg, shadow, rows >= 40px,
 * hover / selected states and a check mark). Keyboard (arrows, type-ahead, Enter, Esc) and screen
 * readers are handled by the Reka listbox; touch uses the same popover.
 *
 * Compatibility: a visually hidden native `<select>` stays in the DOM as the form control. It holds
 * the options (from `items` or raw `<option>` / `<optgroup>` in the default slot), carries `id`,
 * `name`, `required`, `data-*` and listeners, takes `v-model` and `selectOption` / `setValue`, and
 * fires `change` when the user picks in the list. `native` renders only the plain native select
 * (print views), with a padded caret. States: hover, focus-visible, disabled, read-only, loading
 * (`aria-busy`), invalid.
 */
import { computed, Comment, Fragment, nextTick, onMounted, ref, useAttrs, useSlots, type VNode } from 'vue'

import './states.css'
import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'

export interface NativeSelectItem {
  label: string
  value: string | number
  disabled?: boolean
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Text of the blank first option; give `blank` for the default "Pilih". */
    placeholder?: string | boolean
    /** Adds a blank first option with the default "Pilih" (or `placeholder` text). */
    blank?: boolean
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    loading?: boolean
    invalid?: boolean
    size?: 'md' | 'lg'
    items?: readonly NativeSelectItem[]
    /** Search box in the list (`USelectMenu`) for long option sets. */
    searchable?: boolean
    /** Plain native `<select>` (print views): padded caret, browser option list. */
    native?: boolean
  }>(),
  {
    placeholder: undefined,
    blank: false,
    required: false,
    disabled: false,
    readonly: false,
    loading: false,
    invalid: false,
    size: 'md',
    items: undefined,
    searchable: false,
    native: false,
  },
)

if (typeof props.placeholder === 'boolean') {
  warnDeprecated('DsNativeSelect', 'placeholder (boolean)', 'blank')
}

const model = defineModel<string | number>({ default: '' })
const attrs = useAttrs()
const slots = useSlots()

/** Reka lists reject an empty-string value, so the blank row travels under this key. */
const BLANK = '__ds_blank__'

const showBlank = computed(
  () => props.blank || props.placeholder === true || typeof props.placeholder === 'string',
)
const blankText = computed(() =>
  typeof props.placeholder === 'string' ? props.placeholder : dsCopy.selectPlaceholder,
)
const locked = computed(() => props.disabled || props.readonly || props.loading)

/** Root keeps `class` / `style`; everything else (id, name, data-*, aria-*, listeners) goes to the control. */
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const controlAttrs = computed(() => {
  const rest: Record<string, unknown> = { ...attrs }
  delete rest.class
  delete rest.style
  return rest
})

// ---- options: `items` prop + raw <option>/<optgroup> from the default slot -----------------------
type Row =
  | { type: 'option'; label: string; value: string | number; disabled: boolean }
  | { type: 'label'; label: string }

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object') {
    const v = node as VNode
    if (v.type === Comment) return ''
    return textOf(v.children)
  }
  return ''
}

function parseSlot(nodes: VNode[] | undefined, out: Row[] = []): Row[] {
  for (const n of nodes ?? []) {
    if (n.type === Fragment) parseSlot(n.children as VNode[], out)
    else if (n.type === 'option') {
      const p = (n.props ?? {}) as Record<string, unknown>
      const label = textOf(n.children).trim()
      out.push({
        type: 'option',
        label,
        value: (p.value ?? label) as string | number,
        disabled: p.disabled !== undefined && p.disabled !== false,
      })
    } else if (n.type === 'optgroup') {
      const p = (n.props ?? {}) as Record<string, unknown>
      out.push({ type: 'label', label: typeof p.label === 'string' ? p.label : '' })
      parseSlot(n.children as VNode[], out)
    }
  }
  return out
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  if (showBlank.value) out.push({ type: 'option', label: blankText.value, value: '', disabled: false })
  for (const it of props.items ?? []) {
    out.push({ type: 'option', label: it.label, value: it.value, disabled: Boolean(it.disabled) })
  }
  parseSlot(slots.default?.(), out)
  return out
})

/** A blank row worded "Pilih ..." is a prompt (trigger placeholder, not a list row); "Semua ..." stays a row. */
const isPrompt = (label: string): boolean => /^pilih/i.test(label)
const promptText = computed(() => {
  const r = rows.value.find((x) => x.type === 'option' && x.value === '' && isPrompt(x.label))
  return r?.label
})

/** USelect items: one blank row at most, `''` swapped for the sentinel; prompts are left out. */
const listItems = computed(() => {
  let blankSeen = false
  const out: Record<string, unknown>[] = []
  for (const r of rows.value) {
    if (r.type === 'label') {
      out.push({ type: 'label', label: r.label })
      continue
    }
    const isBlank = r.value === ''
    if (isBlank) {
      if (isPrompt(r.label)) continue
      if (blankSeen) continue
      blankSeen = true
    }
    out.push({ label: r.label, value: isBlank ? BLANK : r.value, disabled: r.disabled })
  }
  return out
})
const hasBlankRow = computed(() => listItems.value.some((i) => i.value === BLANK))
const uiValue = computed(() => {
  if (model.value === '') return hasBlankRow.value ? BLANK : undefined
  return model.value
})
const blankSelected = computed(() => uiValue.value === BLANK)
const triggerPlaceholder = computed(() => promptText.value ?? undefined)

// ---- sync with the hidden native select -----------------------------------------------------------
const nativeEl = ref<HTMLSelectElement | null>(null)
const triggerWrap = ref<HTMLElement | null>(null)
const open = ref(false)

function onPick(v: unknown): void {
  model.value = (v === BLANK ? '' : v) as string | number
  // Callers listening for `change` on the control get it once the native select shows the pick.
  void nextTick(() => nativeEl.value?.dispatchEvent(new Event('change', { bubbles: true })))
}
function onOpen(v: boolean): void {
  open.value = locked.value ? false : v
}
function focusTrigger(): void {
  triggerWrap.value?.querySelector<HTMLElement>('[role="combobox"], button')?.focus()
}

// A `<label for>` points at the hidden select; the visible trigger borrows its text as its name.
const labelText = ref<string>()
onMounted(() => {
  const id = attrs.id
  if (typeof id !== 'string' || attrs['aria-label'] || attrs['aria-labelledby']) return
  labelText.value = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim()
})
const triggerAria = computed(() => ({
  'aria-label': (attrs['aria-label'] as string | undefined) ?? labelText.value,
  'aria-labelledby': attrs['aria-labelledby'] as string | undefined,
  'aria-describedby': attrs['aria-describedby'] as string | undefined,
  'aria-invalid': props.invalid || attrs['aria-invalid'] === 'true' || attrs['aria-invalid'] === true ? 'true' : undefined,
  'aria-required': props.required ? 'true' : undefined,
  'aria-readonly': props.readonly ? 'true' : undefined,
  'aria-busy': props.loading ? 'true' : undefined,
}))

const dataState = computed(() =>
  props.invalid ? 'invalid' : props.loading ? 'loading' : props.readonly ? 'read-only' : undefined,
)
const triggerClass = computed(() => [
  'w-full',
  props.size === 'lg' ? 'min-h-12' : '',
  props.readonly ? 'bg-soft hover:bg-soft cursor-default' : '',
  props.loading ? 'animate-pulse cursor-progress' : '',
])
</script>

<template>
  <div
    v-bind="rootAttrs"
    class="relative w-full min-w-0"
    data-ds="native-select"
    :data-state="dataState"
    :data-variant="native ? 'native' : 'list'"
  >
    <!-- Plain native control (print views): appearance reset, caret drawn on its own padding. -->
    <template v-if="native">
      <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
      <select
        v-model="model"
        v-bind="controlAttrs"
        :required="required"
        :disabled="disabled"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-readonly="readonly ? 'true' : undefined"
        :aria-busy="loading ? 'true' : undefined"
        class="w-full min-w-0 rounded-sm py-2 ps-3.5 pe-10 text-body text-default transition-colors duration-fast"
        :class="[
          size === 'lg' ? 'min-h-12' : 'min-h-11 learner:min-h-13',
          invalid ? 'bg-error-field' : readonly ? 'bg-soft' : 'bg-elevated hover:bg-accented',
          readonly || loading ? 'pointer-events-none' : '',
        ]"
        @keydown="(e: KeyboardEvent) => locked && !disabled && e.key !== 'Tab' && e.preventDefault()"
      >
        <option v-if="showBlank" value="">{{ blankText }}</option>
        <template v-if="items">
          <option v-for="it in items" :key="it.value" :value="it.value" :disabled="it.disabled">
            {{ it.label }}
          </option>
        </template>
        <slot />
      </select>
      <span
        class="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-muted"
        aria-hidden="true"
      >
        <UIcon name="i-ph-caret-down" class="size-5" />
      </span>
    </template>

    <template v-else>
      <!-- Hidden form control: options, id/name/required, v-model and test hooks live here. -->
      <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
      <select
        ref="nativeEl"
        v-model="model"
        v-bind="controlAttrs"
        :required="required"
        :disabled="disabled"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-readonly="readonly ? 'true' : undefined"
        :aria-busy="loading ? 'true' : undefined"
        :data-state="dataState"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        data-ds-control="select"
        @focus="focusTrigger"
      >
        <option v-if="showBlank" value="">{{ blankText }}</option>
        <template v-if="items">
          <option v-for="it in items" :key="it.value" :value="it.value" :disabled="it.disabled">
            {{ it.label }}
          </option>
        </template>
        <slot />
      </select>
      <div ref="triggerWrap" class="contents">
        <USelectMenu
          v-if="searchable"
          :model-value="uiValue"
          :items="listItems"
          :placeholder="triggerPlaceholder"
          :disabled="locked"
          :size="size"
          :class="triggerClass"
          :ui="{ value: blankSelected ? 'text-muted' : '' }"
          v-bind="triggerAria"
          value-key="value"
          :search-input="{ placeholder: dsCopy.selectSearch, icon: 'i-ph-magnifying-glass', variant: 'none' }"
          @update:model-value="onPick"
        />
        <USelect
          v-else
          :model-value="uiValue"
          :items="listItems"
          :placeholder="triggerPlaceholder"
          :disabled="disabled"
          :open="open"
          :size="size"
          :class="triggerClass"
          :ui="{ value: blankSelected ? 'text-muted' : '' }"
          v-bind="triggerAria"
          @update:model-value="onPick"
          @update:open="onOpen"
        />
      </div>
    </template>
  </div>
</template>
