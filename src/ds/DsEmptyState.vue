<script setup lang="ts">
/**
 * Empty state (design language 10): `UEmpty` with an optional friend (learner views show the friend,
 * mood "encouraging", instead of a glyph, D37b). Copy defaults to the glossary: `item` builds
 * "Belum ada {item}." or, with `filtered`, "Tiada {item} dijumpai." plus the "Cuba ubah atau set
 * semula penapis." hint and a "Set Semula" button (when a `reset` listener is bound). `size="sm"`
 * is the in-card form (chart with no data for the period).
 */
import { computed, getCurrentInstance, useSlots } from 'vue'

import type { FriendId } from './assets'
import { dsCopy, fillCopy } from './copy'
import DsFriendFace from './DsFriendFace.vue'
import { resolveIcon } from './icon'
import { usePersonality } from './personality'

const props = withDefaults(
  defineProps<{
    /** Overrides the glossary title (live exception). */
    title?: string
    description?: string
    /** Phosphor base name (`tray`) or full class (deprecated). */
    icon?: string
    friend?: FriendId
    size?: 'sm' | 'md'
    /** A filter or search is active: "Tiada ... dijumpai" instead of "Belum ada ...". */
    filtered?: boolean
    /** Noun for the glossary title, e.g. `soalan`. */
    item?: string
    resetLabel?: string
  }>(),
  {
    title: undefined,
    description: undefined,
    icon: 'tray',
    friend: undefined,
    size: 'md',
    filtered: false,
    item: undefined,
    resetLabel: dsCopy.filterReset,
  },
)

const emit = defineEmits<{ reset: [] }>()
const slots = useSlots()
const personality = usePersonality()
const hasReset = !!getCurrentInstance()?.vnode.props?.onReset

const heading = computed(() => {
  if (props.title) return props.title
  if (props.filtered) {
    return props.item
      ? fillCopy(dsCopy.emptyFiltered, { item: props.item })
      : dsCopy.emptyFilteredNoItem
  }
  return props.item ? fillCopy(dsCopy.emptyNever, { item: props.item }) : dsCopy.emptyNoData
})
const hint = computed(
  () => props.description ?? (props.filtered ? dsCopy.emptyFilteredHint : undefined),
)
const iconName = computed(() => resolveIcon(props.icon, personality.value))
const showReset = computed(() => props.filtered && hasReset && !slots.actions)
</script>

<template>
  <UEmpty
    :title="heading"
    :description="hint"
    :icon="friend ? undefined : iconName"
    :size="size"
    variant="naked"
    data-ds="empty-state"
  >
    <template v-if="friend" #leading>
      <DsFriendFace :friend="friend" mood="encouraging" size="lg" />
    </template>
    <template v-if="slots.actions || showReset" #actions>
      <slot name="actions">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :label="resetLabel"
          @click="emit('reset')"
        />
      </slot>
    </template>
  </UEmpty>
</template>
