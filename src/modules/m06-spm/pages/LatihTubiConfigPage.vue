<script setup lang="ts">
/**
 * S4 `/spm/latih-tubi/:code` "Tetapan Kuiz" (restyled for v2) (M06-T2; FR-M06-25…31, BR-M06-03/04/07, DV-M06-01/03/08).
 *
 * Tingkatan (10 / 11, click again clears), "Tahap Kesukaran" (keys 2–5 as live; 2 per row below 640px,
 * DV-M06-08), "Bilangan Soalan" (the target option, or 5–60) and "Mula Kuiz", a link whose href follows
 * every change. An unknown code (404) is the global 404 page. BA stays reachable although S3 locks it.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { DsBackLink, DsIconChip, DsLoadError, DsCluster, DsStack, DsHeading, DsText } from '@/ds'
import { formatCount } from '@/lib/number'
import { subjectGlyph } from '@/modules/m05-practice'

import { fetchLatihTubiConfig } from '../api'
import {
  DIFFICULTY_OPTIONS,
  LEVEL_OPTIONS,
  diffCount,
  quizHref,
  targetName,
  type DifficultyKey,
  type LevelKey,
} from '../lib/latih-tubi'
import { LOAD_ERROR } from '../lib/copy'

const route = useRoute()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const {
  data: config,
  error,
  reload,
} = useApi((signal) => fetchLatihTubiConfig(code.value, { signal }), code)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// DV-M06-07: tab title and header "Latih Tubi SPM — {Subjek}", no subtitle.
watch(
  config,
  (c) => {
    if (!c) return
    pageMeta.setTitle(`Latih Tubi SPM — ${c.name}`)
    pageMeta.setHeader({ title: `Latih Tubi SPM — ${c.name}` })
  },
  { immediate: true },
)

const selectedLevel = ref<LevelKey | null>(null)
const selectedDifficulty = ref<DifficultyKey | null>(null)
const questionCount = ref(10)

// A new subject starts from its defaults.
watch(
  config,
  (c) => {
    selectedLevel.value = null
    selectedDifficulty.value = null
    questionCount.value = c?.defaultCount ?? 10
  },
  { immediate: true },
)

const toggleLevel = (k: LevelKey) => {
  selectedLevel.value = selectedLevel.value === k ? null : k
}
const toggleDifficulty = (k: DifficultyKey) => {
  selectedDifficulty.value = selectedDifficulty.value === k ? null : k
}

const href = computed(() =>
  config.value
    ? quizHref(
        config.value.code,
        questionCount.value,
        selectedLevel.value,
        selectedDifficulty.value,
      )
    : '#',
)

const hasTarget = computed(
  () => config.value?.targetType != null && config.value.targetSize != null,
)
const typeName = computed(() =>
  config.value?.targetType ? targetName(config.value.targetType) : '',
)

/** A choice is a solid button when picked, a tonal one otherwise. */
const pick = (
  on: boolean,
  color: 'primary' | 'success' | 'info' | 'warning' | 'error' = 'primary',
) => ({ color: on ? color : 'neutral', variant: on ? 'solid' : 'soft' }) as const
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="spm-config-page">
    <template v-if="config">
      <DsBackLink to="/spm/latih-tubi" label="Kembali" data-testid="spm-back" />

      <UCard data-testid="config-hero">
        <DsCluster gap="md" :wrap="false">
          <DsIconChip :icon="subjectGlyph(config.icon)" size="lg" data-testid="config-icon" />
          <DsStack gap="2xs">
            <DsHeading :level="1" wrap="anywhere" data-testid="config-title">
              {{ config.name }}
            </DsHeading>
            <DsText variant="body" tone="muted" data-testid="config-sub">
              {{ formatCount(config.total) }} soalan tersedia<template v-if="hasTarget">
                · Target {{ typeName }} set: {{ config.targetSize }} soalan</template
              >
            </DsText>
          </DsStack>
        </DsCluster>
      </UCard>

      <UCard data-testid="config-card">
        <DsStack gap="lg">
          <h2 class="flex items-center gap-2 text-heading text-highlighted">
            <UIcon name="i-ph-gear-six-duotone" class="size-6 text-primary-t" aria-hidden="true" />
            Tetapan Kuiz
          </h2>

          <!-- Tingkatan -->
          <DsStack gap="sm">
            <DsHeading :level="3">Tingkatan</DsHeading>
            <div class="grid grid-cols-2 gap-2 md:gap-3" data-testid="config-levels">
              <UButton
                v-for="l in LEVEL_OPTIONS"
                :key="l.key"
                v-bind="pick(selectedLevel === l.key)"
                class="h-auto min-h-14 flex-col justify-center gap-0 py-2"
                :aria-pressed="selectedLevel === l.key"
                :data-testid="`level-${String(l.key)}`"
                @click="toggleLevel(l.key)"
              >
                <span class="text-label">{{ l.label }}</span>
                <span class="text-caption" data-testid="level-count">
                  {{ formatCount(config.levelCounts[String(l.key) as '10' | '11']) }} soalan
                </span>
              </UButton>
            </div>
          </DsStack>

          <!-- Tahap Kesukaran -->
          <DsStack gap="sm">
            <DsHeading :level="3">Tahap Kesukaran</DsHeading>
            <div
              class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3"
              data-testid="config-difficulties"
            >
              <UButton
                v-for="d in DIFFICULTY_OPTIONS"
                :key="d.key"
                v-bind="pick(selectedDifficulty === d.key, d.color)"
                class="h-auto min-h-14 min-w-0 flex-col justify-center gap-0 py-2 break-words"
                :aria-pressed="selectedDifficulty === d.key"
                :data-testid="`difficulty-${String(d.key)}`"
                @click="toggleDifficulty(d.key)"
              >
                <span class="text-label">{{ d.label }}</span>
                <span class="text-caption" data-testid="difficulty-count">
                  {{ diffCount(config, selectedLevel, d.key) }} soalan
                </span>
              </UButton>
            </div>
            <DsText variant="caption">Biarkan kosong untuk campuran semua tahap</DsText>
          </DsStack>

          <!-- Bilangan Soalan -->
          <DsStack gap="sm">
            <DsHeading :level="3">Bilangan Soalan</DsHeading>
            <DsCluster gap="xs" align="stretch" data-testid="config-counts">
              <UButton
                v-for="o in config.countOptions"
                :key="o.value"
                :color="questionCount === o.value ? 'primary' : o.isTarget ? 'success' : 'neutral'"
                :variant="questionCount === o.value ? 'solid' : 'soft'"
                class="min-h-11"
                :aria-pressed="questionCount === o.value"
                :data-testid="`count-${String(o.value)}`"
                @click="questionCount = o.value"
                >{{ o.label }}</UButton
              >
            </DsCluster>
            <DsText v-if="hasTarget" variant="caption" data-testid="config-helper">
              Set penuh target {{ config.targetType }} untuk {{ config.name }} disasar pada
              {{ config.targetSize }} soalan.
            </DsText>
            <DsText v-else variant="caption" data-testid="config-helper">
              Pilih bilangan soalan ikut keperluan latihan anda.
            </DsText>
          </DsStack>

          <UButton
            :to="href"
            size="lg"
            block
            class="min-h-14"
            icon="i-ph-play-circle-bold"
            data-testid="config-start"
            >Mula Kuiz</UButton
          >
        </DsStack>
      </UCard>
    </template>
    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      testid="spm-error"
      retry-testid="spm-retry"
      @retry="reload()"
    />
    <DsStack v-else-if="!error" gap="sm" aria-busy="true" data-testid="spm-skeleton">
      <USkeleton class="h-20" />
      <USkeleton class="h-96" />
    </DsStack>
  </div>
</template>
