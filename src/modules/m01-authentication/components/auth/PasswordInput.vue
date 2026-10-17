<script setup lang="ts">
/**
 * Password field with the eye toggle (FR-M01-04): switches the input between `password` and `text`
 * and the icon between eye and eye-slash. The toggle is `type="button"`, so it never submits.
 * Live gives the toggle no accessible name (D10: accessibility replicates live).
 */
import { ref } from 'vue'

import { AUTH_INPUT_CLASS } from './classes'

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
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :name="name"
      required
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :class="[AUTH_INPUT_CLASS, 'pr-12']"
      :data-testid="testid"
    />
    <button
      type="button"
      class="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-chip text-muted transition hover:text-default"
      :data-testid="`${testid}-toggle`"
      :data-visible="visible"
      @click="visible = !visible"
    >
      <UIcon v-if="visible" name="i-ph-eye-slash-duotone" class="size-5" />
      <UIcon v-else name="i-ph-eye-duotone" class="size-5" />
    </button>
  </div>
</template>
