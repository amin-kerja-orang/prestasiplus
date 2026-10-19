<script setup lang="ts">
/**
 * S1 `/battle` "Battle Arena" (M16-T3; SRS M16 v1.6 FR-M16-16..33, §7.1; URS FN-M16-2.1..2.4).
 *
 * Hero, question-type row (Biasa / PKSK / SPM), subject, domain and level pickers, the visibility
 * switch, the three mode buttons, the searching / incoming-challenge / waiting cards, the error
 * banner and the two modals. Matchmaking runs in `useBattleSearch` (polling contract §7.1).
 *
 * DV-M16-06: no control starts the waiting card (`requestJoinQueue`); it is reachable only by the
 * test seam below (a `window` event `m16:battle-waiting`, detail `{queueId, name, gradeLabel?,
 * join?}`), because the mock hook `battleWaiting` creates the queue but cannot tell the page.
 */
import type { ButtonProps } from '@nuxt/ui'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useClickOutside } from '@/composables'
import {
  DsArt3D,
  DsIconChip,
  DsPage,
  DsLoadError,
  DsStack,
  DsCluster,
  DsGrid,
  DsHeading,
  DsText,
} from '@/ds'

import {
  fetchBattleLobby,
  fetchInvitations,
  type BattleInvitation,
  type PkskLevel,
  type QuestionType,
} from '../api'
import ChallengeFriendModal from '../components/battle/ChallengeFriendModal.vue'
import InvitationsModal from '../components/battle/InvitationsModal.vue'
import { canStart, matchParams, type BattleSelection } from '../components/battle/battle-lib'
import { useBattleSearch } from '../composables/useBattleSearch'

const router = useRouter()
/** Close button of the error alert: a 44px target with the test id (extra attrs reach the button). */
const errorClose = {
  class: 'min-h-11 min-w-11',
  'data-testid': 'battle-error-close',
} as unknown as ButtonProps
const { data: lobby, error: lobbyError, reload } = useApi((signal) => fetchBattleLobby({ signal }))

const sel = reactive<BattleSelection>({
  questionType: 'biasa',
  openToAll: false,
  subjectId: null,
  pkskDomainId: null,
  pkskLevel: null,
  spmSubjectId: null,
})
const showMore = ref(false)
const showSpmTip = ref(false)
const showChallenge = ref(false)
const showInvitations = ref(false)
const invitations = ref<BattleInvitation[]>([])

const search = useBattleSearch({
  onMatched: (uuid) => void router.push(`/battle/arena/${uuid}`),
})

const coreSubjects = computed(() => lobby.value?.subjects.filter((s) => s.core) ?? [])
const moreSubjects = computed(() => lobby.value?.subjects.filter((s) => !s.core) ?? [])
const ready = computed(() => canStart(sel))
const busy = computed(() => search.loading.value || search.phase.value !== 'idle')
const params = computed(() => (ready.value ? matchParams(sel) : null))
const searching = computed(() => search.phase.value === 'searching')
const hideVisibility = computed(
  () =>
    search.phase.value === 'searching' ||
    search.phase.value === 'incoming' ||
    search.phase.value === 'waiting',
)

function setType(type: QuestionType): void {
  sel.questionType = type
}
function setLevel(level: PkskLevel): void {
  sel.pkskLevel = level
}

function startMode(mode: 'quick-match' | 'school-battle'): void {
  if (!ready.value || busy.value || params.value === null) return
  void search.start(mode, params.value)
}

function openChallenge(): void {
  if (ready.value) showChallenge.value = true
}

