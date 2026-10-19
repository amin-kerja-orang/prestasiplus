<script setup lang="ts">
/**
 * S19 `/permainan/jutawan` Jutawan Ilmu (FR-M16-96, 97; URS FT-M16-7.2; BR-M16-30). Without `?darjah`
 * the picker overlay covers the page (amber hover) and the hint "👆 Pilih darjah…" shows behind it; with
 * `?darjah=n` the subjects and question counts of M04 Q-JUT-COUNT are listed.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchJutawanPage } from '../api'
import type { JutawanPage } from '../api'
import JutawanSubjectList from '../components/jutawan/JutawanSubjectList.vue'
import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import { jutawanHeading, parseDarjah } from '../components/solo/solo-lib'
import { DsLoadError, DsStack, DsGrid, DsHeading, DsText } from '@/ds'

const route = useRoute()
const darjah = computed(() => parseDarjah(route.query.darjah))

const page = ref<JutawanPage | null>(null)
const loading = ref(true)
const error = ref('')
let seq = 0

async function load(): Promise<void> {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const data = await fetchJutawanPage(darjah.value ?? undefined)
    if (mine === seq) page.value = data
  } catch (e) {
    if (mine === seq) error.value = e instanceof Error ? e.message : 'Ralat memuatkan Jutawan Ilmu.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch(darjah, () => void load(), { immediate: true })
</script>

<template>
  <div data-testid="jutawan-page">
    <DarjahPicker v-if="darjah === null" title="Jutawan Ilmu" art="coin" />
    <GamePanel>
      <DsStack gap="2xs" align="start">
        <UButton
          to="/permainan"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left"
          class="min-h-11"
        >
          Permainan
        </UButton>
        <DsHeading :level="1">💰 Jutawan Ilmu</DsHeading>
        <DsText variant="body" tone="muted">
          Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!
        </DsText>
      </DsStack>

      <DsStack v-if="loading" gap="sm" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </DsStack>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <template v-if="page">
        <DsGrid :cols="3" gap="sm" class="text-center" data-testid="jutawan-stats">
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <DsText variant="heading" tone="warning" tabular data-testid="jutawan-best">
              L{{ page.bestLevel }}
            </DsText>
            <DsText variant="caption">Rekod Tertinggi</DsText>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <DsText variant="heading" tone="info" tabular data-testid="jutawan-games">
              {{ page.games }}
            </DsText>
            <DsText variant="caption">Permainan</DsText>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <DsText variant="heading" tone="success" tabular>1,000🪙</DsText>
            <DsText variant="caption">Hadiah Utama</DsText>
          </UCard>
        </DsGrid>

        <JutawanSubjectList
          v-if="darjah !== null && page.subjects"
          :heading="page.heading ?? jutawanHeading(darjah)"
          :subjects="page.subjects"
          :darjah="darjah"
        />
        <UCard v-else class="text-center" data-testid="jutawan-hint">
          <div class="text-title" aria-hidden="true">👆</div>
          <p class="mt-2 text-body text-muted">Pilih darjah atau tingkatan di atas untuk mula.</p>
        </UCard>
      </template>
    </GamePanel>
  </div>
</template>
