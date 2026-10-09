<script setup lang="ts">
/**
 * S1 "Cabar Kawan" modal (FN-M16-2.4.1, 2.4.2; FR-M16-30, 31). The input searches #7 after 300 ms of
 * typing, from 2 characters; a click on a result posts #8 with the match parameters and
 * `receiver_id`, closes the modal and, on `{success: true}`, alerts "Cabaran berjaya dihantar kepada
 * {name}!"; a network failure alerts "Ralat menghantar cabaran."; any other answer does nothing.
 * An overlay click closes the modal.
 */
import { Send, Users, X } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'

import { BaseModal } from '@/components/overlay'
import { alertNative, useDebounce } from '@/composables'

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
  <BaseModal :open="open" :close-on-esc="false" @update:open="emit('update:open', false)">
    <div data-testid="battle-challenge-modal">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Users class="h-5 w-5 text-blue-500" /> Cabar Kawan
        </h3>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          data-testid="battle-challenge-close"
          @click="emit('update:open', false)"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <input
        v-model="query"
        type="text"
        placeholder="Cari nama pelajar..."
        class="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
        data-testid="battle-challenge-input"
        @input="onInput"
      />
      <div class="mt-3 max-h-64 space-y-2 overflow-y-auto">
        <button
          v-for="u in results"
          :key="u.id"
          type="button"
          class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
          data-testid="battle-challenge-result"
          @click="pick(u)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600"
            >{{ u.name.charAt(0).toUpperCase() }}</span
          >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-slate-800">{{ u.name }}</span>
            <span class="block truncate text-xs text-slate-500">{{ u.school }}</span>
          </span>
          <Send class="h-4 w-4 shrink-0 text-slate-400" />
        </button>
        <p
          v-if="searched && results.length === 0"
          class="py-3 text-center text-sm text-slate-500"
          data-testid="battle-challenge-empty"
        >
          Tiada pelajar dijumpai
        </p>
      </div>
    </div>
  </BaseModal>
</template>
