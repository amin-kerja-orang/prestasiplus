<script setup lang="ts">
/**
 * S1 "Cabaran Masuk" modal (FN-M16-2.4.3, 2.4.4; FR-M16-32, 33). The page opens it by itself when
 * #9 returns invitations (DV-M16-06). "Terima" posts #10 (arena on success, nothing on another
 * answer, alert "Ralat." on a network failure); "Tolak" posts #11 and the row leaves the list only
 * after the request completes, failures silent.
 */
import { Mail, X } from '@lucide/vue'
import { ref } from 'vue'

import { BaseModal } from '@/components/overlay'
import { alertNative } from '@/composables'

import { acceptInvitation, declineInvitation, type BattleInvitation } from '../../api'
import { BATTLE_MSG } from './battle-lib'

defineProps<{ open: boolean }>()
const invitations = defineModel<BattleInvitation[]>('invitations', { required: true })
const emit = defineEmits<{ 'update:open': [value: false]; matched: [battleUuid: string] }>()

/** uuids with a request in flight (a second click on the same row is ignored). */
const busy = ref<Set<string>>(new Set())

async function accept(inv: BattleInvitation): Promise<void> {
  if (busy.value.has(inv.uuid)) return
  busy.value.add(inv.uuid)
  try {
    const res = await acceptInvitation(inv.uuid)
    const body = res.body as { success?: boolean; battle_uuid?: string } | null
    if (body?.success === true && typeof body.battle_uuid === 'string') {
      emit('matched', body.battle_uuid)
    }
  } catch {
    alertNative(BATTLE_MSG.acceptInviteNetwork)
  } finally {
    busy.value.delete(inv.uuid)
  }
}

async function decline(inv: BattleInvitation): Promise<void> {
  if (busy.value.has(inv.uuid)) return
  busy.value.add(inv.uuid)
  try {
    await declineInvitation(inv.uuid)
  } catch {
    // silent (FN-M16-2.4.4)
  } finally {
    busy.value.delete(inv.uuid)
    invitations.value = invitations.value.filter((i) => i.uuid !== inv.uuid)
  }
}
</script>

<template>
  <BaseModal :open="open" :close-on-esc="false" @update:open="emit('update:open', false)">
    <div data-testid="battle-invitations-modal">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Mail class="h-5 w-5 text-orange-500" /> Cabaran Masuk
        </h3>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          data-testid="battle-invitations-close"
          @click="emit('update:open', false)"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <ul v-if="invitations.length > 0" class="space-y-2">
        <li
          v-for="inv in invitations"
          :key="inv.uuid"
          class="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"
          data-testid="battle-invitation-row"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-slate-800">{{ inv.sender_name }}</span>
            <span class="block text-xs text-slate-500">{{ inv.sender_school }}</span>
          </span>
          <button
            type="button"
            class="min-h-11 rounded-xl bg-green-500 px-4 text-sm font-bold text-white hover:bg-green-600"
            data-testid="battle-invitation-accept"
            @click="accept(inv)"
          >
            Terima
          </button>
          <button
            type="button"
            class="min-h-11 rounded-xl bg-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-300"
            data-testid="battle-invitation-decline"
            @click="decline(inv)"
          >
            Tolak
          </button>
        </li>
      </ul>
      <p
        v-else
        class="py-3 text-center text-sm text-slate-500"
        data-testid="battle-invitations-empty"
      >
        Tiada cabaran buat masa ini
      </p>
    </div>
  </BaseModal>
</template>
