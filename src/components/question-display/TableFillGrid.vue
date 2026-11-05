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
  <div
    class="max-w-full overflow-x-auto rounded-xl ring-1 ring-inset ring-default"
    data-testid="table-fill-scroll"
  >
    <table class="w-full border-collapse text-body text-default" data-testid="table-fill-grid">
      <caption v-if="caption" class="p-2 text-left text-caption text-toned">
        {{ caption }}
      </caption>
      <tbody>
        <tr v-for="(row, ri) in grid.cells" :key="ri">
          <template v-for="(cell, ci) in row" :key="ci">
            <th
              v-if="cell.type === 'tajuk'"
              scope="col"
              class="min-w-28 border border-default bg-elevated p-2 text-left font-semibold"
            >
              <RichText :text="cell.text ?? ''" markup />
            </th>
            <td v-else-if="cell.type === 'diberi'" class="min-w-28 border border-default p-2">
              <RichText :text="cell.text ?? ''" markup />
            </td>
            <td v-else class="min-w-28 border border-default p-1">
              <input
                type="text"
                class="min-h-11 w-full rounded-lg bg-default px-3 text-body text-default ring-1 ring-inset ring-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                autocomplete="off"
                :aria-label="qdCopy.cellAria(ri + 1, ci + 1)"
                :data-testid="`cell-${cellKey(ri + 1, ci + 1)}`"
                :readonly="readonly"
                :value="modelValue[cellKey(ri + 1, ci + 1)] ?? ''"
                @input="onInput(cellKey(ri + 1, ci + 1), ($event.target as HTMLInputElement).value)"
              />
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>
