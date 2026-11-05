<script setup lang="ts">
/**
 * R1-ADM-N-05 `/admin/permainan` "Tetapan Permainan" (S7-T03; 30 N-05, 48 section 2 and GAME-14): the four room tiles, the
 * Papan Bijak card with the live board breakdown, the card "Ganjaran & Had Permainan" and the Segmen Roda Nasib editor.
 * Each card saves on its own, so unsaved input of another card stays. Validation is the server's and its messages show at
 * the field, so the number inputs carry no min, max or whole-number step that a browser would refuse first. The game list and its switch are not here yet (blocked on `game_enabled_<key>`).
 */
import type { TableColumn } from '@nuxt/ui'
import {
  GAMES_ADMIN_COPY as COPY,
  GAMES_ADMIN_PROPOSED_COPY as PROPOSED,
  GAMES_ADMIN_QUIZ_TILES as TILES,
  GAMES_ADMIN_SETTING_KEYS,
  GAMES_ADMIN_SETTINGS,
  gamesBoardBreakdown,
  type GamesAdminSettingKey,
} from '@pp/contract'
import { computed, reactive, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsCallout,
  DsCluster,
  DsDataTable,
  DsDefinitionList,
  DsFormField,
  DsFormSection,
  DsHeading,
  DsNativeSelect,
  DsPage,
  DsStack,
  DsStatRow,
  DsStateView,
  DsSwitchField,
  DsText,
  type DefinitionItem,
  type StatItem,
} from '@/ds'

import { fetchAdminGames, fetchSpinSegments, saveGameSettings, saveSpinSegments } from '../api/games'
import type { AdminGameSettings, AdminSpinSegment, SpinSegmentForm } from '../api/game-types'
import SpinSegmentField from '../components/admin/SpinSegmentField.vue'

const flash = useFlash()

const overview = useApi((signal) => fetchAdminGames({ signal }))
const segmentsLoad = useApi((signal) => fetchSpinSegments({ signal }))

/** A number input as sent (`UInput` type number hands back a number): empty or not a number is `null`, which the server refuses on that key. */
function toNumber(value: string | number): number | null {
  const text = String(value).trim()
  const n = Number(text)
  return text === '' || Number.isNaN(n) ? null : n
}

/** A failed save: a message per field, else the one message of the card (SR-1). */
function readFailure(err: unknown): { fields: Record<string, string>; message: string } {
  if (isApiError(err)) {
    const fields = err.fields ?? {}
    return { fields, message: Object.keys(fields).length > 0 ? '' : err.message }
  }
  return { fields: {}, message: err instanceof Error ? err.message : '' }
}

// --- the tiles ----------------------------------------------------------------------------------------------------

const tiles = computed<StatItem[]>(() => {
  const stats = overview.data.value?.stats
  return [
    { key: 'rooms', label: COPY.tiles.rooms, value: stats?.rooms ?? null, icon: 'game-controller' },
    { key: 'playing', label: COPY.tiles.playing, value: stats?.playing ?? null, icon: 'clock' },
    { key: 'finished', label: COPY.tiles.finished, value: stats?.finished ?? null, icon: 'check-circle' },
    { key: 'players', label: COPY.tiles.players, value: stats?.players ?? null, icon: 'users-three' },
  ]
})

// --- Papan Bijak --------------------------------------------------------------------------------------------------

const quizTiles = ref('')
/** `undefined`, not an empty string: a `DsFormField` given `''` marks its control invalid. */
const boardError = ref<string | undefined>()
const boardFailure = ref('')
const boardSaving = ref(false)

/** N05-02, recomputed as the admin types; anything that is not a whole number above 0 counts as 0. */
const breakdown = computed(() => {
  const n = toNumber(quizTiles.value)
  return gamesBoardBreakdown(n !== null && Number.isInteger(n) && n > 0 ? n : 0)
})
const breakdownItems = computed<DefinitionItem[]>(() => [
  { key: 'quiz', label: COPY.breakdown.quiz, value: breakdown.value.quiz },
  { key: 'ladders', label: COPY.breakdown.ladders, value: breakdown.value.ladders },
  { key: 'bonus', label: COPY.breakdown.bonus, value: breakdown.value.bonus },
  { key: 'plain', label: COPY.breakdown.plain, value: breakdown.value.plain },
  { key: 'ends', label: COPY.breakdown.ends, value: breakdown.value.ends },
])

