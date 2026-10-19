<script setup lang="ts">
/**
 * The Roda Nasib prize modal (S18, URS FN-M16-7.1.3): the prize icon, label, and for a credited syiling
 * prize "+n Syiling" and "Ditambah ke akaun kamu!" (DV-M16-23); "Jangan risau, cuba lagi esok!" for
 * a miss. A click on the scrim or "Tutup" closes it.
 */
import { DsArt3D, DsText } from '@/ds'

defineProps<{ icon: string; label: string; type: string; credited: number }>()

defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-200 flex items-center justify-center bg-inverted/60 p-4"
      data-testid="prize-overlay"
      @click.self="$emit('close')"
    >
      <section
        class="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-default p-6 text-center shadow-modal motion-safe:animate-ds-rise"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
      >
        <DsArt3D :name="type === 'syiling' ? 'coin' : 'party'" size="hero" float />
        <div class="text-title" aria-hidden="true" data-testid="prize-icon">{{ icon }}</div>
        <h3
          class="font-display text-title font-extrabold text-highlighted"
          data-testid="prize-label"
        >
          {{ label }}
        </h3>
        <template v-if="type === 'syiling' && credited > 0">
          <p
            class="tabular font-display text-display font-extrabold text-highlighted"
            data-testid="prize-amount"
          >
            +{{ credited }} Syiling
          </p>
          <DsText variant="body" tone="muted">Ditambah ke akaun kamu!</DsText>
        </template>
        <DsText v-else-if="type === 'nothing'" variant="body" tone="muted">
          Jangan risau, cuba lagi esok!
        </DsText>
        <UButton
          type="button"
          size="xl"
          color="primary"
          variant="solid"
          class="mt-2 min-h-12 w-full justify-center"
          data-testid="prize-close"
          @click="$emit('close')"
        >
          Tutup
        </UButton>
      </section>
    </div>
  </Teleport>
</template>
