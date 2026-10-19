<script setup lang="ts">
/**
 * S1 "Cabaran Masuk" modal (FN-M16-2.4.3, 2.4.4; FR-M16-32, 33). The page opens it by itself when
 * #9 returns invitations (DV-M16-06). "Terima" posts #10 (arena on success, nothing on another
 * answer, alert "Ralat." on a network failure); "Tolak" posts #11 and the row leaves the list only
 * after the request completes, failures silent.
 */
import { ref } from 'vue'

import { alertNative } from '@/composables'
import { DsDialog } from '@/ds'

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
  <DsDialog
    :open="open"
    title="Cabaran Masuk"
    :dismissible="false"
    @update:open="emit('update:open', false)"
  >
    <div data-testid="battle-invitations-modal">
      <ul v-if="invitations.length > 0" class="flex flex-col gap-2">
        <li
          v-for="inv in invitations"
          :key="inv.uuid"
          class="flex flex-wrap items-center gap-3 rounded-card bg-elevated p-3"
          data-testid="battle-invitation-row"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-label text-highlighted">{{ inv.sender_name }}</span>
            <span class="block text-caption text-muted">{{ inv.sender_school }}</span>
          </span>
          <UButton
            color="success"
            size="lg"
            class="min-h-11"
            data-testid="battle-invitation-accept"
            @click="accept(inv)"
          >
            Terima
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            size="lg"
            class="min-h-11"
            data-testid="battle-invitation-decline"
            @click="decline(inv)"
          >
            Tolak
          </UButton>
        </li>
      </ul>
      <p v-else class="py-3 text-center text-body text-muted" data-testid="battle-invitations-empty">
        Tiada cabaran buat masa ini
      </p>
    </div>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        size="xl"
        class="min-h-12 justify-center"
        data-testid="battle-invitations-close"
        @click="emit('update:open', false)"
      >
        Tutup
      </UButton>
    </template>
  </DsDialog>
</template>
