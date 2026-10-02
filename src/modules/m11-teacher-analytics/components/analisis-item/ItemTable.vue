<script setup lang="ts">
/**
 * FN-M11-5.1.5 (provisional, PROPOSED layout): Soalan · Subjek · Percubaan · % Betul (legend dot) ·
 * Diskriminasi (+ "baik" / "semak semula"). Scrolls inside its card, never the page.
 */
import { TABLE_CLASSES as T } from '@/components/data'

import type { ItemAnalysisRow } from '../../api/types'
import { BAND_DOT, clip80, discLabel, discNote, pctLabel } from './bands'
import { ITEM_COPY } from './copy'

defineProps<{ rows: ItemAnalysisRow[] }>()
</script>

<template>
  <div :class="T.card" data-testid="item-table-card">
    <div :class="T.scroller">
      <table :class="[T.table, 'min-w-[40rem]']" data-testid="item-table">
        <thead>
          <tr>
            <th :class="T.th">{{ ITEM_COPY.colQuestion }}</th>
            <th :class="T.th">{{ ITEM_COPY.colSubject }}</th>
            <th :class="[T.th, 'text-right']">{{ ITEM_COPY.colAttempts }}</th>
            <th :class="T.th">{{ ITEM_COPY.colPct }}</th>
            <th :class="T.th">{{ ITEM_COPY.colDiscrimination }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.questionId"
            :class="T.row"
            data-testid="item-row"
            :data-question-id="r.questionId"
            :data-band="r.band"
          >
            <td :class="[T.td, 'min-w-56 break-words']" data-testid="item-question">
              {{ clip80(r.textPlain) }}
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="item-subject">
              {{ r.subjectName }}
            </td>
            <td :class="[T.td, 'text-right']" data-testid="item-attempts">{{ r.attempts }}</td>
            <td :class="[T.td, 'whitespace-nowrap']">
              <span class="inline-flex items-center gap-2 font-semibold">
                <span
                  :class="['h-3 w-3 shrink-0 rounded-full', BAND_DOT[r.band]]"
                  data-testid="item-dot"
                />
                <span data-testid="item-pct">{{ pctLabel(r.pct) }}</span>
              </span>
            </td>
            <td :class="[T.td, 'whitespace-nowrap']">
              <span data-testid="item-disc">{{ discLabel(r.discrimination) }}</span>
              <span
                v-if="discNote(r.discrimination)"
                :class="[
                  'ml-2 text-xs font-semibold',
                  discNote(r.discrimination) === 'baik' ? 'text-emerald-600' : 'text-red-600',
                ]"
                data-testid="item-disc-note"
                >{{ discNote(r.discrimination) }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
