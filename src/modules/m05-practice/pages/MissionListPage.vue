<script setup lang="ts">
/**
 * S14 `/misi-harian` "Misi Harian — PrestasiPlus" (M05-T7; FR-M05-116, FR-M05-142).
 * Empty: the observed card `fa-inbox` "Tiada misi hari ini". Otherwise one card per mission
 * (PROPOSED layout, §8.3; LS-12): title, type chip, subject, "{n} soalan", "{c} syiling per jawapan
 * betul", the resource link (new tab; http(s) / internal only) and note, "Mula Misi" → Q5 or "Selesai ✓".
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsEmptyState,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatusBadge,
  type DsAccent,
} from '@/ds'

import { fetchTodayMissions } from '../api/practice'
import { missionDone, safeResourceUrl } from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const ACCENTS: readonly DsAccent[] = ['action', 'win', 'heat', 'friend', 'trial']

const { data, error, reload } = useApi((signal) => fetchTodayMissions({ signal }))
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <DsPage title="Misi Harian" data-testid="missions-page">
    <template v-if="data">
      <DsPanel v-if="items.length === 0" data-testid="missions-empty">
        <DsEmptyState
          title="Tiada misi hari ini"
          description="Misi baru akan muncul bila guru anda assign."
          icon="tray"
        />
      </DsPanel>

      <ul v-else class="flex flex-col gap-3" data-testid="missions-list">
        <li v-for="(m, i) in items" :key="m.id" class="min-w-0">
          <DsPanel class="flex flex-col gap-2" :data-testid="`mission-card-${String(m.id)}`">
            <div class="flex flex-wrap items-center gap-3">
              <DsIconChip icon="target" :accent="ACCENTS[i % ACCENTS.length]" />
              <h2
                class="min-w-0 text-subheading break-words text-highlighted"
                data-testid="mission-title"
              >
                {{ m.title }}
              </h2>
              <UBadge
                v-if="m.typeLabel"
                color="neutral"
                variant="subtle"
                data-testid="mission-type"
                >{{ m.typeLabel }}</UBadge
              >
            </div>
            <p class="text-body text-muted" data-testid="mission-info">
              <span v-if="m.subjectName">{{ m.subjectName }} · </span>{{ m.questionCount }} soalan ·
              {{ m.coinsPerCorrect }} syiling per jawapan betul
            </p>
            <p
              v-if="m.resourceUrl || m.resourceTitle"
              class="text-body"
              data-testid="mission-resource"
            >
              <ULink
                v-if="safeResourceUrl(m.resourceUrl)"
                :href="safeResourceUrl(m.resourceUrl) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center break-all text-primary-t"
                data-testid="mission-link"
                >{{ m.resourceTitle || m.resourceUrl }}</ULink
              >
              <span v-else class="text-muted">{{ m.resourceTitle }}</span>
            </p>
            <p
              v-if="m.resourceNote"
              class="text-caption break-words text-muted"
              data-testid="mission-note"
            >
              {{ m.resourceNote }}
            </p>
            <div>
              <DsStatusBadge
                v-if="missionDone(m)"
                status="done"
                label="Selesai ✓"
                data-testid="mission-done"
              />
              <UButton
                v-else
                :to="`/misi-harian/${String(m.id)}`"
                size="lg"
                class="min-h-11"
                data-testid="mission-start"
                >Mula Misi</UButton
              >
            </div>
          </DsPanel>
        </li>
      </ul>
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      testid="missions-error"
      retry-testid="missions-retry"
      @retry="reload()"
    />
  </DsPage>
</template>
