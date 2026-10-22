<script setup lang="ts">
/**
 * S7 callout "{n} guru menunggu pengesahan" + "Semak" (docs/design/m27-pending-teacher-verify.md, section 6). Entry to
 * S7b. Shown only when n > 0; hidden while loading and, silently, when the call fails (S7 must not degrade). Read
 * once when S7 mounts.
 */
import { computed, onMounted, ref } from 'vue'

import { DsCluster, DsPanel, DsStatusBadge, DsText } from '@/ds'

import { fetchPendingTeachers } from '../../api/pending-teachers'
import { PENDING_PATH, PENDING_UNIT, foundText } from './pending-format'
import { formatCount } from './users-format'

const count = ref(0)
const visible = computed(() => count.value > 0)

onMounted(async () => {
  try {
    count.value = (await fetchPendingTeachers()).data.length
  } catch {
    count.value = 0
  }
})
</script>

<template>
  <DsPanel v-if="visible" data-testid="pt-callout">
    <DsCluster gap="sm" stack-below="sm" justify="between">
      <DsCluster gap="sm">
        <DsStatusBadge status="awaiting-review" :label="PENDING_UNIT" />
        <DsText variant="body" as="span" data-testid="pt-callout-count">{{
          foundText(formatCount(count))
        }}</DsText>
      </DsCluster>
      <UButton
        :to="PENDING_PATH"
        size="lg"
        icon="i-ph-user-check"
        block
        class="min-h-11 sm:w-auto"
        data-testid="pt-callout-link"
        >Semak</UButton
      >
    </DsCluster>
  </DsPanel>
</template>
