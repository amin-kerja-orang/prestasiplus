<script setup lang="ts">
/** The lettered options of a matching question, shown once in the stimulus panel, read-only (FR-PA-10). */
import { matchingBankCopy } from './copy'
import RichText from './RichText.vue'

defineProps<{ options: readonly { id: string; text: string }[] }>()
</script>

<template>
  <section
    class="rounded-xl bg-muted p-3"
    :aria-label="matchingBankCopy.aria"
    data-testid="matching-bank"
  >
    <h3 class="mb-2 text-label text-toned">{{ matchingBankCopy.title }}</h3>
    <ul class="flex flex-col gap-1 text-body text-default">
      <li v-for="o in options" :key="o.id" class="flex gap-2" :data-testid="`bank-${o.id}`">
        <span class="font-bold">{{ o.id }}</span>
        <RichText :text="o.text" />
      </li>
    </ul>
  </section>
</template>
