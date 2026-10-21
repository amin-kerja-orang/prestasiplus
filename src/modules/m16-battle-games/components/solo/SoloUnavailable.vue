<script setup lang="ts">
/**
 * Stopgap (D58): in http mode the solo engines read a client-side answer key the real API never sends,
 * and the server check/reveal flow is not wired. The page shows this state instead of the game.
 * Temporary; engine rework is backlog #78. Copy mirrors `UNAVAILABLE_TITLE` in
 * `m28-bijak-spm/server/errors.ts` (not imported, to avoid a cross-module dependency).
 */
import { DsEmptyState } from '@/ds'

const UNAVAILABLE_TITLE = 'Fungsi ini belum tersedia dalam demo'
</script>

<template>
  <DsEmptyState :title="UNAVAILABLE_TITLE" icon="game-controller" data-testid="solo-unavailable" />
</template>
