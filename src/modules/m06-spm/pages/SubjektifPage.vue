<script setup lang="ts">
/**
 * S8 `/spm/subjektif` "Latihan Subjektif SPM" (M06-T3; FR-M06-54…57, 61, BR-M06-12/18, DV-M06-09).
 *
 * Info box, four stat cards of the caller's SPM subjective attempts, tabs Semua / Teras / Elektif that
 * switch the card grid client-side, and one card per subject → S9 (the M05 structured list with
 * `scope=spm`). The active tab is a solid primary button (DV-M06-09: live is unreadable). Restyled for v2.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsBackLink,
  DsIconChip,
  DsPage,
  DsStatTile,
  type DsAccent,
  DsLoadError,
  DsStack,
  DsCluster,
  DsHeading,
  DsText,
} from '@/ds'
import { formatCount } from '@/lib/number'
import { subjectGlyph } from '@/modules/m05-practice'

import { fetchSubjektif } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { bestScoreLabel, subjektifHref, tabSubjects, type SubjektifTab } from '../lib/tracking'
import { LOAD_ERROR } from '../lib/copy'

const { data, error, reload } = useApi((signal) => fetchSubjektif({ signal }))

const tab = ref<SubjektifTab>('all')
const visible = computed(() => (data.value ? tabSubjects(data.value.subjects, tab.value) : []))

const counts = computed(() => {
  const subjects = data.value?.subjects ?? []
  return {
    all: subjects.length,
    teras: subjects.filter((s) => s.group === 'teras').length,
    elektif: subjects.filter((s) => s.group === 'elektif').length,
  }
})

const TABS: { id: SubjektifTab; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'teras', label: 'Teras' },
  { id: 'elektif', label: 'Elektif' },
]

const stats = computed<
  { id: string; label: string; value: string; cap: string; icon: string; accent: DsAccent }[]
>(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    {
      id: 'answered',
      icon: 'i-ph-notepad-duotone',
      accent: 'action',
      label: 'Set Dijawab',
      value: formatCount(s.setsAnswered),
      cap: 'Percubaan subjektif SPM yang telah dihantar',
    },
    {
      id: 'subjects',
      icon: 'i-ph-books-duotone',
      accent: 'friend',
      label: 'Subjek Dicuba',
      value: formatCount(s.subjectsTried),
      cap: 'Bilangan subjek subjektif SPM yang pernah dicuba',
    },
    {
      id: 'best',
      icon: 'i-ph-trophy-duotone',
      accent: 'win',
      label: 'Skor Terbaik',
      value: bestScoreLabel(s.bestScore),
      cap: 'Skor tertinggi merentas semua set subjektif SPM',
    },
    {
      id: 'saved',
      icon: 'i-ph-bookmark-simple-duotone',
      accent: 'heat',
      label: 'Set Terbaik Disimpan',
      value: formatCount(s.bestSetsSaved),
      cap: 'Bilangan set yang mempunyai percubaan terbaik tersimpan',
    },
  ]
})
</script>

<template>
  <DsPage
    title="Latihan Subjektif SPM"
    subtitle="Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5."
    :show-title="true"
    title-testid="spm-heading"
    subtitle-testid="spm-sub"
    data-testid="subjektif-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>

    <UAlert color="info" variant="soft" icon="i-ph-info-duotone" data-testid="subjektif-info">
      <template #description>
        <strong>Bagaimana ia berfungsi?</strong>
        Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan. Bank ini
        ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan.
      </template>
    </UAlert>

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="subjektif-stats">
        <DsStack v-for="s in stats" :key="s.id" gap="2xs" :data-testid="`subjektif-stat-${s.id}`">
          <DsStatTile :value="s.value" :unit="s.label" :icon="s.icon" :accent="s.accent" />
          <p class="px-1 text-caption text-muted" data-testid="stat-caption">{{ s.cap }}</p>
        </DsStack>
      </div>

      <DsCluster gap="xs" align="stretch" data-testid="subjektif-tabs">
        <UButton
          v-for="t in TABS"
          :key="t.id"
          :color="tab === t.id ? 'primary' : 'neutral'"
          :variant="tab === t.id ? 'solid' : 'soft'"
          class="min-h-11"
          :aria-pressed="tab === t.id"
          :data-testid="`tab-${t.id}`"
          :data-active="tab === t.id ? 'true' : 'false'"
          @click="tab = t.id"
        >
          {{ t.label }}
          <UBadge
            :color="tab === t.id ? 'neutral' : 'primary'"
            :variant="tab === t.id ? 'solid' : 'soft'"
            size="sm"
            data-testid="tab-count"
            >{{ counts[t.id] }}</UBadge
          >
        </UButton>
      </DsCluster>

      <ul
        class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
        data-testid="subjektif-grid"
      >
        <li v-for="s in visible" :key="s.subjectId" class="min-w-0">
          <RouterLink
            :to="subjektifHref(s.subjectId)"
            class="block h-full"
            :data-testid="`subjektif-card-${s.subjectId}`"
          >
            <UCard class="h-full" :ui="{ body: 'flex items-center gap-3 p-4' }">
              <DsIconChip
                :icon="subjectGlyph(s.icon)"
                :accent="s.group === 'teras' ? 'action' : 'heat'"
                size="lg"
                data-testid="subjektif-icon"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <div class="min-w-0">
                  <DsCluster gap="xs">
                    <DsHeading :level="3" wrap="anywhere" data-testid="subjektif-name">
                      {{ s.name }}
                    </DsHeading>
                    <UBadge
                      :color="s.group === 'teras' ? 'primary' : 'warning'"
                      variant="soft"
                      data-testid="subjektif-badge"
                      >{{ s.group === 'teras' ? 'Teras' : 'Elektif' }}</UBadge
                    >
                  </DsCluster>
                  <DsText variant="caption" data-testid="subjektif-name-en">
                    {{ s.nameEn }}
                  </DsText>
                </div>
                <div>
                  <UBadge
                    color="neutral"
                    variant="soft"
                    icon="i-ph-pencil-simple-line-bold"
                    data-testid="subjektif-sets"
                    >{{ formatCount(s.sets) }} set subjektif</UBadge
                  >
                </div>
              </div>
              <UIcon
                name="i-ph-caret-right-bold"
                class="size-5 shrink-0 text-muted"
                aria-hidden="true"
              />
            </UCard>
          </RouterLink>
        </li>
      </ul>
    </template>
    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      testid="spm-error"
      retry-testid="spm-retry"
      @retry="reload()"
    />
    <SkeletonCards v-else />
  </DsPage>
</template>
