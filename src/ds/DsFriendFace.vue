<script setup lang="ts">
/**
 * Internal visual of DsFriendAvatar: face PNG on an AI-tinted disc, soft halo, mood badge. The
 * motion follows the mood (design system 10.3); reduced motion leaves only the static badge.
 */
import { friendFaces, type FriendId } from './assets'
import type { FriendMood } from './types'

export type FriendSize = 'sm' | 'md' | 'lg' | 'xl'

withDefaults(
  defineProps<{
    friend: FriendId
    mood?: FriendMood
    size?: FriendSize
    animated?: boolean
  }>(),
  { mood: 'neutral', size: 'md', animated: true },
)

const boxSize: Record<FriendSize, string> = {
  sm: 'size-10',
  md: 'size-14',
  lg: 'size-24',
  xl: 'size-30',
}
const badgeSize: Record<FriendSize, string> = {
  sm: 'size-4.5 text-caption',
  md: 'size-5.5 text-caption',
  lg: 'size-7 text-label',
  xl: 'size-8 text-label',
}
const moodEmoji: Record<FriendMood, string> = {
  neutral: '',
  happy: '😊',
  encouraging: '💪',
  celebrating: '🎉',
}
const moodMotion: Record<FriendMood, string> = {
  neutral: 'animate-ds-bob motion-reduce:animate-none',
  happy: 'animate-ds-hop motion-reduce:animate-none',
  encouraging: 'animate-ds-hop motion-reduce:animate-none',
  celebrating: 'animate-ds-party motion-reduce:animate-none',
}
</script>

<template>
  <span class="relative inline-flex shrink-0" :class="boxSize[size]" data-ds="friend-face">
    <span
      class="size-full rounded-full bg-ai/20 p-1 shadow-lift"
      :class="animated && moodMotion[mood]"
    >
      <img
        :src="friendFaces[friend]"
        alt=""
        aria-hidden="true"
        class="size-full rounded-full bg-ai/20 object-cover"
        width="120"
        height="120"
        draggable="false"
      />
    </span>
    <span
      v-if="moodEmoji[mood]"
      class="absolute -right-1 -bottom-1 inline-grid place-items-center rounded-full bg-default shadow-lift"
      :class="badgeSize[size]"
      aria-hidden="true"
      data-ds="mood-badge"
      >{{ moodEmoji[mood] }}</span
    >
  </span>
</template>
