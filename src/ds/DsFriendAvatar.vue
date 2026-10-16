<script setup lang="ts">
/**
 * Virtual friend avatar (Aiman / Aisyah, design system 10.3). Decorative by default. With
 * `interactive` it is a 56px+ button (opens the picker) and `label` is its accessible name,
 * for example "Tukar rakan belajar. Rakan sekarang: Aiman" (BM from the caller).
 */
import type { FriendId } from './assets'
import DsFriendFace, { type FriendSize } from './DsFriendFace.vue'
import type { FriendMood } from './types'

withDefaults(
  defineProps<{
    friend: FriendId
    mood?: FriendMood
    size?: FriendSize
    animated?: boolean
    interactive?: boolean
    /** Accessible name; required when `interactive`. */
    label?: string
  }>(),
  { mood: 'neutral', size: 'md', animated: true, interactive: false, label: undefined },
)

defineEmits<{ press: [] }>()
</script>

<template>
  <UButton
    v-if="interactive"
    color="neutral"
    variant="link"
    class="min-h-14 min-w-14 justify-center rounded-full p-0"
    :aria-label="label"
    data-ds="friend-avatar"
    @click="$emit('press')"
  >
    <DsFriendFace :friend="friend" :mood="mood" :size="size" :animated="animated" />
  </UButton>
  <DsFriendFace v-else :friend="friend" :mood="mood" :size="size" :animated="animated" />
</template>
