<script setup lang="ts">
/**
 * S3 `/pksk/level/:level/domains` "Domain PKSK - {L}" (M07-T2; FR-M07-11..13, FN-M07-1.3.*): the three
 * Bahagian sections with one link card per domain (question count, mastery).
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsIconChip, DsLoadError, DsPage } from '@/ds'

import { fetchPkskDomainSections } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import AccentBadge from '../components/AccentBadge.vue'
import MasteryBar from '../components/MasteryBar.vue'
import { SECTION_STYLE } from '../lib/levels'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({
      title: `Domain PKSK - ${level}`,
      subtitle: 'Pilih domain untuk latih tubi',
    })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskDomainSections(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}`"
    back-label="Kembali ke Dashboard"
    data-testid="pksk-domains"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <section
        v-for="s in data"
        :key="s.bahagian"
        :data-testid="`section-${s.bahagian}`"
        class="flex min-w-0 flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <AccentBadge :accent="SECTION_STYLE[s.bahagian].accent" data-testid="section-badge">{{
            s.bahagian
          }}</AccentBadge>
          <div class="min-w-0">
            <h2 class="text-heading text-highlighted">{{ s.name }}</h2>
            <p class="text-label text-muted">{{ s.subtitle }}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <ULink
            v-for="d in s.domains"
            :key="d.code"
            :to="`/pksk/level/${level}/domain/${d.code}`"
            raw
            class="block min-w-0"
            data-testid="domain-card"
            :data-code="d.code"
          >
            <UCard>
              <div class="flex min-w-0 flex-col gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <DsIconChip
                    icon="i-ph-target-duotone"
                    :accent="SECTION_STYLE[s.bahagian].accent"
                    size="lg"
                    data-testid="domain-icon"
                  />
                  <div class="min-w-0 flex-1">
                    <h3 class="text-subheading break-words text-highlighted">
                      {{ d.name }}
                    </h3>
                    <p class="text-caption text-muted">{{ d.code }}</p>
                  </div>
                  <UIcon
                    name="i-ph-caret-right-bold"
                    class="size-5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </div>
                <div class="flex items-center justify-between text-label">
                  <span class="inline-flex items-center gap-2 text-muted">
                    <UIcon name="i-ph-question-duotone" class="size-4" aria-hidden="true" /> Soalan
                  </span>
                  <span class="tabular text-highlighted" data-testid="question-count">{{
                    d.questionCount
                  }}</span>
                </div>
                <div class="flex items-center justify-between text-label">
                  <span class="text-muted">Penguasaan</span>
                  <span class="tabular text-highlighted" data-testid="mastery-pct"
                    >{{ d.masteryPct }}%</span
                  >
                </div>
                <MasteryBar :pct="d.masteryPct" :accent="SECTION_STYLE[s.bahagian].accent" />
              </div>
            </UCard>
          </ULink>
        </div>
      </section>
    </template>
  </DsPage>
</template>
