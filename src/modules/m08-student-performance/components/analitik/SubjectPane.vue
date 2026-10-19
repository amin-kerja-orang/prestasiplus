<script setup lang="ts">
/**
 * The pane of the active subject on S7 (FR-M08-49…52): progress ring, 4 KPIs, the encouragement box
 * for an accuracy below 50 (PROPOSED, OQ-M08-08) and "Peta DSKP — Standard Pembelajaran".
 * Text is 12px and up (D-26, D9: the live 11px / 10px text is unreadable).
 */
import { DsPanel, DsScoreRing, DsStack, DsCluster, DsGrid, DsText } from '@/ds'

import type { AnalyticsSubject } from '../../api/types'
import { STATUS_LABEL, TILE_COLOR, TREND_ICON, TREND_TEXT, accuracyText } from '../../lib/analitik'
import { usePhIcon } from '../../lib/icons'

const props = defineProps<{ subject: AnalyticsSubject }>()

const icon = usePhIcon()

const LEGEND = [
  { status: 'mahir', label: 'Mahir (75%+)' },
  { status: 'sederhana', label: 'Sederhana (50-74%)' },
  { status: 'lemah', label: 'Lemah (<50%)' },
  { status: 'belum', label: 'Belum Cuba' },
] as const

const TREND_LABEL = { up: 'Naik', down: 'Turun', stable: 'Tetap' } as const

const dots = () =>
  [
    { id: 'mahir', count: props.subject.counts.mahir },
    { id: 'sederhana', count: props.subject.counts.sederhana },
    { id: 'lemah', count: props.subject.counts.lemah },
    { id: 'belum', count: props.subject.counts.belum },
  ] as const
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" :data-testid="`pane-${subject.subjectId}`">
    <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
      <DsPanel class="min-w-0" data-testid="ring-card">
        <DsStack gap="sm" align="center">
          <DsScoreRing
            :value="subject.counts.mahir"
            :max="subject.ringTotal"
            size="md"
            label="Standard Dikuasai"
            :display="String(subject.counts.mahir)"
            :unit="`/ ${subject.ringTotal} SP`"
            data-testid="ring-arc"
          />
          <DsText variant="label" as="p" tone="highlighted">Standard Dikuasai</DsText>
          <DsCluster as="ul" gap="xs" align="stretch" justify="center" data-testid="ring-legend">
            <li v-for="d in dots()" :key="d.id">
              <UBadge
                :color="TILE_COLOR[d.id]"
                variant="subtle"
                :label="`${STATUS_LABEL[d.id]} ${d.count}`"
              />
            </li>
          </DsCluster>
        </DsStack>
      </DsPanel>

      <DsPanel class="min-w-0 lg:col-span-2">
        <DsStack>
          <DsGrid :cols="{ base: 2, sm: 4 }" as="ul" class="text-center" data-testid="kpis">
            <li class="flex flex-col gap-1">
              <span
                :class="[accuracyText(subject.accuracy), 'tabular text-title']"
                data-testid="kpi-acc"
                >{{ subject.accuracy.toFixed(1) }}%</span
              >
              <DsText variant="caption" as="span">Ketepatan</DsText>
            </li>
            <li class="flex flex-col gap-1">
              <DsText variant="title" as="span" tabular data-testid="kpi-answered">{{
                subject.answered
              }}</DsText>
              <DsText variant="caption" as="span">Soalan Dijawab</DsText>
            </li>
            <li class="flex flex-col items-center gap-1">
              <DsCluster as="span" gap="2xs" :wrap="false" data-testid="kpi-trend">
                <span :class="[TREND_TEXT[subject.trend], 'flex items-center gap-1']">
                  <UIcon :name="icon(TREND_ICON[subject.trend])" class="size-8" />
                  <DsText variant="label">{{ TREND_LABEL[subject.trend] }}</DsText>
                </span>
              </DsCluster>
              <DsText variant="caption" as="span">Trend 30 Hari</DsText>
            </li>
            <li class="flex flex-col gap-1">
              <DsText variant="title" as="span" tone="primary" tabular data-testid="kpi-grade"
                >{{ subject.projection.low }} – {{ subject.projection.high }}</DsText
              >
              <DsText variant="caption" as="span">Unjuran Gred</DsText>
            </li>
          </DsGrid>
          <UAlert
            v-if="subject.accuracy < 50"
            color="error"
            variant="subtle"
            :icon="icon('hand-heart')"
            title="Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling lemah di bawah."
            data-testid="encourage-box"
          />
        </DsStack>
      </DsPanel>
    </div>

    <DsPanel data-testid="dskp-map">
      <DsStack>
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon :name="icon('map-trifold')" class="size-5 text-primary-t" />Peta DSKP — Standard
          Pembelajaran
        </h3>
        <DsText variant="overline" as="p" data-testid="map-caption">
          {{ subject.map.caption }}
        </DsText>
        <DsCluster as="ul" gap="xs" align="stretch" data-testid="map-tiles">
          <li v-for="t in subject.map.tiles" :key="t.spId">
            <UBadge
              :color="TILE_COLOR[t.status]"
              variant="subtle"
              size="lg"
              class="min-h-11 min-w-11 justify-center"
              :label="t.code"
              :title="`${t.code}: ${t.title} — ${STATUS_LABEL[t.status]}`"
              :data-testid="`tile-${t.spId}`"
            />
          </li>
        </DsCluster>
        <DsCluster as="ul" gap="md" row-gap="xs" data-testid="map-legend">
          <li v-for="l in LEGEND" :key="l.status">
            <UBadge :color="TILE_COLOR[l.status]" variant="subtle" :label="l.label" />
          </li>
          <li class="flex items-center gap-2 text-caption text-muted">
            <UBadge color="primary" variant="subtle" label="Fokus" />Klik untuk latihan fokus
          </li>
        </DsCluster>
      </DsStack>
    </DsPanel>
  </div>
</template>
