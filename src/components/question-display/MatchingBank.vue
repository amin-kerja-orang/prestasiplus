<script setup lang="ts">
/** The lettered options of a matching question, shown once in the stimulus panel, read-only (FR-PA-10). */
import { matchingBankCopy } from './copy'
import RichText from './RichText.vue'

defineProps<{ options: readonly { id: string; text: string }[] }>()
</script>

<template>
  <section class="qd-bank" :aria-label="matchingBankCopy.aria" data-testid="matching-bank">
    <h3 class="qd-bank-title">{{ matchingBankCopy.title }}</h3>
    <ul class="qd-bank-list">
      <li v-for="o in options" :key="o.id" class="qd-bank-item" :data-testid="`bank-${o.id}`">
        <span class="qd-bank-id">{{ o.id }}</span>
        <RichText :text="o.text" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* Token-driven bank chrome (no utility classes). */
.qd-bank {
  padding: 0.75rem;
  border-radius: var(--ds-r-card);
  background: var(--ui-bg-muted);
  color: var(--ui-text);
  font-size: var(--text-body);
}
.qd-bank-title {
  margin: 0 0 0.5rem;
  font-size: var(--text-label);
  color: var(--ui-text-toned);
}
.qd-bank-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.qd-bank-item {
  display: flex;
  gap: 0.5rem;
}
.qd-bank-id {
  font-weight: 700;
}
</style>
