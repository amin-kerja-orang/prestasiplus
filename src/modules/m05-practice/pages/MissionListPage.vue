<script setup lang="ts">
/**
 * S14 `/misi-harian` "Misi Harian — PrestasiPlus" (M05-T7; FR-M05-116, FR-M05-142).
 * Empty: the observed card `fa-inbox` "Tiada misi hari ini". Otherwise one card per mission
 * (PROPOSED layout, §8.3; LS-12): title, type chip, subject, "{n} soalan", "{c} syiling per jawapan
 * betul", the resource link (new tab; http(s) / internal only) and note, "Mula Misi" → Q5 or "Selesai ✓".
 */
import { Inbox } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchTodayMissions } from '../api/practice'
import { missionDone, safeResourceUrl } from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchTodayMissions({ signal }))
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8" data-testid="missions-page">
    <div class="mx-auto max-w-3xl">
      <template v-if="data">
        <div
          v-if="items.length === 0"
          class="rounded-2xl bg-white p-8 text-center shadow-sm"
          data-testid="missions-empty"
        >
          <Inbox class="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p class="font-bold text-slate-600">Tiada misi hari ini</p>
          <p class="text-xs text-slate-400">Misi baru akan muncul bila guru anda assign.</p>
        </div>

        <ul v-else class="space-y-3" data-testid="missions-list">
          <li
            v-for="m in items"
            :key="m.id"
            class="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
            :data-testid="`mission-card-${String(m.id)}`"
          >
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <h3
                class="font-heading text-base font-bold break-words text-slate-800"
                data-testid="mission-title"
              >
                {{ m.title }}
              </h3>
              <span
                v-if="m.typeLabel"
                class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                data-testid="mission-type"
                >{{ m.typeLabel }}</span
              >
            </div>
            <p class="text-sm text-slate-600" data-testid="mission-info">
              <span v-if="m.subjectName">{{ m.subjectName }} · </span>{{ m.questionCount }} soalan ·
              {{ m.coinsPerCorrect }} syiling per jawapan betul
            </p>
            <p
              v-if="m.resourceUrl || m.resourceTitle"
              class="mt-2 text-sm"
              data-testid="mission-resource"
            >
              <a
                v-if="safeResourceUrl(m.resourceUrl)"
                :href="safeResourceUrl(m.resourceUrl) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center font-semibold break-all text-indigo-600 underline"
                data-testid="mission-link"
                >{{ m.resourceTitle || m.resourceUrl }}</a
              >
              <span v-else class="text-slate-600">{{ m.resourceTitle }}</span>
            </p>
            <p
              v-if="m.resourceNote"
              class="mt-1 text-xs break-words text-slate-500"
              data-testid="mission-note"
            >
              {{ m.resourceNote }}
            </p>
            <div class="mt-3">
              <span
                v-if="missionDone(m)"
                class="inline-flex min-h-11 items-center rounded-lg bg-green-100 px-5 text-sm font-bold text-green-700"
                data-testid="mission-done"
                >Selesai ✓</span
              >
              <RouterLink
                v-else
                :to="`/misi-harian/${String(m.id)}`"
                class="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
                data-testid="mission-start"
              >
                Mula Misi
              </RouterLink>
            </div>
          </li>
        </ul>
      </template>

      <div v-else-if="error" class="space-y-3" data-testid="missions-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
          data-testid="missions-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>
    </div>
  </div>
</template>
