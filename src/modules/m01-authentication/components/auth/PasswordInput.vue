<script setup lang="ts">
/**
 * Password field with the eye toggle (FR-M01-04): switches the input between `password` and `text`
 * and the icon between eye and eye-slash. The toggle is `type="button"`, so it never submits.
 * Live gives the toggle no accessible name (D10: accessibility replicates live).
 */
import { ref } from 'vue'

defineProps<{
  id: string
  name: string
  placeholder: string
  autocomplete: string
  /** Prefix of the `data-testid`s: `<testid>` (input) and `<testid>-toggle`. */
  testid: string
}>()

const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <UInput
    :id="id"
    v-model="model"
    :type="visible ? 'text' : 'password'"
    :name="name"
    required
    :autocomplete="autocomplete"
    :placeholder="placeholder"
    icon="i-ph-lock-duotone"
    size="xl"
    class="w-full"
    :data-testid="testid"
  >
    <template #trailing>
      <UButton
        type="button"
        color="neutral"
        variant="link"
        :icon="visible ? 'i-ph-eye-slash-duotone' : 'i-ph-eye-duotone'"
        :data-testid="`${testid}-toggle`"
        :data-visible="visible"
        @click="visible = !visible"
      />
    </template>
  </UInput>
</template>
