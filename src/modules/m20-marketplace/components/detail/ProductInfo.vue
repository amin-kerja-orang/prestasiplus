<script setup lang="ts">
/**
 * Product info card of S7 (FN-M20-4.2.*): condition + category chips, name, price (struck original
 * and discount), description, views, stock, shipping, location and the WhatsApp button.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { ProductDetail } from '../../api'
import { formatPrice } from '../product/copy'
import { DETAIL_COPY } from './copy'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

const props = defineProps<{ product: ProductDetail }>()
const router = useRouter()

const whatsappHref = computed(
  () => router.resolve(`/marketplace/${encodeURIComponent(props.product.slug)}/whatsapp`).href,
)
const inStock = computed(() => props.product.stockStatus === 'available')
</script>

<template>
  <UCard class="min-w-0" data-testid="product-info">
    <DsStack>
      <DsCluster gap="xs">
        <UBadge
          :color="product.condition === 'used' ? 'warning' : 'success'"
          variant="soft"
          data-testid="product-condition"
          >{{ product.condition === 'used' ? DETAIL_COPY.used : DETAIL_COPY.new }}</UBadge
        >
        <UBadge color="primary" variant="soft" data-testid="product-category">
          {{ product.category.name }}
        </UBadge>
      </DsCluster>

      <DsHeading :level="1" wrap="anywhere" data-testid="product-name">
        {{ product.name }}
      </DsHeading>

      <DsCluster row-gap="2xs" align="baseline">
        <DsText variant="title" as="span" tabular data-testid="product-price">{{
          formatPrice(product.price)
        }}</DsText>
        <template v-if="product.originalPrice !== null">
          <s class="text-body text-muted" data-testid="product-original">{{
            formatPrice(product.originalPrice)
          }}</s>
          <UBadge
            v-if="product.discountPct !== null"
            color="error"
            variant="solid"
            data-testid="product-discount"
            >-{{ product.discountPct }}%</UBadge
          >
        </template>
      </DsCluster>

      <DsText
        v-if="product.description"
        variant="body"
        tone="toned"
        wrap="anywhere"
        class="whitespace-pre-line"
        data-testid="product-description"
      >
        {{ product.description }}
      </DsText>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-label">
        <span class="inline-flex items-center gap-1 text-muted" data-testid="product-views">
          <UIcon name="i-ph-eye-duotone" class="size-4" aria-hidden="true" />{{ product.views }}
          {{ DETAIL_COPY.views }}
        </span>
        <span
          class="inline-flex items-center gap-1"
          :class="inStock ? 'text-success' : 'text-error'"
          data-testid="product-stock"
        >
          <UIcon
            name="i-ph-package-duotone"
            class="size-4"
            aria-hidden="true"
            data-testid="product-stock-icon"
          />{{ inStock ? DETAIL_COPY.inStock : DETAIL_COPY.outOfStock }}
        </span>
      </div>

      <div class="flex flex-col gap-1 bg-muted p-3" data-testid="product-shipping">
        <p
          class="flex items-center gap-2 text-label break-words"
          data-testid="product-shipping-line"
        >
          <UIcon
            name="i-ph-truck-duotone"
            class="size-4 shrink-0 text-primary-t"
            aria-hidden="true"
            data-testid="product-shipping-icon"
          />{{ product.shippingLine }}
        </p>
        <p
          v-if="product.location !== ''"
          class="flex items-center gap-2 text-label break-words"
          data-testid="product-location"
        >
          <UIcon name="i-ph-map-pin-duotone" class="size-4 shrink-0" aria-hidden="true" />{{
            product.location
          }}
        </p>
      </div>

      <UButton
        :href="whatsappHref"
        target="_blank"
        size="xl"
        block
        color="success"
        icon="i-ph-whatsapp-logo-duotone"
        class="min-h-14"
        data-testid="product-whatsapp"
      >
        {{ DETAIL_COPY.whatsapp }}
      </UButton>
    </DsStack>
  </UCard>
</template>
