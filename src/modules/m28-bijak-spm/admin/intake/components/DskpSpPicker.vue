<script setup lang="ts">
/**
 * SP picker of the Tag DSKP block (UX spec 3.4): the selectable SP of the chosen unit as a searchable
 * list of checkbox rows with the selection as chips. Free text is never accepted; the search only
 * narrows the list (case, diacritic and tashkil insensitive, token AND over code and text) and never
 * changes the selection. The list scrolls inside itself. Pendidikan Islam text is Jawi: right-to-left
 * with `lang="ms-Arab"`, codes stay left-to-right.
 */
import { computed, nextTick, ref, useId } from 'vue'

import { DsCluster, DsRtlScope, DsStack, DsSurface, DsText, dsCopy } from '@/ds'

import type { DskpSpNode, DskpSubjectView } from '../../../lib/dskp-source'
import { TAG_COPY, filterSps, flagLegend, reviewFlag, spRow } from '../domain/tag-view'

const props = withDefaults(
  defineProps<{
    view?: DskpSubjectView
    /** The chosen unit; null = none yet. */
    unitId: string | null
    /** Chosen SP ids (catalogue print order). */
    modelValue: readonly string[]
    /** The catalogue of the subject is loading. */
    loading?: boolean
    /** Page or tingkatan makes the picker unusable (the fieldset is disabled, or T1-T3). */
    disabled?: boolean
    /** Outside DSKP (T1-T3): disabled and silent, the block explains it. */
    outside?: boolean
    required?: boolean
    /** SP text is Jawi (Pendidikan Islam): render right-to-left. */
    rtl?: boolean
    /** Inline gate message once the page shows its issues list. */
    error?: string
  }>(),
  { view: undefined, loading: false, disabled: false, outside: false, required: false, rtl: false, error: undefined },
)
const emit = defineEmits<{ toggle: [id: string, on: boolean] }>()

const uid = useId()
const labelId = `${uid}-label`
const searchId = `${uid}-search`
const root = ref<{ $el: HTMLElement } | null>(null)
const query = ref('')

const all = computed<readonly DskpSpNode[]>(() =>
  props.view && props.unitId ? props.view.sps(props.unitId as DskpSpNode['unitId']) : [],
)
const shown = computed(() =>
  props.view && props.unitId ? filterSps(props.view, props.unitId, all.value, query.value) : [],
)
const rows = computed(() => shown.value.map(spRow))
const legend = computed(() => flagLegend(rows.value))
const searching = computed(() => query.value.trim() !== '')
const chips = computed(() =>
  props.modelValue.map((id) => {
    const sp = props.view?.sp(id as DskpSpNode['id'])
    return { id, code: sp?.code ?? id, flag: sp ? reviewFlag(sp.flags) : null }
  }),
)
const countText = computed(() =>
  searching.value
    ? TAG_COPY.spCountSearch(rows.value.length, props.modelValue.length)
    : TAG_COPY.spCount(props.modelValue.length, all.value.length),
)
const inactive = computed(() => props.disabled || props.outside || !props.unitId)

function search(): HTMLInputElement | null {
  return root.value?.$el.querySelector<HTMLInputElement>(`#${CSS.escape(searchId)}`) ?? null
}
async function remove(id: string, index: number): Promise<void> {
  emit('toggle', id, false)
  await nextTick()
  const buttons = root.value?.$el.querySelectorAll<HTMLButtonElement>('[data-testid^="sp-remove-"]')
  const next = buttons && buttons.length > 0 ? buttons[Math.min(index, buttons.length - 1)] : undefined
  if (next) next.focus()
  else search()?.focus()
}
function clearSearch(): void {
  query.value = ''
  search()?.focus()
}
</script>

