<script setup lang="ts">
/**
 * "🏆 Papan Markah — 10 Juara Teratas" of S7 (SRS M16 v1.6 FR-M16-61; URS FN-M16-5.3.1; BR-M16-22). The server
 * sends the ordered rows, the 15-character names and the initials; this renders the medals, the initials
 * avatar and the Kadar badge. v2 look: one raised row per player (a card per row, so it reads the same at
 * 375, 768 and 1280 px) with the five figures as labelled stats; ranks 1-3 get the lime rank chip.
 */
import type { GameLobby } from '../../api'
import RankedRow from '../battle/RankedRow.vue'
import { MEDALS } from './lobby-config'
import { kadarColor } from './lobby-lib'

defineProps<{ rows: NonNullable<GameLobby['top10']> }>()
</script>

<template>
  <UCard data-testid="top10-card">
    <h2 class="text-subheading text-highlighted">🏆 Papan Markah — 10 Juara Teratas</h2>
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
        <div class="flex flex-col">
          <dt class="text-caption text-muted">🏆 Menang</dt>
          <dd class="tabular text-label text-highlighted">{{ row.menang }}</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">🎮 Jumlah</dt>
          <dd class="tabular text-label text-highlighted">{{ row.jumlah }}</dd>
        </div>
        <div class="flex flex-col items-start">
          <dt class="text-caption text-muted">📊 Kadar</dt>
          <dd>
            <UBadge :color="kadarColor(row.kadar)" variant="soft" data-testid="top10-kadar"
              >{{ row.kadar }}%</UBadge
            >
          </dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">⭐ Skor</dt>
          <dd class="tabular text-label text-primary-t">{{ row.skor }}</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">✅ Betul</dt>
          <dd class="tabular text-label text-highlighted">{{ row.betul }}</dd>
        </div>
      </RankedRow>
    </ol>
  </UCard>
</template>