async function saveBoard(): Promise<void> {
  if (boardSaving.value) return
  boardSaving.value = true
  boardError.value = undefined
  boardFailure.value = ''
  try {
    const saved = await saveGameSettings({ boardgame_quiz_tiles: toNumber(quizTiles.value) })
    quizTiles.value = String(saved.boardgameQuizTiles)
    flash.show({ type: 'success', message: COPY.saved })
  } catch (err) {
    const { fields, message } = readFailure(err)
    boardError.value = fields.boardgame_quiz_tiles
    boardFailure.value = message
  } finally {
    boardSaving.value = false
  }
}

// --- Ganjaran & Had Permainan -------------------------------------------------------------------------------------

const REWARD_FIELDS = GAMES_ADMIN_SETTING_KEYS.map((key) => {
  const spec: { label: string; oneOf?: readonly number[]; toggle?: boolean } = GAMES_ADMIN_SETTINGS[key]
  return { key, ...spec, items: spec.oneOf?.map((v) => ({ label: String(v), value: String(v) })) }
})

const rewards = reactive(
  Object.fromEntries(GAMES_ADMIN_SETTING_KEYS.map((key) => [key, ''])) as Record<GamesAdminSettingKey, string>,
)
const rewardErrors = ref<Record<string, string>>({})
const rewardFailure = ref('')
const rewardSaving = ref(false)

function fillRewards(settings: AdminGameSettings): void {
  for (const key of GAMES_ADMIN_SETTING_KEYS) rewards[key] = String(settings[key])
}

async function saveRewards(): Promise<void> {
  if (rewardSaving.value) return
  rewardSaving.value = true
  rewardErrors.value = {}
  rewardFailure.value = ''
  try {
    const body = Object.fromEntries(GAMES_ADMIN_SETTING_KEYS.map((key) => [key, toNumber(rewards[key])]))
    fillRewards(await saveGameSettings(body))
    flash.show({ type: 'success', message: COPY.saved })
  } catch (err) {
    const { fields, message } = readFailure(err)
    rewardErrors.value = fields
    rewardFailure.value = message
  } finally {
    rewardSaving.value = false
  }
}

watch(
  overview.data,
  (value) => {
    if (!value) return
    quizTiles.value = String(value.settings.boardgameQuizTiles)
    fillRewards(value.settings)
  },
  { immediate: true },
)

// --- Segmen Roda Nasib --------------------------------------------------------------------------------------------

type SegmentRow = SpinSegmentForm & Record<string, unknown>

const segments = ref<SegmentRow[]>([])
const segmentErrors = ref<Record<string, string>>({})
const segmentFailure = ref('')
const segmentSaving = ref(false)

const SEGMENT_COLUMNS: TableColumn<SegmentRow>[] = [
  { accessorKey: 'position', header: COPY.segmentColumns.position },
  { id: 'label', header: COPY.segmentColumns.label },
  { id: 'syiling', header: COPY.segmentColumns.syiling },
  { id: 'weight', header: COPY.segmentColumns.weight },
  { id: 'active', header: COPY.segmentColumns.active },
]
/** Required by the page template rule; the `card` slot below renders the phone view. */
const SEGMENT_CARD_FIELDS = [
  { key: 'label', label: COPY.segmentColumns.label },
  { key: 'syiling', label: COPY.segmentColumns.syiling },
  { key: 'weight', label: COPY.segmentColumns.weight },
]

const toForm = (row: AdminSpinSegment): SegmentRow => ({
  position: row.position,
  label: row.label,
  syiling: String(row.syiling),
  weight: String(row.weight),
  active: row.active,
})

const weightTotal = computed(() =>
  segments.value.reduce((sum, row) => sum + (toNumber(row.weight) ?? 0), 0),
)

/** The message of one value, by the row's index in the sent list. */
function segmentError(position: number, field: string): string | undefined {
  return segmentErrors.value[`segments.${String(position - 1)}.${field}`]
}

