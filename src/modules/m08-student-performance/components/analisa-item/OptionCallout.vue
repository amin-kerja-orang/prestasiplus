<script setup lang="ts">
/**
 * "Jawapan Betul" / "Jawapan Salah Popular" block of the item detail (FR-M08-69, FR-M08-142): the option
 * letter in a chip and the option text. Success for the right answer, warning for the popular wrong one.
 */
defineProps<{
  variant: 'correct' | 'wrong'
  title: string
  letter: string | null
  text: string
}>()
</script>

<template>
  <UAlert :color="variant === 'correct' ? 'success' : 'warning'" variant="subtle" :title="title">
    <template #description>
      <span class="flex items-start gap-2 text-body text-default">
        <span v-if="letter === null || text === ''" data-testid="option-none">—</span>
        <template v-else>
          <UBadge
            :color="variant === 'correct' ? 'success' : 'warning'"
            variant="solid"
            size="sm"
            :label="letter"
          />
          <span class="min-w-0 break-words">{{ text }}</span>
        </template>
      </span>
    </template>
  </UAlert>
</template>
