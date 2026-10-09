<script setup lang="ts">
/**
 * S19 `/permainan/jutawan` Jutawan Ilmu (FR-M16-96, 97; URS FT-M16-7.2; BR-M16-30). Without `?darjah`
 * the picker overlay covers the page (amber hover) and the hint "👆 Pilih darjah…" shows behind it; with
 * `?darjah=n` the subjects and question counts of M04 Q-JUT-COUNT are listed.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

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
    <DarjahPicker
      v-if="darjah === null"
      emoji="💰"
      title="Jutawan Ilmu"
      color="var(--color-amber-500)"
    />
    <GamePanel theme="navy">
      <div class="mx-auto max-w-2xl space-y-5">
        <div class="text-center">
          <RouterLink
            to="/permainan"
            class="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            <ArrowLeft :size="16" /> Permainan
          </RouterLink>
          <!-- Live paints this heading navy on the navy panel (≈ 1.2:1); DV-M16-46 paints it white. -->
          <h2 class="font-heading text-2xl font-extrabold text-white">💰 Jutawan Ilmu</h2>
          <p class="mt-1 text-sm text-amber-200">
            Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!
          </p>
        </div>

        <LoadState :loading="loading" :error="error" />

        <template v-if="page">
          <div class="grid grid-cols-3 gap-3 text-center" data-testid="jutawan-stats">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div class="text-xl font-extrabold text-amber-300" data-testid="jutawan-best">
                L{{ page.bestLevel }}
              </div>
              <div class="text-xs text-slate-300">Rekod Tertinggi</div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div class="text-xl font-extrabold text-cyan-300" data-testid="jutawan-games">
                {{ page.games }}
              </div>
              <div class="text-xs text-slate-300">Permainan</div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div class="text-xl font-extrabold text-emerald-300">1,000🪙</div>
              <div class="text-xs text-slate-300">Hadiah Utama</div>
            </div>
          </div>

          <JutawanSubjectList
            v-if="darjah !== null && page.subjects"
            :heading="page.heading ?? jutawanHeading(darjah)"
            :subjects="page.subjects"
            :darjah="darjah"
          />
          <div
            v-else
            class="rounded-2xl border border-white/10 bg-white/5 p-8 text-center"
            data-testid="jutawan-hint"
          >
            <div class="text-4xl">👆</div>
            <p class="mt-2 text-sm text-slate-300">
              Pilih darjah atau tingkatan di atas untuk mula.
            </p>
          </div>
        </template>
      </div>
    </GamePanel>
  </div>
</template>