function setSegmentField(position: number, field: 'label' | 'syiling' | 'weight', value: string): void {
  const row = segments.value.find((r) => r.position === position)
  if (row) row[field] = value
}

function setSegmentActive(position: number, value: boolean): void {
  const row = segments.value.find((r) => r.position === position)
  if (row) row.active = value
}

async function saveSegments(): Promise<void> {
  if (segmentSaving.value) return
  segmentSaving.value = true
  segmentErrors.value = {}
  segmentFailure.value = ''
  try {
    const saved = await saveSpinSegments(
      segments.value.map((row) => ({
        position: row.position,
        label: row.label,
        syiling: toNumber(row.syiling),
        weight: toNumber(row.weight),
        active: row.active,
      })),
    )
    segments.value = saved.map(toForm)
    flash.show({ type: 'success', message: PROPOSED.segmentsSaved })
  } catch (err) {
    const { fields, message } = readFailure(err)
    segmentErrors.value = fields
    segmentFailure.value = message || (fields.segments ?? '')
  } finally {
    segmentSaving.value = false
  }
}

watch(
  segmentsLoad.data,
  (value) => {
    if (value) segments.value = value.map(toForm)
  },
  { immediate: true },
)

const overviewStatus = computed(() =>
  overview.error.value ? 'error' : overview.data.value ? 'ready' : 'loading',
)
const segmentsStatus = computed(() =>
  segmentsLoad.error.value ? 'error' : segmentsLoad.data.value ? 'ready' : 'loading',
)
</script>

