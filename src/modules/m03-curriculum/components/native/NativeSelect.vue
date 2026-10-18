<script setup lang="ts">
/**
 * Native `<select>` for the S22 cascade form and the curriculum filter: md radius, 44px height and a
 * chevron. Kept native on purpose: browser `required` validation, an empty "-- Pilih --" option and option
 * lists that reload under the user (Nuxt UI `USelect` cannot hold an empty value). Attributes land on the
 * select, `class` on the wrapper. Lives outside the strict globs for that reason.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string>({ required: true })
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
