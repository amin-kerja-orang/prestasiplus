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
import LoadState from '../components/solo/LoadState.vue'
import { jutawanHeading, parseDarjah } from '../components/solo/solo-lib'

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
      <div class="flex flex-col items-start gap-1">
        <UButton to="/permainan" color="neutral" variant="ghost" icon="i-ph-arrow-left" class="min-h-11">
          Permainan
        </UButton>
        <h1 class="text-title text-highlighted">💰 Jutawan Ilmu</h1>
        <p class="text-body text-muted">
          Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!
        </p>
      </div>

      <LoadState :loading="loading" :error="error" />

      <template v-if="page">
        <div class="grid grid-cols-3 gap-3 text-center" data-testid="jutawan-stats">
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <p class="tabular text-heading text-warning" data-testid="jutawan-best">
              L{{ page.bestLevel }}
            </p>
            <p class="text-caption text-muted">Rekod Tertinggi</p>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <p class="tabular text-heading text-info" data-testid="jutawan-games">
              {{ page.games }}
            </p>
            <p class="text-caption text-muted">Permainan</p>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }">
            <p class="tabular text-heading text-success">1,000🪙</p>
            <p class="text-caption text-muted">Hadiah Utama</p>
          </UCard>
        </div>

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
