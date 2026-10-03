<script setup lang="ts">
/** A counting number (FR-M05-11): starts at 0 and counts up to `target` with the live rule. */
import type { CountUpRule } from './dashboard-lib'
import { useCountUp } from './useCountUp'

const props = defineProps<{ target: number; rule: CountUpRule }>()
const count = useCountUp(() => props.target, props.rule)
</script>

<template>
  <span>{{ count }}</span>
</template>
