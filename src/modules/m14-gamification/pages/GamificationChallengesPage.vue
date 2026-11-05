<script setup lang="ts">
/**
 * S13 `/gamification/challenges` "Cabaran Harian" (M14-T2a; FR-M14-34, 35). Reads #7: header with the
 * "{completed}/{active}" "Selesai" counter, then one card per active challenge in the order served.
 */
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { useApi } from '@/composables'
import { DsPage, DsStatTile, DsText } from '@/ds'

import { claimChallenge, fetchGamificationChallenges } from '../api'
import S13ChallengeCard from '../components/student-a/S13ChallengeCard.vue'

const challenges = useApi((signal) => fetchGamificationChallenges({ signal }))

/**
 * "Tuntut" (API-GAME-11, FR-MUR-30-3/4, S7-T04). One `clientUuid` per press, kept for a retry of that press when the
 * answer never arrived (network or server error) and dropped on any definitive answer. A button is disabled while its
 * request is in flight, so one press sends one request.
 */
const claimedHere = ref<ReadonlySet<number>>(new Set())
const pending = ref<ReadonlySet<number>>(new Set())
const keys = new Map<number, string>()
const success = ref('')
const notices = ref<string[]>([])
const failure = ref('')

const isClaimed = (c: { id: number; claimed?: boolean }) => c.claimed === true || claimedHere.value.has(c.id)

/** "{n} / {total} ganjaran dituntut": the served count plus the claims made here that it does not include yet. */
const claimedCount = computed(() => {
  const res = challenges.data.value
  if (!res) return 0
  const served = res.meta.claimed ?? res.data.filter((c) => c.claimed === true).length
  return served + res.data.filter((c) => c.claimed !== true && claimedHere.value.has(c.id)).length
})

const withId = (set: ReadonlySet<number>, id: number, on: boolean) => {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

async function onClaim(id: number): Promise<void> {
  if (pending.value.has(id)) return
  const key = keys.get(id) ?? crypto.randomUUID()
  keys.set(id, key)
  pending.value = withId(pending.value, id, true)
  success.value = ''
  notices.value = []
  failure.value = ''
  try {
    const res = await claimChallenge(id, key)
    keys.delete(id)
    claimedHere.value = withId(claimedHere.value, id, true)
    success.value = `Ganjaran dituntut: +${String(res.rewardSyiling)} syiling, +${String(res.rewardXp)} mata.`
    notices.value = res.notices ?? []
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status < 500) {
      keys.delete(id)
      if (err.code === 'CHALLENGE_CLAIMED') claimedHere.value = withId(claimedHere.value, id, true)
      else failure.value = err.message
    } else {
      failure.value = 'Ralat berlaku. Sila cuba lagi.'
    }
  } finally {
    pending.value = withId(pending.value, id, false)
  }
}
</script>

<template>
  <DsPage data-testid="gamification-challenges-page">
    <h1 v-if="challenges.error.value || !challenges.data.value" class="sr-only">Cabaran Harian</h1>
    <UAlert
      v-if="challenges.error.value"
      color="error"
      variant="subtle"
      title="Ralat berlaku. Sila cuba lagi."
    />

    <div
      v-else-if="!challenges.data.value"
      class="flex flex-col gap-4"
      aria-busy="true"
      data-testid="s13-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <UCard data-testid="s13-hero">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted">Cabaran Harian</h1>
            <p class="text-body text-muted">
              Selesaikan cabaran hari ini dan tuntut ganjaran syiling
            </p>
            <DsText as="p" variant="label" tone="toned" data-testid="s13-claimed-count">
              {{ claimedCount }} / {{ challenges.data.value.meta.active }} ganjaran dituntut
            </DsText>
          </div>
          <div data-testid="s13-counter">
            <DsStatTile
              art="fire"
              :value="`${challenges.data.value.meta.completed}/${challenges.data.value.meta.active}`"
              unit="Selesai"
              value-testid="s13-counter-value"
            />
          </div>
        </div>
      </UCard>

      <UAlert v-if="success" color="success" variant="subtle" :title="success" data-testid="s13-success" />
      <UAlert
        v-for="n in notices"
        :key="n"
        color="success"
        variant="subtle"
        :title="n"
        data-testid="s13-notice"
      />
      <UAlert v-if="failure" color="error" variant="subtle" :title="failure" data-testid="s13-failure" />

      <div class="grid grid-cols-1 gap-4">
        <S13ChallengeCard
          v-for="c in challenges.data.value.data"
          :key="c.id"
          :challenge="c"
          :claimed="isClaimed(c)"
          :pending="pending.has(c.id)"
          @claim="onClaim"
        />
      </div>
    </template>
  </DsPage>
</template>
