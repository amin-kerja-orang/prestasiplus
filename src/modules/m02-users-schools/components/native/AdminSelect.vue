<script setup lang="ts">
/**
 * Native `<select>` for admin filters and forms, in the Nuxt UI control look (md radius, 44px height,
 * chevron). Native on purpose: it can hold an empty "Semua" value, supports browser `required` and its
 * options may reload under the user. Attributes land on the select, `class` on the wrapper.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <span class="relative block min-w-0" :class="$attrs.class as string">
    <select
      v-model="model"
      v-bind="{ ...$attrs, class: undefined }"
      class="h-11 w-full min-w-0 appearance-none truncate rounded-md bg-elevated pr-10 pl-4 text-body text-default focus-visible:outline-2 focus-visible:outline-primary disabled:text-dimmed"
    >
      <slot />
    </select>
    <UIcon
      name="i-ph-caret-down"
      class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      aria-hidden="true"
    />
  </span>
</template>