/** The three mode cards: Quick Match and Battle Sekolah need an idle search, Cabar Kawan only a selection. */
const modes = computed(() => [
  {
    testid: 'battle-quick-match',
    art: 'bolt' as const,
    title: 'Quick Match',
    text: 'Cari lawan rawak dari darjah yang sama',
    disabled: !ready.value || busy.value,
    run: () => startMode('quick-match'),
  },
  {
    testid: 'battle-challenge',
    art: 'party' as const,
    title: 'Cabar Kawan',
    text: 'Hantar cabaran kepada rakan anda',
    disabled: !ready.value,
    run: openChallenge,
  },
  {
    testid: 'battle-school-battle',
    art: 'cap' as const,
    title: 'Battle Sekolah',
    text: 'Lawan pelajar dari sekolah lain!',
    disabled: !ready.value || busy.value,
    run: () => startMode('school-battle'),
  },
])

const spmWrap = ref<HTMLElement | null>(null)
useClickOutside(spmWrap, () => (showSpmTip.value = false), { enabled: showSpmTip })

function goArena(uuid: string): void {
  showInvitations.value = false
  void router.push(`/battle/arena/${uuid}`)
}

/**
 * Test seam (dev and e2e builds only, the same `VITE_TEST_HOOKS` flag as `window.__mock`). DV-M16-06:
 * there is no live control that starts the waiting card, so the e2e suite drives it with a
 * `window` event. It is installed synchronously (before the first await) and removed on unmount.
 */
function onWaiting(event: Event): void {
  const d = (
    event as CustomEvent<{
      queueId: number
      name: string
      gradeLabel?: string
      join?: boolean
    }>
  ).detail
  if (d.join === true) void search.requestJoin(d.queueId, d.name, d.gradeLabel ?? '')
  else search.watchWaiting(d.queueId, d.name, d.gradeLabel ?? '')
}
const testHooks = import.meta.env.VITE_TEST_HOOKS === 'true'
onMounted(async () => {
  if (testHooks) window.addEventListener('m16:battle-waiting', onWaiting)
  try {
    const res = await fetchInvitations()
    const list = (res.body as { invitations?: BattleInvitation[] } | null)?.invitations
    if (Array.isArray(list) && list.length > 0) {
      invitations.value = list
      showInvitations.value = true
    }
  } catch {
    // the invitation list is optional: an error leaves the modal closed
  }
})
onBeforeUnmount(() => {
  if (testHooks) window.removeEventListener('m16:battle-waiting', onWaiting)
})
</script>

