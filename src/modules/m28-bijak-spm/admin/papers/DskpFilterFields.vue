<script setup lang="ts">
/**
 * The curriculum filters of the bank and the review queue (UX spec 6.1): Tingkatan, Unit, SP, TP,
 * KBAT and, for the bank, "Perlu semakan tag". One component so the two bars cannot drift. It sits in
 * the `more` slot of `DsFilterBar` ("Lagi Penapis" popover from `md`, the "Penapis" sheet below).
 * The dependency rules (Subjek clears Unit and SP, and so on) live in `useDskpFilter`; this file
 * only draws the fields from the catalogue view of the chosen subject.
 */
import { computed, useId } from 'vue'

import type { DskpSubjectView } from '@/modules/m03-curriculum'
import { DsCluster, DsNativeSelect, DsStack, DsText } from '@/ds'

import {
  FORM_FILTER_ITEMS,
  KBAT_FILTER_ITEMS,
  TP_FILTER_ITEMS,
  spOptions,
  unitGroups,
} from './dskp-filter'

const props = withDefaults(
  defineProps<{
    /** The Subjek chosen in the bar ('' = none). */
    subject: string
    /** Catalogue view of that subject (undefined while loading or on error). */
    view?: DskpSubjectView | undefined
    loading?: boolean
    error?: boolean
    /** The bank only: the "Perlu semakan tag" checkbox. */
    showTagReview?: boolean
    /** Prefix of the test ids (`bank` or `queue`). */
    prefix: string
  }>(),
  { view: undefined, loading: false, error: false, showTagReview: false },
)
const emit = defineEmits<{ retry: [] }>()

const formOrigin = defineModel<string>('formOrigin', { default: '' })
const unitId = defineModel<string>('unitId', { default: '' })
const spId = defineModel<string>('spId', { default: '' })
const tp = defineModel<string>('tp', { default: '' })
const kbat = defineModel<string>('kbat', { default: '' })
const tagReview = defineModel<boolean>('tagReview', { default: false })

const uid = useId()
const unitHintId = `${uid}-unit`
const spHintId = `${uid}-sp`

const groups = computed(() => unitGroups(props.view, formOrigin.value))
const sps = computed(() => spOptions(props.view, unitId.value))
const exempt = computed(() => formOrigin.value === 'T1-T3')
const unitDisabled = computed(() => !props.subject || exempt.value || props.loading || props.error)
const unitHint = computed(() => {
  if (!props.subject) return 'Pilih subjek dahulu.'
  if (props.error) return 'Senarai unit tidak dapat dimuatkan.'
  return ''
})
const spHint = computed(() => (!unitId.value && !exempt.value ? 'Pilih unit dahulu.' : ''))
</script>

<template>
  <DsStack gap="sm" data-testid="dskp-filters">
    <DsNativeSelect v-model="formOrigin" aria-label="Tingkatan" :data-testid="`${prefix}-form`">
      <option v-for="o in FORM_FILTER_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </DsNativeSelect>

    <DsStack gap="2xs">
      <DsNativeSelect
        v-model="unitId"
        aria-label="Unit"
        :disabled="unitDisabled"
        :loading="loading"
        :aria-describedby="unitHint ? unitHintId : undefined"
        :data-testid="`${prefix}-unit`"
      >
        <option value="">Semua unit</option>
        <template v-for="(g, i) in groups" :key="i">
          <optgroup v-if="g.label" :label="g.label">
            <option v-for="u in g.units" :key="u.value" :value="u.value">{{ u.label }}</option>
          </optgroup>
          <template v-else>
            <option v-for="u in g.units" :key="u.value" :value="u.value">{{ u.label }}</option>
          </template>
        </template>
      </DsNativeSelect>
      <DsText
        v-if="unitHint"
        :id="unitHintId"
        variant="caption"
        :data-testid="`${prefix}-unit-hint`"
      >
        {{ unitHint }}
      </DsText>
      <DsCluster v-if="error">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          label="Cuba Semula"
          :data-testid="`${prefix}-unit-retry`"
          @click="emit('retry')"
        />
      </DsCluster>
    </DsStack>

    <DsStack gap="2xs">
      <DsNativeSelect
        v-model="spId"
        aria-label="SP"
        :disabled="!unitId"
        :aria-describedby="spHint ? spHintId : undefined"
        :data-testid="`${prefix}-sp`"
      >
        <option value="">Semua SP</option>
        <option v-for="o in sps" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
      <DsText v-if="spHint" :id="spHintId" variant="caption" :data-testid="`${prefix}-sp-hint`">
        {{ spHint }}
      </DsText>
    </DsStack>

    <DsNativeSelect v-model="tp" aria-label="TP" :data-testid="`${prefix}-tp`">
      <option v-for="o in TP_FILTER_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </DsNativeSelect>

    <DsNativeSelect v-model="kbat" aria-label="Aras KBAT" :data-testid="`${prefix}-kbat`">
      <option v-for="o in KBAT_FILTER_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </DsNativeSelect>

    <UCheckbox
      v-if="showTagReview"
      v-model="tagReview"
      label="Perlu semakan tag"
      :data-testid="`${prefix}-tag-review`"
    />
  </DsStack>
</template>
