<script setup lang="ts">
/**
 * Vertical level path. Each node is done / current / locked, shown by a glyph chip and a word (not
 * colour alone), joined by a tonal rail. Locked nodes are not selectable. The `detail` slot is
 * rendered under the current (or selected) node.
 */
export interface LevelNode {
  id: string
  label: string
  state: 'done' | 'current' | 'locked'
}

withDefaults(
  defineProps<{
    levels: LevelNode[]
    /** Accessible name of the list (BM). */
    label: string
    /** Id of the node whose `detail` slot is open; defaults to the current node. */
    selected?: string
    doneLabel?: string
    currentLabel?: string
    lockedLabel?: string
  }>(),
  { selected: undefined, doneLabel: 'Selesai', currentLabel: 'Sekarang', lockedLabel: 'Terkunci' },
)

defineEmits<{ select: [id: string] }>()

const GLYPH = { done: 'i-ph-check-bold', current: 'i-ph-play-fill', locked: 'i-ph-lock-simple' }
</script>

<template>
  <ol class="flex flex-col" :aria-label="label" data-ds="level-map">
    <li v-for="(lv, i) in levels" :key="lv.id" class="flex flex-col" :data-state="lv.state">
      <span v-if="i > 0" class="ms-6 h-3 w-1.5 rounded-full bg-elevated" aria-hidden="true" />
      <UButton
        type="button"
        color="neutral"
        :variant="lv.state === 'current' ? 'soft' : 'ghost'"
        class="min-h-14 w-full justify-start gap-3 rounded-card p-2"
        :disabled="lv.state === 'locked'"
        :aria-current="lv.state === 'current' ? 'step' : undefined"
        @click="$emit('select', lv.id)"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full"
          :class="
            lv.state === 'done'
              ? 'bg-success text-on-sem'
              : lv.state === 'current'
                ? 'bg-primary text-primary-on'
                : 'bg-elevated text-muted'
          "
          aria-hidden="true"
        >
          <UIcon :name="GLYPH[lv.state]" class="size-5" />
        </span>
        <span class="flex min-w-0 grow flex-col text-start">
          <span class="truncate text-label text-highlighted">{{ lv.label }}</span>
          <span class="text-caption text-muted">
            {{ lv.state === 'done' ? doneLabel : lv.state === 'current' ? currentLabel : lockedLabel }}
          </span>
        </span>
      </UButton>
      <div
        v-if="$slots.detail && (selected ? selected === lv.id : lv.state === 'current')"
        class="ms-12 mt-2 rounded-card bg-soft p-3"
        data-ds="level-detail"
      >
        <slot name="detail" :level="lv" />
      </div>
    </li>
  </ol>
</template>
