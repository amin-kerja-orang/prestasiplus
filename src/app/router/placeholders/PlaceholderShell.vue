<script setup lang="ts">
/**
 * TEMPORARY shell frame (F-13) for the layouts whose components are not built yet: `user`
 * (F-19), `admin` (F-18, admin slice) and `public` (F-20). It only wraps the page; the real
 * shells replace the entries in `../layouts.ts`.
 */
import type { ShellKind } from '../layouts'

defineProps<{ kind: ShellKind }>()
</script>

<template>
  <div :data-layout="kind" class="min-h-screen bg-slate-50">
    <slot />
  </div>
</template>
