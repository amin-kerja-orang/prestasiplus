<script setup lang="ts">
/**
 * `table_fill` answer grid (FR-PA-09, 46 section 2.2.3). `tajuk` = read-only header cell, `diberi` = read-only
 * given text, `kosong` = input of at least 44 px. `v-model` is a map keyed `r{row}c{col}` (1-based), like the
 * accepted values `key.cells`. A wide grid scrolls inside its own container, never the page.
 */
import { qdCopy } from './copy'
import RichText from './RichText.vue'

/** Local mirror of `ModeConfigSchema.grid` (packages/contract/src/questions/parts.ts). */
export interface TableFillGridData {
  rows: number
  cols: number
  cells: { type: 'tajuk' | 'diberi' | 'kosong'; text?: string }[][]
}

const props = withDefaults(
  defineProps<{
    grid: TableFillGridData
    modelValue?: Record<string, string>
    readonly?: boolean
    /** Optional table caption. */
    caption?: string
  }>(),
  { modelValue: () => ({}), readonly: false, caption: undefined },
)
const emit = defineEmits<{ 'update:modelValue': [Record<string, string>] }>()

const cellKey = (r: number, c: number): string => `r${r}c${c}`
function onInput(key: string, value: string): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="qd-grid-scroll max-w-full overflow-x-auto" data-testid="table-fill-scroll">
    <table class="qd-grid w-full" data-testid="table-fill-grid">
      <caption v-if="caption">
        {{
          caption
        }}
      </caption>
      <tbody>
        <tr v-for="(row, ri) in grid.cells" :key="ri">
          <template v-for="(cell, ci) in row" :key="ci">
            <th v-if="cell.type === 'tajuk'" scope="col">
              <RichText :text="cell.text ?? ''" markup />
            </th>
            <td v-else-if="cell.type === 'diberi'">
              <RichText :text="cell.text ?? ''" markup />
            </td>
            <td v-else class="qd-grid-input">
              <UInput
                size="md"
                class="w-full"
                autocomplete="off"
                :aria-label="qdCopy.cellAria(ri + 1, ci + 1)"
                :data-testid="`cell-${cellKey(ri + 1, ci + 1)}`"
                :readonly="readonly"
                :model-value="modelValue[cellKey(ri + 1, ci + 1)] ?? ''"
                @update:model-value="onInput(cellKey(ri + 1, ci + 1), String($event ?? ''))"
              />
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Token-driven grid chrome (no utility classes). The theme has no lines, so cells are separated by a gap. */
.qd-grid-scroll {
  border-radius: var(--ds-r-card);
  background: var(--ui-bg-accented);
}
.qd-grid {
  border-collapse: separate;
  border-spacing: 2px;
  color: var(--ui-text);
  font-size: var(--text-body);
}
.qd-grid caption {
  padding: 0.5rem;
  text-align: start;
  font-size: var(--text-caption);
  color: var(--ui-text-toned);
}
.qd-grid th,
.qd-grid td {
  min-width: 7rem;
  padding: 0.5rem;
  background: var(--ui-bg);
}
.qd-grid th {
  background: var(--ui-bg-elevated);
  text-align: start;
  font-weight: 600;
}
.qd-grid td.qd-grid-input {
  padding: 0.25rem;
}
</style>
