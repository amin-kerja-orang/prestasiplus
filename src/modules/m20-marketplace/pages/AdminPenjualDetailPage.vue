<script setup lang="ts">
/**
 * P2-13 `/admin/marketplace/sellers/:id` "Semak Penjual" with "Maklumat Perniagaan" (R1-ADM-P2-13): the shop's business
 * details, the masked owner, the status and the same actions as the list (only the ones allowed now, each after a confirm).
 * An unknown id answers 404 and the page returns to the list with the API's message.
 */
import { MARKETPLACE_SELLER_STATUS_LABELS, type MarketplaceAdminSellerDetail, type MarketplaceSellerStatus } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsCluster, DsDefinitionList, DsHeading, DsLoadError, DsPage, DsPanel, DsStack, DsStatusBadge, type DsStatus } from '@/ds'
import { formatDateTimeRaw } from '@/lib/time'

import { fetchAdminSeller } from '../api'
import { ADMIN_COPY, ADMIN_SELLERS_PATH, errorText } from '../components/admin/copy'
import SellerActions from '../components/admin/SellerActions.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminSeller(props.id, { signal }), () => props.id)
// After an action the answer replaces the loaded seller (no second request).
const current = ref<MarketplaceAdminSellerDetail | null>(null)
watch(data, (d) => (current.value = d), { immediate: true })

watch(error, (err) => {
  if (isApiError(err) && err.status === 404) {
    flash.error(ADMIN_COPY.sellerNotFound)
    void router.replace(ADMIN_SELLERS_PATH)
  }
})

const failed = computed(() => error.value !== null && !(isApiError(error.value) && error.value.status === 404))

const BADGE: Record<MarketplaceSellerStatus, DsStatus> = {
  pending: 'pending-approval',
  active: 'active',
  suspended: 'inactive',
  banned: 'rejected',
}

const items = computed(() => {
  const s = current.value
  if (!s) return []
  return [
    { key: 'shop', label: ADMIN_COPY.shopName, value: s.shopName },
    { key: 'owner', label: ADMIN_COPY.ownerLabel, value: s.ownerMasked },
    { key: 'description', label: ADMIN_COPY.shopDescription, value: s.description ?? '—' },
    { key: 'phone', label: ADMIN_COPY.phone, value: s.phone },
    { key: 'whatsapp', label: ADMIN_COPY.whatsapp, value: s.whatsapp },
    { key: 'products', label: ADMIN_COPY.productsLabel, value: ADMIN_COPY.productCount(s.productCount) },
    { key: 'clicks', label: ADMIN_COPY.clicks, value: String(s.whatsappClicks) },
    { key: 'verified', label: ADMIN_COPY.verified, value: s.verifiedAt ? `${ADMIN_COPY.verifiedYes} (${formatDateTimeRaw(s.verifiedAt)})` : ADMIN_COPY.verifiedNo },
    { key: 'joined', label: ADMIN_COPY.joined, value: formatDateTimeRaw(s.createdAt) },
  ]
})
</script>

<template>
  <DsPage :back-to="ADMIN_SELLERS_PATH" :back-label="ADMIN_COPY.backToSellers" data-testid="admin-seller-detail-page">
    <DsLoadError v-if="failed" :message="errorText(error)" testid="admin-seller-detail-error" @retry="reload()" />
    <DsStack v-else-if="!current" gap="sm" aria-busy="true" data-testid="admin-seller-detail-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </DsStack>
    <DsPanel v-else data-testid="admin-seller-detail">
      <DsStack gap="md">
        <DsCluster gap="sm">
          <DsHeading :level="2" variant="heading">{{ ADMIN_COPY.sellerDetailTitle }}</DsHeading>
          <DsStatusBadge :status="BADGE[current.status]" :label="MARKETPLACE_SELLER_STATUS_LABELS[current.status]" data-testid="admin-seller-status" />
        </DsCluster>
        <DsHeading :level="3" variant="label">{{ ADMIN_COPY.businessInfo }}</DsHeading>
        <DsDefinitionList :items="items" />
        <SellerActions :id="current.id" :actions="current.actions" @done="(d) => (current = d)" @failed="reload()" />
      </DsStack>
    </DsPanel>
  </DsPage>
</template>
