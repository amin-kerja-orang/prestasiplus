<script setup lang="ts">
/**
 * Seller actions of P2-13 (list card and detail "Semak Penjual"): only the transitions the server says are allowed
 * now (`actions`, the same list as `marketplaceSellerActions`). Each asks first: "Haramkan penjual ini?" or
 * "{Tindakan} penjual ini?" with `Batal` / `Ya, {Tindakan}`, then posts. A refused transition (409) shows its message
 * and asks the page to reload, so the buttons follow the real status.
 */
import { MARKETPLACE_SELLER_ACTION_LABELS, type MarketplaceAdminSellerDetail, type MarketplaceSellerAction } from '@pp/contract'
import { ref } from 'vue'

import { useFlash } from '@/composables'
import { DsCluster, useConfirm } from '@/ds'

import { runAdminSellerAction } from '../../api'
import { ADMIN_COPY, SELLER_FLASH, errorText, sellerConfirm, sellerConfirmYes } from './copy'

const props = defineProps<{
  id: string
  actions: readonly MarketplaceSellerAction[]
  /** Link to the detail page (list cards only). */
  detailTo?: string
}>()

const emit = defineEmits<{ done: [detail: MarketplaceAdminSellerDetail]; failed: [] }>()

const confirm = useConfirm()
const flash = useFlash()
const busy = ref<MarketplaceSellerAction | null>(null)

const TONE: Record<MarketplaceSellerAction, 'primary' | 'error'> = {
  approve: 'primary',
  verify: 'primary',
  suspend: 'error',
  ban: 'error',
}

async function run(action: MarketplaceSellerAction): Promise<void> {
  if (busy.value !== null) return
  const yes = await confirm({
    message: sellerConfirm(action),
    confirmLabel: sellerConfirmYes(action),
    cancelLabel: ADMIN_COPY.cancel,
    tone: TONE[action],
  })
  if (!yes) return
  busy.value = action
  try {
    const detail = await runAdminSellerAction(props.id, action)
    flash.show({ type: 'success', message: SELLER_FLASH[action] })
    emit('done', detail)
  } catch (err) {
    flash.show({ type: 'error', message: errorText(err) })
    emit('failed')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <DsCluster gap="xs" data-testid="seller-actions">
    <UButton
      v-if="detailTo"
      :to="detailTo"
      color="neutral"
      variant="soft"
      class="min-h-11"
      :label="ADMIN_COPY.viewDetail"
      data-testid="seller-action-detail"
    />
    <UButton
      v-for="a in actions"
      :key="a"
      type="button"
      :color="a === 'ban' ? 'error' : a === 'suspend' ? 'warning' : 'primary'"
      variant="soft"
      class="min-h-11"
      :label="MARKETPLACE_SELLER_ACTION_LABELS[a]"
      :loading="busy === a"
      :disabled="busy !== null"
      :data-testid="`seller-action-${a}`"
      @click="run(a)"
    />
  </DsCluster>
</template>
