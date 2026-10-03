<script setup lang="ts">
/**
 * A link that degrades to a plain box. The `/admin-sekolah/kirkpatrick` alias is S1 only (the other
 * Kirkpatrick endpoints answer 403 for a school administrator), so on that mount the detail links
 * would be dead: `to` is `null` there and the element is rendered without a link.
 *
 * INFERRED / provisional: the alias itself (build-plan v1.12 R.1.3, G4 decision F6) and this treatment of its
 * level links are not observed on live or stated in the SRS; the two monitoring KPI links of S1 stay (the
 * `/admin-sekolah/monitoring` route exists).
 */
import { RouterLink } from 'vue-router'

defineProps<{ to: string | null; tag?: 'div' | 'span' }>()
</script>

<template>
  <RouterLink v-if="to !== null" :to="to"><slot /></RouterLink>
  <component :is="tag ?? 'div'" v-else><slot /></component>
</template>
