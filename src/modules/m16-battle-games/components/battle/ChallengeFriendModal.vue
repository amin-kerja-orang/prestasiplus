<script setup lang="ts">
/**
 * S1 "Cabar Kawan" modal (FN-M16-2.4.1, 2.4.2; FR-M16-30, 31). The input searches #7 after 300 ms of
 * typing, from 2 characters; a click on a result posts #8 with the match parameters and
 * `receiver_id`, closes the modal and, on `{success: true}`, alerts "Cabaran berjaya dihantar kepada
 * {name}!"; a network failure alerts "Ralat menghantar cabaran."; any other answer does nothing.
 * An overlay click closes the modal.
 */
import { onBeforeUnmount, ref, watch } from 'vue'

import { alertNative, useDebounce } from '@/composables'
import { DsDialog, DsStack, DsText } from '@/ds'

import {
  searchOpponent,
  sendInvite,
  type BattleStartBody,
  type OpponentSearchUser,
} from '../../api'
import { BATTLE_MSG, challengeSentMessage } from './battle-lib'

const props = defineProps<{ open: boolean; params: BattleStartBody }>()
const emit = defineEmits<{ 'update:open': [value: false] }>()

const query = ref('')
const results = ref<OpponentSearchUser[]>([])
/** `true` once a search for the current query has answered (drives "Tiada pelajar dijumpai"). */
const searched = ref(false)
let controller: AbortController | null = null

async function runSearch(q: string): Promise<void> {
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  try {
    const res = await searchOpponent(q, { signal: mine.signal })
    if (controller !== mine) return
    const users = (res.body as { users?: OpponentSearchUser[] } | null)?.users
    results.value = Array.isArray(users) ? users : []
    searched.value = true
  } catch {
    if (controller !== mine) return
    results.value = []
    searched.value = true
  }
}

const debounced = useDebounce((q: string) => void runSearch(q), 300)

function onInput(): void {
  const q = query.value.trim()
  if (q.length < 2) {
    debounced.cancel()
    controller?.abort()
    controller = null
    results.value = []
    searched.value = false
    return
  }
  searched.value = false
  debounced(q)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      debounced.cancel()
      controller?.abort()
      controller = null
      query.value = ''
      results.value = []
      searched.value = false
    }
  },
)

onBeforeUnmount(() => {
  controller?.abort()
})

async function pick(user: OpponentSearchUser): Promise<void> {
  emit('update:open', false)
  try {
    const res = await sendInvite({ ...props.params, receiver_id: user.id })
    const body = res.body as { success?: boolean } | null
    if (body?.success === true) alertNative(challengeSentMessage(user.name))
  } catch {
    alertNative(BATTLE_MSG.sendChallengeNetwork)
  }
}
</script>

<template>
  <DsDialog
    :open="open"
    title="Cabar Kawan"
    :dismissible="false"
    @update:open="emit('update:open', false)"
  >
    <DsStack gap="sm" data-testid="battle-challenge-modal">
      <UInput
        v-model="query"
        type="text"
        placeholder="Cari nama pelajar..."
        icon="i-ph-magnifying-glass-duotone"
        size="xl"
        class="w-full"
        data-testid="battle-challenge-input"
        @input="onInput"
      />
      <DsStack gap="xs" class="max-h-64 overflow-y-auto">
        <UButton
          v-for="u in results"
          :key="u.id"
          color="neutral"
          variant="soft"
          block
          class="min-h-14 justify-start gap-3 text-start"
          data-testid="battle-challenge-result"
          @click="pick(u)"
        >
          <UAvatar :text="u.name.charAt(0).toUpperCase()" size="md" />
          <span class="min-w-0 flex-1">
            <DsText variant="label" tone="highlighted" truncate class="block">{{ u.name }}</DsText>
            <DsText variant="caption" as="span" truncate class="block">{{ u.school }}</DsText>
          </span>
          <UIcon name="i-ph-paper-plane-tilt-duotone" class="size-5 shrink-0" aria-hidden="true" />
        </UButton>
        <p
          v-if="searched && results.length === 0"
          class="py-3 text-center text-body text-muted"
          data-testid="battle-challenge-empty"
        >
          Tiada pelajar dijumpai
        </p>
      </DsStack>
    </DsStack>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        size="xl"
        class="min-h-12 justify-center"
        data-testid="battle-challenge-close"
        @click="emit('update:open', false)"
      >
        Tutup
      </UButton>
    </template>
  </DsDialog>
</template>
