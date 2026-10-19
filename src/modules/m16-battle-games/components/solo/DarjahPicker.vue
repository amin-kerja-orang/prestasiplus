<script setup lang="ts">
/**
 * The darjah picker overlay shared by S13-S16 and S19 (URS FN-M16-6.1.1; DV-M16-18/19): a full-screen
 * layer with the game art and title, the group "🏫 Sekolah Rendah" with "Darjah 1" to "Darjah 4"
 * (`?darjah=n`) and "← Kembali ke Hub". Nothing runs under it: the host starts its game only once
 * `?darjah` is set. The art is a DS 3D image.
 */
import { useRoute } from 'vue-router'

import { DsArt3D, DsCluster, DsText } from '@/ds'
import type { Art3DName } from '@/ds'

import { PICKER_DARJAH } from './solo-lib'

withDefaults(defineProps<{ title: string; art?: Art3DName }>(), { art: 'rocket' })

const route = useRoute()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-200 flex items-center justify-center overflow-y-auto bg-default p-4"
      data-testid="darjah-picker"
    >
      <div class="flex w-full max-w-lg flex-col items-center gap-4 py-6 text-center">
        <DsArt3D :name="art" size="hero" float />
        <h2 class="font-display text-title font-extrabold text-highlighted">{{ title }}</h2>
        <DsText variant="body" tone="muted">Pilih darjah / tingkatan kamu:</DsText>
        <DsText variant="overline" as="p" tone="toned">🏫 Sekolah Rendah</DsText>
        <DsCluster gap="xs" align="stretch" justify="center">
          <UButton
            v-for="n in PICKER_DARJAH"
            :key="n"
            :to="{ path: route.path, query: { darjah: String(n) } }"
            size="xl"
            color="primary"
            variant="soft"
            class="min-h-12 rounded-2xl px-6 font-bold"
            >Darjah {{ n }}</UButton
          >
        </DsCluster>
        <UButton to="/permainan" color="neutral" variant="ghost" size="lg" class="min-h-11">
          ← Kembali ke Hub
        </UButton>
      </div>
    </div>
  </Teleport>
</template>
