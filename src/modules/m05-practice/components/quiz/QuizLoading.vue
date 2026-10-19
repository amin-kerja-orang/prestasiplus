<script setup lang="ts">
import { DsHeading, DsText } from '@/ds'

/** The loading card of the quiz (also shown while a chapter quiz looks up its level). Copy from the host. */
defineProps<{ title: string; text: string }>()
</script>

<template>
  <UCard class="mt-12">
    <div class="flex flex-col items-center gap-3 py-8 text-center" role="status">
      <UIcon
        name="i-ph-circle-notch-bold"
        class="size-12 animate-spin text-primary-t motion-reduce:animate-none"
        aria-hidden="true"
      />
      <DsHeading :level="1" variant="heading">{{ title }}</DsHeading>
      <DsText variant="body" tone="muted">{{ text }}</DsText>
    </div>
  </UCard>
</template>
