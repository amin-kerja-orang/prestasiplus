<script setup lang="ts">
/**
 * The tag lines under one history entry (UX spec 7.2): one nested line per changed field, in the
 * order Tingkatan, Unit, SP, TP, Aras KBAT, with the AI suggestion when there was one. The person is
 * the entry's own line; nothing here can be edited or deleted (AC-10.4). While the catalogue loads
 * the lines are held back so a unit never flashes as "tidak dijumpai dalam katalog".
 */
import { computed } from 'vue'

import type { DskpSubjectView } from '@/modules/m03-curriculum'
import { DsCluster, DsStack, DsText } from '@/ds'

import type { HistoryEntry } from '../../domain/admin-types'
import { tagLines } from './dskp-filter'

const props = defineProps<{
  entry: HistoryEntry
  /** Catalogue view of the question's subject; undefined while loading or when it failed. */
  view?: DskpSubjectView | undefined
  /** The view is still loading. */
  pending?: boolean
}>()

const lines = computed(() => (props.pending ? [] : tagLines(props.entry, props.view)))
</script>

<template>
  <DsStack v-if="lines.length" as="ul" gap="2xs" data-testid="history-tag">
    <li v-for="l in lines" :key="l.field" :data-testid="`history-tag-${l.field}`">
      <!-- The empty box indents the line by 1rem under the entry's own line. -->
      <DsCluster :wrap="false" align="start" gap="none">
        <span class="size-4 shrink-0" aria-hidden="true" />
        <DsText as="span" variant="caption" wrap="anywhere">
          Tag: {{ l.label }}:
          <template v-if="l.before !== undefined"
            >{{ l.before }} <span aria-hidden="true">&rarr;</span
            ><span class="sr-only"> kepada </span>
          </template>
          {{ l.after }}{{ l.suffix }}
        </DsText>
      </DsCluster>
    </li>
  </DsStack>
</template>