<template>
  <DsPage layout="form" data-testid="gs-page">
    <DsStateView
      :status="overviewStatus"
      skeleton="stats"
      :rows="4"
      data-testid="gs-overview-state"
      @retry="overview.reload()"
    >
      <DsStack gap="section">
        <DsStatRow :items="tiles" prefix="gs-tile" part-prefix="gs-tile-part" density="compact" />

        <DsStack as="form" gap="md" data-testid="gs-board-form" @submit.prevent="saveBoard">
          <DsFormSection
            :title="COPY.boardTitle"
            :description="COPY.boardDescription"
            icon="game-controller"
          >
            <DsFormField :label="TILES.label" :help="TILES.hint" :error="boardError">
              <UInput
                v-model="quizTiles"
                type="number"
                inputmode="numeric"
                step="any"
                data-testid="gs-quiz-tiles"
              >
                <template #trailing>
                  <DsText variant="caption" tone="muted">{{ TILES.unit }}</DsText>
                </template>
              </UInput>
            </DsFormField>

            <DsStack gap="sm" data-testid="gs-breakdown">
              <DsHeading :level="3" variant="label">{{ COPY.breakdownTitle }}</DsHeading>
              <DsDefinitionList :items="breakdownItems" />
              <DsCluster data-testid="gs-breakdown-chips">
                <DsBadge :label="`${breakdown.quiz} soalan`" tone="info" data-testid="gs-chip-quiz" />
                <DsBadge :label="`${breakdown.special} khas`" tone="warning" data-testid="gs-chip-special" />
                <DsBadge :label="`${breakdown.plain} biasa`" tone="neutral" data-testid="gs-chip-plain" />
              </DsCluster>
            </DsStack>

            <DsCallout v-if="boardFailure" tone="error" :description="boardFailure" data-testid="gs-board-failure" />

            <template #footer>
              <DsCluster justify="end">
                <UButton type="submit" :label="COPY.save" :loading="boardSaving" data-testid="gs-board-save" />
              </DsCluster>
            </template>
          </DsFormSection>
        </DsStack>

        <DsStack as="form" gap="md" data-testid="gs-reward-form" @submit.prevent="saveRewards">
          <DsFormSection :title="COPY.rewardsTitle" icon="coins" :columns="2">
            <template v-for="field in REWARD_FIELDS" :key="field.key">
              <DsSwitchField
                v-if="field.toggle"
                :model-value="rewards[field.key] === '1'"
                :label="field.label"
                :data-testid="`gs-setting-${field.key}`"
                @update:model-value="rewards[field.key] = $event ? '1' : '0'"
              />
              <DsFormField v-else :label="field.label" :error="rewardErrors[field.key]">
                <DsNativeSelect
                  v-if="field.items"
                  v-model="rewards[field.key]"
                  :items="field.items"
                  :data-testid="`gs-setting-${field.key}`"
                />
                <UInput
                  v-else
                  v-model="rewards[field.key]"
                  type="number"
                  inputmode="numeric"
                  step="any"
                  :data-testid="`gs-setting-${field.key}`"
                />
              </DsFormField>
            </template>

            <template #footer>
              <DsStack gap="md">
                <DsCallout v-if="rewardFailure" tone="error" :description="rewardFailure" data-testid="gs-reward-failure" />
                <DsCluster justify="end">
                  <UButton type="submit" :label="COPY.save" :loading="rewardSaving" data-testid="gs-reward-save" />
                </DsCluster>
              </DsStack>
            </template>
          </DsFormSection>
        </DsStack>
      </DsStack>
    </DsStateView>

    <DsStack as="form" gap="md" data-testid="gs-segment-form" @submit.prevent="saveSegments">
      <DsFormSection :title="COPY.segmentsTitle" icon="trophy">
        <DsStateView
          :status="segmentsStatus"
          skeleton="table"
          :rows="8"
          data-testid="gs-segment-state"
          @retry="segmentsLoad.reload()"
        >
          <DsDataTable
            :data="segments"
            :columns="SEGMENT_COLUMNS"
            variant="bare"
            pager="none"
            :page-size="8"
            :caption="COPY.segmentsTitle"
            card-title="position"
            :card-fields="SEGMENT_CARD_FIELDS"
            data-testid="gs-segment-table"
          >
            <template #label-cell="{ row }">
              <SpinSegmentField
                :segment="row.original"
                field="label"
                :error="segmentError(row.original.position, 'label')"
                @update="(f, v) => setSegmentField(row.original.position, f, v)"
              />
            </template>
            <template #syiling-cell="{ row }">
              <SpinSegmentField
                :segment="row.original"
                field="syiling"
                :error="segmentError(row.original.position, 'syiling')"
                @update="(f, v) => setSegmentField(row.original.position, f, v)"
              />
            </template>
            <template #weight-cell="{ row }">
              <SpinSegmentField
                :segment="row.original"
                field="weight"
                :error="segmentError(row.original.position, 'weight')"
                @update="(f, v) => setSegmentField(row.original.position, f, v)"
              />
            </template>
            <template #active-cell="{ row }">
              <SpinSegmentField
                :segment="row.original"
                field="active"
                :error="segmentError(row.original.position, 'active')"
                @toggle="setSegmentActive(row.original.position, $event)"
              />
            </template>
            <template #card="{ row }">
              <DsStack gap="sm">
                <DsText variant="label" tone="muted">{{ `${COPY.segmentColumns.position}${row.position}` }}</DsText>
                <DsFormField
                  v-for="field in (['label', 'syiling', 'weight'] as const)"
                  :key="field"
                  :label="COPY.segmentColumns[field]"
                >
                  <SpinSegmentField
                    :segment="row"
                    :field="field"
                    :error="segmentError(row.position, field)"
                    @update="(f, v) => setSegmentField(row.position, f, v)"
                  />
                </DsFormField>
                <SpinSegmentField
                  :segment="row"
                  field="active"
                  :error="segmentError(row.position, 'active')"
                  @toggle="setSegmentActive(row.position, $event)"
                />
              </DsStack>
            </template>
          </DsDataTable>
        </DsStateView>

        <template #footer>
          <DsStack gap="md">
            <DsText variant="body" tone="muted" data-testid="gs-weight-total">{{
              PROPOSED.segmentsTotal(weightTotal)
            }}</DsText>
            <DsCallout v-if="segmentFailure" tone="error" :description="segmentFailure" data-testid="gs-segment-failure" />
            <DsCluster justify="end">
              <UButton type="submit" :label="PROPOSED.segmentsSave" :loading="segmentSaving" data-testid="gs-segment-save" />
            </DsCluster>
          </DsStack>
        </template>
      </DsFormSection>
    </DsStack>
  </DsPage>
</template>
