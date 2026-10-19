<script setup lang="ts">
/**
 * S6 "Topik Perlu Perhatian" (FR-M08-43): rows with the accuracy badge, the SP label cut at ~70
 * characters, "{CODE} · {n} percubaan", the badge "Fokus {k}" and the "Fokus" button →
 * `/practice/{CODE}/quiz?level=…&dskp_sp_id=…&count={k}` (`level` omitted when unknown). Empty: green
 * check "Tiada topik lemah! Teruskan usaha.".
 */
import { DsEmptyState, DsPanel, DsStack, DsText } from '@/ds'

import type { WeakTopic } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { cut, focusHref } from '../../lib/analitik'

defineProps<{ topics: WeakTopic[] }>()

const icon = usePhIcon()

const href = (t: WeakTopic): string =>
  focusHref({
    subjectCode: t.subjectCode,
    spId: t.spId,
    count: t.focusCount,
    levelId: t.levelId,
  })
</script>

<template>
  <DsPanel data-testid="weak-block">
    <DsStack>
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('warning')" class="size-5 text-warning" />Topik Perlu Perhatian
      </h2>
      <div v-if="topics.length === 0" data-testid="weak-empty">
        <DsEmptyState title="Tiada topik lemah! Teruskan usaha." icon="check-circle" />
      </div>
      <template v-else>
        <DsStack as="ul" gap="xs" data-testid="weak-list">
          <li
            v-for="t in topics"
            :key="t.spId"
            class="flex items-center gap-3 bg-soft p-3"
            :data-testid="`weak-${t.spId}`"
          >
            <UBadge color="warning" variant="subtle" size="lg" :label="`${t.accuracy}%`" />
            <DsStack gap="2xs" class="grow">
              <DsText variant="label" as="p" tone="highlighted" wrap="anywhere">
                {{ t.code === null ? t.label : cut(t.label, 70) }}
              </DsText>
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
                <span>{{ t.subjectCode }} · {{ t.attempts }} percubaan</span>
                <UBadge
                  color="primary"
                  variant="subtle"
                  size="sm"
                  :icon="icon('lightning')"
                  :label="`Fokus ${t.focusCount}`"
                />
              </p>
            </DsStack>
            <UButton
              :to="href(t)"
              :title="`Klik untuk ${String(t.focusCount)} soalan fokus`"
              color="neutral"
              variant="soft"
              size="lg"
              :icon="icon('lightning')"
              label="Fokus"
              data-testid="focus-link"
            />
          </li>
        </DsStack>
        <p class="flex flex-wrap items-center gap-2 text-caption text-muted">
          <UBadge
            color="primary"
            variant="subtle"
            size="sm"
            :icon="icon('lightning')"
            label="Fokus"
          />
          Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja.
        </p>
      </template>
    </DsStack>
  </DsPanel>
</template>
