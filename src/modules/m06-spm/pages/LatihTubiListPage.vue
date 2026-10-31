<script setup lang="ts">
/**
 * S3 `/spm/latih-tubi` "Latih Tubi SPM" (M06-T2; FR-M06-22…24, BR-M06-03/04/06, DV-M06-03),
 * restyled for v2.
 *
 * "Subjek Teras ({n})" and "Subjek Elektif ({n})" cards linking to S4, each with the pool count and a
 * target chip. A subject whose count is below its target is the locked card (live: Bahasa Arab):
 * warning tone, `href="javascript:void(0)"` and `pointer-events-none`; S4 stays reachable by URL.
 */
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { DsBackLink, DsIconChip, DsPage, type DsAccent, DsLoadError } from '@/ds'
import { formatCount } from '@/lib/number'
import { subjectGlyph } from '@/modules/m05-practice'

import { fetchLatihTubiList, type LatihTubiCard } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { targetName } from '../lib/latih-tubi'
import { LOAD_ERROR } from '../lib/copy'

const { data, error, reload } = useApi((signal) => fetchLatihTubiList({ signal }))

const targetText = (c: LatihTubiCard): string | null =>
  c.targetType !== null && c.targetSize !== null
    ? `Target ${targetName(c.targetType)}: ${String(c.targetSize)}`
    : null

/** V2 lists only subjects with a question count above 0 (cloud-student-mechanism section 2.1); a non-zero locked subject stays. */
const listed = (c: LatihTubiCard): boolean => c.total > 0

const groups = (d: { teras: LatihTubiCard[]; elektif: LatihTubiCard[] }) => [
  {
    id: 'teras',
    title: 'Subjek Teras',
    icon: 'i-ph-crown-duotone',
    accent: 'win' as DsAccent,
    cards: d.teras.filter(listed),
  },
  {
    id: 'elektif',
    title: 'Subjek Elektif',
    icon: 'i-ph-puzzle-piece-duotone',
    accent: 'friend' as DsAccent,
    cards: d.elektif.filter(listed),
  },
]
</script>

<template>
  <DsPage
    title="Latih Tubi SPM"
    subtitle="Pilih subjek untuk mula berlatih (Tingkatan 4 &amp; 5)"
    :show-title="true"
    title-testid="spm-heading"
    subtitle-testid="spm-sub"
    data-testid="spm-latih-tubi-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>

    <template v-if="data">
      <section
        v-for="g in groups(data)"
        :key="g.id"
        class="flex flex-col gap-3"
        :data-testid="`latih-tubi-section-${g.id}`"
      >
        <h2 class="flex items-center gap-2 text-heading text-highlighted" data-testid="section-heading">
          <DsIconChip :icon="g.icon" :accent="g.accent" size="sm" />
          {{ g.title }} ({{ g.cards.length }})
        </h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          <component
            :is="c.locked ? 'a' : RouterLink"
            v-for="c in g.cards"
            :key="c.code"
            v-bind="c.locked ? { href: 'javascript:void(0)' } : { to: `/spm/latih-tubi/${c.code}` }"
            :class="c.locked ? 'block min-w-0 pointer-events-none' : 'block min-w-0'"
            :data-testid="`latih-tubi-card-${c.code}`"
            :data-locked="c.locked ? 'true' : 'false'"
          >
            <UCard class="h-full" :ui="{ body: 'flex items-center gap-3 p-4' }">
              <DsIconChip
                :icon="subjectGlyph(c.icon)"
                :accent="c.locked ? 'trial' : g.accent"
                size="lg"
                data-testid="latih-tubi-icon"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <div class="min-w-0">
                  <h3
                    class="text-subheading break-words text-highlighted"
                    data-testid="latih-tubi-name"
                  >
                    {{ c.name }}
                  </h3>
                  <p class="text-caption text-muted" data-testid="latih-tubi-name-en">
                    {{ c.nameEn }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    color="primary"
                    variant="soft"
                    icon="i-ph-barbell-bold"
                    data-testid="latih-tubi-count"
                    >{{ formatCount(c.total) }} soalan</UBadge
                  >
                  <UBadge
                    v-if="targetText(c)"
                    color="success"
                    variant="soft"
                    icon="i-ph-target-bold"
                    data-testid="latih-tubi-target"
                    >{{ targetText(c) }}</UBadge
                  >
                  <UBadge
                    v-if="c.locked"
                    color="warning"
                    variant="soft"
                    icon="i-ph-lock-bold"
                    data-testid="latih-tubi-locked"
                    >Locked: {{ c.total }}/{{ c.targetSize }}</UBadge
                  >
                </div>
              </div>
              <UIcon
                :name="c.locked ? 'i-ph-lock-bold' : 'i-ph-caret-right-bold'"
                class="size-5 shrink-0 text-muted"
                aria-hidden="true"
              />
            </UCard>
          </component>
        </div>
      </section>
    </template>
    <DsLoadError v-else-if="error" :message="LOAD_ERROR" testid="spm-error" retry-testid="spm-retry" @retry="reload()" />
    <SkeletonCards v-else />
  </DsPage>
</template>
