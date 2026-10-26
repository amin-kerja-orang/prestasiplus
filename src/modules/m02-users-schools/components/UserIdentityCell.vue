<script setup lang="ts">
/**
 * S1 identity cell (DV-M02-01): avatar, name and e-mail. Own markup instead of `DsIdentity`, whose two lines
 * are `truncate`: here the name and the e-mail wrap onto further lines and are never cut with "...". The
 * caller caps the width through `class` (it falls through to the root). `whitespace-normal` undoes the
 * table cell's `nowrap`.
 */
import { DsCluster, DsStack, DsText } from '@/ds'

defineProps<{
  name: string
  email: string
  src?: string | null
  /** Avatar initials. */
  initials: string
}>()
</script>

<template>
  <DsCluster :wrap="false" gap="sm" class="whitespace-normal" data-testid="user-identity">
    <UAvatar :src="src || undefined" :text="initials" alt="" size="md" />
    <DsStack gap="none">
      <DsText as="span" variant="body-strong" wrap="anywhere" data-testid="user-name">{{
        name
      }}</DsText>
      <DsText
        as="span"
        variant="label"
        tone="muted"
        wrap="anywhere"
        class="break-all"
        data-testid="user-email"
        >{{ email }}</DsText
      >
    </DsStack>
  </DsCluster>
</template>
