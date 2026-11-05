<script setup lang="ts">
/**
 * AC-GUR-42-7: a pupil list that shows the first 10 names (sorted by name, Malay collation) and a "+ {n} lagi" link that
 * expands to all. The caller passes the same array that its card and title count (FR-GUR-42-3).
 */
import { computed, ref, watch } from 'vue'

import { DsStack } from '@/ds'

import type { StudentLite } from '../../api/types'
import { LIST_LIMIT, moreCount } from './copy'
import StudentRows from './StudentRows.vue'

const props = defineProps<{ rows: StudentLite[]; testId: string }>()

const open = ref(false)
watch(
  () => props.rows,
  () => {
    open.value = false
  },
)

const sorted = computed(() =>
  [...props.rows].sort(
    (a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.id - b.id,
  ),
)
const shown = computed(() => (open.value ? sorted.value : sorted.value.slice(0, LIST_LIMIT)))
const rest = computed(() => sorted.value.length - LIST_LIMIT)
</script>

<template>
  <DsStack gap="xs">
    <StudentRows :rows="shown" :test-id="testId" />
    <div v-if="!open && rest > 0">
      <UButton
        type="button"
        color="neutral"
        variant="link"
        size="sm"
        :label="moreCount(rest)"
        :data-testid="`${testId}-more`"
        @click="open = true"
      />
    </div>
  </DsStack>
</template>
