<script setup lang="ts">
/**
 * A plain `<a href>` driven by the router (live menus are plain links). Unlike `<RouterLink>` it
 * adds no `router-link-*` classes, so the element carries exactly the live class list; the shells
 * set `active` themselves. Attributes (class, `data-tip`, `title`, `target`) go on the `<a>`.
 * A `target="_blank"` link is left to the browser (RouterLink's `navigate` skips it).
 */
import { RouterLink } from 'vue-router'

defineOptions({ inheritAttrs: false })

defineProps<{ to: string }>()
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to="to" custom>
    <a v-bind="$attrs" :href="href" @click="navigate"><slot /></a>
  </RouterLink>
</template>
