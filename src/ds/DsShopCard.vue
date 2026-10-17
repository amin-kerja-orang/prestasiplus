<script setup lang="ts">
/**
 * Catalogue card (shop, rewards, marketplace): image or 3D art, name, price as a reward chip, a
 * stock chip and the primary action. When the action is unavailable `disabledReason` is shown as
 * a chip next to the disabled button, so the reason is never colour-only.
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsRewardChip from './DsRewardChip.vue'

withDefaults(
  defineProps<{
    name: string
    price: string | number
    /** Price icon base name (see `DsIcon`) when `priceArt` is not set. */
    priceIcon?: string
    priceArt?: Art3DName
    /** 3D art for the item. */
    art?: Art3DName
    /** Plain image for the item (used when `art` is not set). */
    imageSrc?: string
    imageAlt?: string
    /** Stock text, e.g. "Baki 3". */
    stock?: string
    actionLabel: string
    /** Reason the action is unavailable (BM); disables the button. */
    disabledReason?: string
  }>(),
  {
    priceIcon: 'coins',
    priceArt: 'coin',
    art: undefined,
    imageSrc: undefined,
    imageAlt: '',
    stock: undefined,
    disabledReason: undefined,
  },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <UCard class="h-full" data-ds="shop-card">
    <div class="flex h-full flex-col gap-3">
      <div class="grid place-items-center">
        <DsArt3D v-if="art" :name="art" size="lg" />
        <DsArt3D v-else-if="imageSrc" variant="plain" :src="imageSrc" :alt="imageAlt" ratio="square" />
      </div>
      <h3 class="line-clamp-2 text-label text-highlighted">{{ name }}</h3>
      <div class="flex flex-wrap items-center gap-2">
        <DsRewardChip :value="price" :art="priceArt" :icon="priceIcon" />
        <UBadge v-if="stock" color="neutral" variant="soft" :label="stock" />
      </div>
      <div class="mt-auto flex flex-col gap-2">
        <UBadge
          v-if="disabledReason"
          color="warning"
          variant="soft"
          icon="i-ph-info"
          :label="disabledReason"
          class="self-start"
          data-ds="shop-reason"
        />
        <UButton
          block
          :label="actionLabel"
          :disabled="!!disabledReason"
          class="min-h-11"
          @click="$emit('action')"
        />
      </div>
    </div>
  </UCard>
</template>
