<script setup lang="ts">
/**
 * Cadangan automatik (R1-B13, V2 `kw-suggest`): the keyword match for a mark-scheme-points part,
 * with the matched points ticked. It is a hint only; the pupil sets the real mark below.
 */
import type { KeywordSuggestion } from '../domain/semakan'

defineProps<{ suggestion: KeywordSuggestion; max: number }>()
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="keyword-suggestion">
    <p class="text-body text-default" data-testid="suggestion-line">
      Cadangan automatik (kata kunci):
      <strong class="tabular">{{ suggestion.suggestedMark }} / {{ max }}</strong>
      — {{ suggestion.matched }}/{{ suggestion.total }} isi dikesan. Sila semak &amp; laraskan.
    </p>
    <ul class="flex flex-col gap-1" aria-label="Isi yang dikesan">
      <li
        v-for="p in suggestion.points"
        :key="p.id"
        class="flex items-start gap-2 text-body text-default"
        :data-matched="p.matched"
        :data-testid="`suggestion-point-${p.id}`"
      >
        <UIcon
          :name="p.matched ? 'i-ph-check-circle-fill' : 'i-ph-circle'"
          class="mt-0.5 size-5 shrink-0"
          :class="p.matched ? 'text-success' : 'text-muted'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="sr-only">{{
            p.matched ? 'Kata kunci dikesan dalam jawapan: ' : 'Tidak dikesan: '
          }}</span>
          {{ p.label }}
          <span v-if="p.marks" class="tabular text-muted"> [{{ p.marks }} markah]</span>
        </span>
      </li>
    </ul>
  </div>
</template>