<template>
  <DsPage data-testid="battle-lobby">
    <DsStack v-if="!lobby && !lobbyError" aria-busy="true" data-testid="battle-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-48 w-full" />
    </DsStack>
    <DsLoadError
      v-else-if="lobbyError"
      message="Maaf, berlaku ralat. Sila cuba semula."
      testid="battle-load-error"
      @retry="reload()"
    />

    <template v-else-if="lobby">
      <UAlert
        v-if="search.errorMsg.value"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :description="search.errorMsg.value"
        :close="errorClose"
        data-testid="battle-error"
        @update:open="search.clearError()"
      />

      <UCard>
        <DsCluster gap="md" justify="between" :wrap="false">
          <DsStack gap="2xs">
            <DsCluster gap="xs">
              <DsHeading :level="2" variant="title">Battle Arena</DsHeading>
              <UBadge color="warning" variant="solid" size="md">BARU</UBadge>
            </DsCluster>
            <DsText variant="body" tone="muted" class="max-w-prose">
              Cabar kawan, cari lawan, atau wakili sekolah anda!
            </DsText>
          </DsStack>
          <DsArt3D name="fire" size="hero" float class="hidden sm:block" />
        </DsCluster>
      </UCard>

      <!-- Question type, subjects, domains -->
      <UCard>
        <DsGrid :cols="3" gap="xs" data-testid="battle-type-row">
          <UButton
            size="xl"
            :color="sel.questionType === 'biasa' ? 'primary' : 'neutral'"
            :variant="sel.questionType === 'biasa' ? 'solid' : 'soft'"
            icon="i-ph-book-open-duotone"
            class="min-h-12 justify-center"
            :aria-pressed="sel.questionType === 'biasa'"
            data-testid="battle-type-biasa"
            @click="setType('biasa')"
          >
            Biasa
          </UButton>
          <UButton
            size="xl"
            :color="sel.questionType === 'pksk' ? 'primary' : 'neutral'"
            :variant="sel.questionType === 'pksk' ? 'solid' : 'soft'"
            icon="i-ph-shield-check-duotone"
            class="min-h-12 justify-center"
            :aria-pressed="sel.questionType === 'pksk'"
            data-testid="battle-type-pksk"
            @click="setType('pksk')"
          >
            PKSK
          </UButton>
          <div ref="spmWrap">
            <UButton
              v-if="lobby.spmUnlocked"
              size="xl"
              :color="sel.questionType === 'spm' ? 'primary' : 'neutral'"
              :variant="sel.questionType === 'spm' ? 'solid' : 'soft'"
              icon="i-ph-graduation-cap-duotone"
              class="min-h-12 w-full justify-center"
              :aria-pressed="sel.questionType === 'spm'"
              data-testid="battle-type-spm"
              @click="setType('spm')"
            >
              SPM
            </UButton>
            <UButton
              v-else
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-graduation-cap-duotone"
              trailing-icon="i-ph-lock-duotone"
              class="min-h-12 w-full justify-center"
              data-testid="battle-type-spm"
              @click="showSpmTip = !showSpmTip"
            >
              SPM
            </UButton>
          </div>
        </DsGrid>
        <UAlert
          v-if="showSpmTip"
          color="neutral"
          variant="subtle"
          icon="i-ph-info-duotone"
          description="Khas untuk pelajar Tingkatan 4 &amp; 5 sahaja"
          class="mt-3"
          data-testid="battle-spm-tip"
        />

        <!-- Biasa -->
        <div v-if="sel.questionType === 'biasa'" class="mt-4" data-testid="battle-panel-biasa">
          <p class="mb-2 text-overline text-muted">Subjek Teras</p>
          <DsGrid :cols="{ base: 2, sm: 3, md: 4 }" gap="xs">
            <UButton
              v-for="s in showMore ? lobby.subjects : coreSubjects"
              :key="s.id"
              size="lg"
              :color="sel.subjectId === s.id ? 'primary' : 'neutral'"
              :variant="sel.subjectId === s.id ? 'solid' : 'soft'"
              icon="i-ph-book-bookmark-duotone"
              class="min-h-12 justify-start text-start"
              :aria-pressed="sel.subjectId === s.id"
              data-testid="battle-subject"
              @click="sel.subjectId = s.id"
            >
              {{ s.name }}
            </UButton>
          </DsGrid>
          <UButton
            v-if="moreSubjects.length > 0"
            color="primary"
            variant="link"
            size="lg"
            class="mt-2 min-h-11"
            :trailing-icon="showMore ? 'i-ph-caret-up-bold' : 'i-ph-caret-down-bold'"
            data-testid="battle-toggle-more"
            @click="showMore = !showMore"
          >
            {{ showMore ? 'Tutup' : `Lagi ${moreSubjects.length} subjek lain` }}
          </UButton>
        </div>

        <!-- PKSK -->
        <div
          v-else-if="sel.questionType === 'pksk'"
          class="mt-4 flex flex-col gap-4"
          data-testid="battle-panel-pksk"
        >
          <div>
            <p class="mb-2 text-overline text-muted">Pilih Domain PKSK</p>
            <DsGrid :cols="{ base: 2, sm: 3 }" gap="xs">
              <UButton
                v-for="d in lobby.pkskDomains"
                :key="d.id"
                size="lg"
                :color="sel.pkskDomainId === d.id ? 'primary' : 'neutral'"
                :variant="sel.pkskDomainId === d.id ? 'solid' : 'soft'"
                icon="i-ph-shield-check-duotone"
                class="min-h-12 justify-start text-start"
                :aria-pressed="sel.pkskDomainId === d.id"
                data-testid="battle-domain"
                @click="sel.pkskDomainId = d.id"
              >
                {{ d.name }}
              </UButton>
            </DsGrid>
          </div>
          <div>
            <p class="mb-2 text-overline text-muted">Pilih Tahap</p>
            <DsGrid :cols="2" gap="xs">
              <UButton
                size="lg"
                :color="sel.pkskLevel === 'T1' ? 'primary' : 'neutral'"
                :variant="sel.pkskLevel === 'T1' ? 'solid' : 'soft'"
                icon="i-ph-plant-duotone"
                class="min-h-12 justify-center"
                :aria-pressed="sel.pkskLevel === 'T1'"
                data-testid="battle-level-t1"
                @click="setLevel('T1')"
              >
                Tingkatan 1
              </UButton>
              <UButton
                size="lg"
                :color="sel.pkskLevel === 'T4' ? 'primary' : 'neutral'"
                :variant="sel.pkskLevel === 'T4' ? 'solid' : 'soft'"
                icon="i-ph-tree-duotone"
                class="min-h-12 justify-center"
                :aria-pressed="sel.pkskLevel === 'T4'"
                data-testid="battle-level-t4"
                @click="setLevel('T4')"
              >
                Tingkatan 4
              </UButton>
            </DsGrid>
          </div>
        </div>

        <!-- SPM (unlocked accounts; layout PROPOSED, in the Biasa tile style) -->
        <div v-else class="mt-4" data-testid="battle-panel-spm">
          <p class="mb-2 text-overline text-muted">Subjek SPM</p>
          <DsGrid :cols="{ base: 2, sm: 3, md: 4 }" gap="xs">
            <UButton
              v-for="s in lobby.spmSubjects ?? []"
              :key="s.id"
              size="lg"
              :color="sel.spmSubjectId === s.id ? 'primary' : 'neutral'"
              :variant="sel.spmSubjectId === s.id ? 'solid' : 'soft'"
              class="min-h-12 justify-center text-center"
              :aria-pressed="sel.spmSubjectId === s.id"
              data-testid="battle-spm-subject"
              @click="sel.spmSubjectId = s.id"
            >
              {{ s.name }}
            </UButton>
          </DsGrid>
        </div>
      </UCard>

      <!-- Searching / incoming / waiting -->
      <UCard v-if="searching" data-testid="battle-searching">
        <DsStack gap="xs" align="center" class="text-center">
          <DsArt3D name="bolt" size="hero" float />
          <DsHeading :level="3">Mencari Lawan...</DsHeading>
          <DsText variant="body" tone="muted">
            {{
              sel.openToAll
                ? 'Menunggu pelajar dari mana-mana gred'
                : 'Menunggu pelajar sama darjah & subjek'
            }}
          </DsText>
          <DsText variant="title" tone="primary" tabular data-testid="battle-timer">
            {{ search.elapsedText.value }}
          </DsText>
          <UButton
            color="neutral"
            variant="soft"
            size="xl"
            icon="i-ph-x-bold"
            class="min-h-12"
            data-testid="battle-cancel"
            @click="search.cancel()"
          >
            Batal
          </UButton>
        </DsStack>
      </UCard>
      <UCard
        v-else-if="search.phase.value === 'incoming' && search.challenger.value"
        data-testid="battle-incoming"
      >
        <DsStack gap="xs" align="center" class="text-center">
          <DsIconChip icon="user-plus" accent="heat" size="lg" />
          <DsHeading :level="3">Cabaran Masuk!</DsHeading>
          <DsText variant="body" tone="muted">
            {{ search.challenger.value.name }} ingin menyertai battle anda
          </DsText>
          <DsCluster gap="xs" align="stretch" justify="center">
            <UBadge color="neutral" variant="soft" size="lg">{{
              search.challenger.value.grade_label
            }}</UBadge>
            <UBadge color="neutral" variant="soft" size="lg">{{
              search.challenger.value.school
            }}</UBadge>
          </DsCluster>
          <p class="flex items-start justify-center gap-2 text-caption text-muted">
            <UIcon name="i-ph-info-duotone" class="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.</span>
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-3">
            <UButton
              color="success"
              size="xl"
              icon="i-ph-check-bold"
              class="min-h-12"
              data-testid="battle-incoming-accept"
              @click="search.respond(true)"
            >
              Terima
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="xl"
              icon="i-ph-x-bold"
              class="min-h-12"
              data-testid="battle-incoming-reject"
              @click="search.respond(false)"
            >
              Tolak
            </UButton>
          </div>
        </DsStack>
      </UCard>
      <UCard v-else-if="search.phase.value === 'waiting'" data-testid="battle-waiting">
        <DsStack gap="xs" align="center" class="text-center">
          <DsArt3D name="party" size="hero" float />
          <DsHeading :level="3">Menunggu Kelulusan...</DsHeading>
          <DsText variant="body" tone="muted">
            Menunggu {{ search.waitingName.value }} menerima permohonan anda
          </DsText>
          <DsText v-if="search.waitingGrade.value" variant="caption">
            {{ search.waitingGrade.value }}
          </DsText>
          <UButton
            color="neutral"
            variant="soft"
            size="xl"
            icon="i-ph-x-bold"
            class="min-h-12"
            data-testid="battle-waiting-cancel"
            @click="search.cancel()"
          >
            Batal
          </UButton>
        </DsStack>
      </UCard>

      <!-- Visibility -->
      <UCard v-if="!hideVisibility" data-testid="battle-visibility">
        <DsCluster justify="between" :wrap="false">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-globe-duotone" class="size-5 shrink-0" aria-hidden="true" />
              Keterlihatan Barisan
            </p>
            <p class="mt-1 text-caption text-muted" data-testid="battle-visibility-text">
              {{
                sel.openToAll
                  ? 'Semua gred boleh nampak & mohon sertai anda'
                  : 'Hanya pelajar gred sama boleh match'
              }}
            </p>
          </div>
          <USwitch
            v-model="sel.openToAll"
            class="min-h-11 shrink-0"
            data-testid="battle-visibility-switch"
          >
            <template #label>
              <span class="text-caption" data-testid="battle-visibility-label">{{
                sel.openToAll ? 'Terbuka' : 'Gred Saya'
              }}</span>
            </template>
          </USwitch>
        </DsCluster>
      </UCard>

      <!-- Mode buttons (disabled until a selection is complete) -->
      <DsGrid :cols="{ base: 1, md: 3 }">
        <UCard v-for="m in modes" :key="m.testid" :ui="{ body: 'p-0 sm:p-0' }" class="h-full">
          <UButton
            color="neutral"
            variant="ghost"
            block
            class="h-full min-h-14 flex-col items-start gap-1 p-4 text-start"
            :disabled="m.disabled"
            :data-testid="m.testid"
            @click="m.run"
          >
            <DsArt3D :name="m.art" size="lg" />
            <span class="mt-2 block text-subheading text-highlighted">{{ m.title }}</span>
            <DsText variant="body" as="span" tone="muted" class="block">{{ m.text }}</DsText>
          </UButton>
        </UCard>
      </DsGrid>

      <!-- Ranking links -->
      <DsGrid :cols="2">
        <UButton
          to="/battle/leaderboard"
          color="neutral"
          variant="soft"
          size="xl"
          icon="i-ph-medal-duotone"
          class="min-h-14 justify-center"
          data-testid="battle-link-students"
        >
          Ranking Pelajar
        </UButton>
        <UButton
          to="/battle/ranking-sekolah"
          color="neutral"
          variant="soft"
          size="xl"
          icon="i-ph-student-duotone"
          class="min-h-14 justify-center"
          data-testid="battle-link-schools"
        >
          Ranking Sekolah
        </UButton>
      </DsGrid>

      <ChallengeFriendModal
        v-model:open="showChallenge"
        :params="params ?? { question_type: 'biasa', open_to_all: false }"
      />
      <InvitationsModal
        v-model:open="showInvitations"
        v-model:invitations="invitations"
        @matched="goArena"
      />
    </template>
  </DsPage>
</template>
