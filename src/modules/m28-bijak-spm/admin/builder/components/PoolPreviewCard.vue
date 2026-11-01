<script setup lang="ts">
/** Pratonton kolam: verdict, first shortage, per-section needed vs available and excluded reasons. */
import type { BijakPoolPreview } from '@pp/contract'

import { KONTRAK_ROUTES } from '../../kontrak/server/api'
import { REASON_LABEL, shortageLine } from '../../kontrak/domain/pool'
import { builderCopy as t } from '../domain/copy'

defineProps<{ preview: BijakPoolPreview; subject: string; kertas: number }>()
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="pool-preview">
    <p
      v-if="preview.verdict === 'boleh'"
      class="flex items-center gap-2 text-body text-success"
      data-testid="pool-verdict-ok"
    >
      <UIcon name="i-ph-check-circle" class="size-5" aria-hidden="true" />{{ t.poolOk }}
    </p>
    <p
      v-else-if="preview.verdict === 'tidak_pasti'"
      class="flex items-center gap-2 text-body text-warning"
      data-testid="pool-verdict-unsure"
    >
      <UIcon name="i-ph-warning" class="size-5" aria-hidden="true" />{{ t.poolUncertain }}
    </p>
    <p v-else class="flex items-start gap-2 text-body text-error" role="status" data-testid="pool-verdict-short">
      <UIcon name="i-ph-warning" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{{ preview.firstFailure ? shortageLine(preview.firstFailure) : t.generateBlocked }}</span>
    </p>

    <ul class="flex flex-col gap-1 text-caption text-muted" data-testid="pool-sections">
      <li v-for="s in preview.sections" :key="s.position">
        {{ s.label }}: perlu {{ s.slots }}, ada {{ s.eligible }}
        <span v-if="s.slots > s.eligible" class="font-semibold text-error">· Kurang {{ s.slots - s.eligible }}</span>
      </li>
    </ul>
    <ul v-if="preview.excluded.byReason.length" class="flex flex-col gap-1 text-caption text-muted">
      <li v-for="r in preview.excluded.byReason" :key="r.reason">
        {{ REASON_LABEL[r.reason] ?? r.reason }}: {{ r.count }}
      </li>
    </ul>
    <UButton
      :to="{ name: KONTRAK_ROUTES.pool, params: { subjek: subject, kertas: String(kertas) } }"
      color="neutral"
      variant="link"
      class="min-h-11 self-start"
      :label="t.poolOpenFull"
      data-testid="pool-open-full"
    />
  </div>
</template>
