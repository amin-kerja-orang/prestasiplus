<script setup lang="ts">
/**
 * "🏆 Papan Markah — Top 10 Juara" of S7 (SRS M16 v1.6 FR-M16-61; URS FN-M16-5.3.1; BR-M16-22). The server
 * sends the ordered rows, the 15-character names and the initials; this renders the medals, the initials
 * avatar and the Kadar badge. v2 look: one raised row per player (a card per row, so it reads the same at
 * 375, 768 and 1280 px) with the five figures as labelled stats; ranks 1-3 get the lime rank chip.
 */
import type { GameLobby } from '../../api'
import RankedRow from '../battle/RankedRow.vue'
import { MEDALS } from './lobby-config'
import { kadarColor } from './lobby-lib'
import { DsStack, DsHeading, DsText } from '@/ds'

defineProps<{ rows: NonNullable<GameLobby['top10']> }>()
</script>

<template>
  <UCard data-testid="top10-card">
    <DsHeading :level="2" variant="subheading">🏆 Papan Markah — Top 10 Juara</DsHeading>
    <ol class="mt-3 flex flex-col gap-2" data-testid="top10-table">
      <RankedRow
        v-for="row in rows"
        :key="row.userId"
        :rank="row.rank"
        :rank-label="MEDALS[row.rank - 1]"
        :title="row.name"
        :initials="row.initials"
        data-testid="top10-row"
      >
        <DsStack gap="none">
          <DsText variant="caption" as="dt">🏆 Menang</DsText>
          <DsText variant="label" as="dd" tone="highlighted" tabular>{{ row.menang }}</DsText>
        </DsStack>
        <DsStack gap="none">
          <DsText variant="caption" as="dt">🎮 Jumlah</DsText>
          <DsText variant="label" as="dd" tone="highlighted" tabular>{{ row.jumlah }}</DsText>
        </DsStack>
        <DsStack gap="none" align="start">
          <DsText variant="caption" as="dt">📊 Kadar</DsText>
          <dd>
            <UBadge :color="kadarColor(row.kadar)" variant="soft" data-testid="top10-kadar"
              >{{ row.kadar }}%</UBadge
            >
          </dd>
        </DsStack>
        <DsStack gap="none">
          <DsText variant="caption" as="dt">⭐ Skor</DsText>
          <DsText variant="label" as="dd" tone="primary" tabular>{{ row.skor }}</DsText>
        </DsStack>
        <DsStack gap="none">
          <DsText variant="caption" as="dt">✅ Betul</DsText>
          <DsText variant="label" as="dd" tone="highlighted" tabular>{{ row.betul }}</DsText>
        </DsStack>
      </RankedRow>
    </ol>
  </UCard>
</template>
