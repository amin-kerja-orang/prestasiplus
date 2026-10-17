<script setup lang="ts">
/**
 * Empty state: `UEmpty` with an optional friend (learner views show the friend, mood
 * "encouraging", instead of a glyph, D37b). Copy and actions come from the caller.
 */
import type { FriendId } from './assets'
import DsFriendFace from './DsFriendFace.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Phosphor icon (staff and fallback). */
    icon?: string
    friend?: FriendId
  }>(),
  { description: undefined, icon: 'i-ph-tray', friend: undefined },
)
</script>

<template>
  <UEmpty
    :title="title"
    :description="description"
    :icon="friend ? undefined : icon"
    variant="naked"
    data-ds="empty-state"
  >
    <template v-if="friend" #leading>
      <DsFriendFace :friend="friend" mood="encouraging" size="lg" />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </UEmpty>
</template>
