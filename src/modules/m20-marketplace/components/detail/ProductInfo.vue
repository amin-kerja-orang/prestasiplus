<script setup lang="ts">
/**
 * S7 details card (FN-M20-4.2.3, 4.2.4; FR-M20-56, FR-M20-57): condition and category badges, H1 name,
 * price with the struck original and "-{p}%" (both hidden without an original price), description,
 * "{n} tontonan" (the post-increment `views` of #15) and the stock text, the shipping box and the
 * green WhatsApp button. The button is a plain link to W that opens a new tab (`target="_blank"`,
 * no `rel`, as live, D10); the new tab runs the hand-off (D14).
 */
import { Eye, MapPin, Package, Truck } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { ProductDetail } from '../../api'
import { categoryIcon } from '../product/category-icons'
import { formatPrice } from '../product/copy'
import { DETAIL_COPY } from './copy'
import WhatsAppIcon from './WhatsAppIcon.vue'

const props = defineProps<{ product: ProductDetail }>()
const router = useRouter()

const whatsappHref = computed(
  () => router.resolve(`/marketplace/${encodeURIComponent(props.product.slug)}/whatsapp`).href,
)
const inStock = computed(() => props.product.stockStatus === 'available')
const CategoryIcon = computed(() => categoryIcon(props.product.category.slug))
</script>

<template>
  <section
    class="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-md sm:p-5"
    data-testid="product-info"
  >
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        :class="
          product.condition === 'used'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-green-100 text-green-700'
        "
        data-testid="product-condition"
        >{{ product.condition === 'used' ? DETAIL_COPY.used : DETAIL_COPY.new }}</span
      >
      <span
        class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
        data-testid="product-category"
      >
        <component :is="CategoryIcon" class="h-3.5 w-3.5" aria-hidden="true" />
        {{ product.category.name }}
      </span>
    </div>

    <h1
      class="text-2xl leading-tight font-bold break-words text-slate-800"
      data-testid="product-name"
    >
      {{ product.name }}
    </h1>

    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-2xl font-bold text-indigo-600" data-testid="product-price">{{
        formatPrice(product.price)
      }}</span>
      <template v-if="product.originalPrice !== null">
        <span class="text-base text-slate-400 line-through" data-testid="product-original">{{
          formatPrice(product.originalPrice)
        }}</span>
        <span
          v-if="product.discountPct !== null"
          class="rounded-lg bg-red-500 px-2 py-0.5 text-xs font-bold text-white"
          data-testid="product-discount"
          >-{{ product.discountPct }}%</span
        >
      </template>
    </div>

    <p
      v-if="product.description"
      class="text-sm leading-relaxed break-words whitespace-pre-line text-slate-600"
      data-testid="product-description"
    >
      {{ product.description }}
    </p>

    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span class="inline-flex items-center gap-1.5 text-slate-500" data-testid="product-views">
        <Eye class="h-4 w-4" aria-hidden="true" />{{ product.views }} {{ DETAIL_COPY.views }}
      </span>
      <span
        class="inline-flex items-center gap-1.5 font-semibold"
        :class="inStock ? 'text-green-600' : 'text-red-600'"
        data-testid="product-stock"
      >
        <Package
          class="h-4 w-4 text-slate-500"
          aria-hidden="true"
          data-testid="product-stock-icon"
        />{{ inStock ? DETAIL_COPY.inStock : DETAIL_COPY.outOfStock }}
      </span>
    </div>

    <div
      class="space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
      data-testid="product-shipping"
    >
      <p
        class="flex items-center gap-1.5 font-medium break-words"
        data-testid="product-shipping-line"
      >
        <Truck
          class="h-4 w-4 shrink-0 text-indigo-500"
          aria-hidden="true"
          data-testid="product-shipping-icon"
        />{{ product.shippingLine }}
      </p>
      <p
        v-if="product.location !== ''"
        class="flex items-center gap-1.5 break-words"
        data-testid="product-location"
      >
        <MapPin class="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />{{ product.location }}
      </p>
    </div>

    <a
      :href="whatsappHref"
      target="_blank"
      class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 text-base font-semibold text-white hover:bg-green-600"
      data-testid="product-whatsapp"
    >
      <WhatsAppIcon class="h-5 w-5" />
      {{ DETAIL_COPY.whatsapp }}
    </a>
  </section>
</template>