<template>
  <DsStack
    ref="root"
    gap="sm"
    role="group"
    :aria-labelledby="labelId"
    :aria-busy="loading ? 'true' : undefined"
    data-testid="q-sp"
  >
    <DsCluster gap="xs">
      <DsText :id="labelId" variant="label" as="span">
        {{ TAG_COPY.sp }}
        <template v-if="required">
          <DsText variant="label" as="span" tone="error" aria-hidden="true">*</DsText>
          <DsText variant="label" as="span" sr-only>{{ dsCopy.required }}</DsText>
        </template>
      </DsText>
      <slot name="label-extra" />
    </DsCluster>

    <template v-if="loading">
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-full" />
      <DsText variant="caption" as="span" sr-only>{{ dsCopy.loading }}</DsText>
    </template>

    <template v-else>
      <UInput
        :id="searchId"
        v-model="query"
        class="w-full"
        icon="i-ph-magnifying-glass"
        type="search"
        dir="auto"
        :placeholder="TAG_COPY.spSearchPlaceholder"
        :aria-label="TAG_COPY.spSearchAria"
        :disabled="inactive"
        data-testid="sp-search"
        @keydown.enter.prevent
      />

      <DsCluster v-if="chips.length > 0" gap="xs" data-testid="sp-chips">
        <DsCluster v-for="(c, i) in chips" :key="c.id" gap="none" as="span" :wrap="false">
          <UBadge
            color="neutral"
            variant="subtle"
            :icon="c.flag ? 'i-ph-warning' : undefined"
            :title="c.flag?.reason"
            :data-testid="`sp-chip-${c.code}`"
          >
            <span dir="ltr">{{ c.code }}</span>
          </UBadge>
          <UButton
            v-if="!disabled"
            icon="i-ph-x-bold"
            color="neutral"
            variant="ghost"
            size="xs"
            class="min-h-11 min-w-11"
            :aria-label="TAG_COPY.spRemove(c.code)"
            :data-testid="`sp-remove-${c.code}`"
            @click="remove(c.id, i)"
          />
        </DsCluster>
      </DsCluster>

      <DsSurface level="elevated" padding="sm" radius="chip" :clip="false" class="max-h-72 overflow-y-auto">
        <DsText v-if="!unitId && !outside" variant="caption" tone="muted" data-testid="sp-need-unit">
          {{ TAG_COPY.spNeedUnit }}
        </DsText>
        <DsText v-else-if="unitId && all.length === 0" variant="caption" tone="muted" data-testid="sp-none">
          {{ TAG_COPY.spNone }}
        </DsText>
        <DsStack v-else-if="rows.length === 0 && unitId" gap="xs" align="start" data-testid="sp-no-match">
          <DsText variant="caption" tone="muted">{{ TAG_COPY.spNoMatch(query.trim()) }}</DsText>
          <UButton
            variant="ghost"
            color="neutral"
            class="min-h-11"
            data-testid="sp-clear-search"
            @click="clearSearch"
          >
            {{ TAG_COPY.spClearSearch }}
          </UButton>
        </DsStack>
        <DsStack v-else-if="unitId" gap="2xs" as="ul" data-testid="sp-list">
          <li v-for="sp in rows" :key="sp.id">
            <UCheckbox
              :model-value="modelValue.includes(sp.id)"
              :disabled="disabled"
              :data-testid="`sp-option-${sp.code}`"
              @update:model-value="(v: boolean | 'indeterminate') => emit('toggle', sp.id, v === true)"
            >
              <template #label>
                <span class="block min-h-11 cursor-pointer">
                  <DsCluster gap="xs" as="span">
                    <DsText variant="body-strong" as="span" tabular dir="ltr">{{ sp.code }}</DsText>
                    <UBadge
                      v-if="sp.flag"
                      color="warning"
                      variant="subtle"
                      size="sm"
                      icon="i-ph-warning"
                      :title="sp.flag.reason"
                    >
                      {{ sp.flag.text }}
                    </UBadge>
                  </DsCluster>
                  <DsRtlScope v-if="rtl" lang="ms-Arab" data-testid="sp-text-rtl">{{ sp.text }}</DsRtlScope>
                  <DsText v-else variant="body" as="span" wrap="anywhere" class="block">{{ sp.text }}</DsText>
                </span>
              </template>
            </UCheckbox>
          </li>
        </DsStack>
      </DsSurface>

      <template v-if="unitId && all.length > 0">
        <DsText variant="caption" tone="muted" aria-live="polite" data-testid="sp-count">{{ countText }}</DsText>
        <DsText v-if="legend" variant="caption" tone="muted" data-testid="sp-legend">{{ legend }}</DsText>
      </template>
    </template>

    <DsText v-if="error" variant="caption" tone="error" role="alert" data-testid="field-error">{{ error }}</DsText>
    <slot />
  </DsStack>
</template>
