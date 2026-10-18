<script setup lang="ts">
/** Greeting character card: 3D cap, friend avatar and a speech bubble in "awak" voice (D35-D38). */
import { computed } from 'vue'

import { useFriend } from '@/composables/useFriend'
import { DsCharacterCard, DsFriendAvatar, DsSpeechBubble } from '@/ds'

import type { GreetingPeriod } from '../../api/types'
import { greetingText } from '../dashboard/dashboard-lib'

const props = defineProps<{
  period: GreetingPeriod
  name: string
  streakAtRisk: boolean
  streakCount: number
}>()

const { friend, friendName, openPicker } = useFriend()
const title = computed(() => `${greetingText(props.period, props.name)} 👋`)
const line = computed(() =>
  props.streakAtRisk
    ? `Streak ${props.streakCount} hari awak nak putus. Satu latihan pun cukup. Jom?`
    : 'Lima soalan pun dah cukup untuk jaga streak. Jom?',
)
</script>

<template>
  <DsCharacterCard
    accent="friend"
    art="cap"
    :title="title"
    description="Jom teruskan latihan hari ini! 🚀"
    data-testid="dash-hero"
  >
    <div class="mt-2 flex items-end gap-3">
      <DsFriendAvatar
        :friend="friend"
        mood="encouraging"
        size="md"
        interactive
        :label="`Tukar rakan belajar. Rakan sekarang: ${friendName}`"
        data-testid="dash-friend"
        @press="openPicker"
      />
      <DsSpeechBubble :name="friendName" class="min-w-0 flex-1" data-testid="dash-friend-bubble">
        {{ line }}
      </DsSpeechBubble>
    </div>
  </DsCharacterCard>
</template>
