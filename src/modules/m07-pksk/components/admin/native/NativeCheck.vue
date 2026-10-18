<script setup lang="ts">
/**
 * Native checkbox inside a 44 px label (the label is the touch target; clicking it toggles the box). Attributes
 * (`checked`, `aria-label`, `data-testid`, `onChange`) go to the `<input>`; `labelTestid` marks the label and the
 * default slot is the optional text after the box.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ labelTestid?: string }>()
</script>

<template>
  <label
    class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 text-label text-default"
    :data-testid="labelTestid"
  >
    <input v-bind="$attrs" type="checkbox" class="size-5 accent-primary" />
    <slot />
  </label>
</template>
