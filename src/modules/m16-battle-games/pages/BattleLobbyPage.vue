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
import {
  ChevronDown,
  ChevronUp,
  Globe,
  GraduationCap,
  Info,
  Lock,
  Medal,
  School,
  ShieldHalf,
  Sprout,
  TreeDeciduous,
  Book,
  Check,
  Users,
  X,
  Zap,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { AppIcon } from '@/components/icon'
import { useApi, useClickOutside } from '@/composables'

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

function typeBtn(active: boolean, gradient: string): string {
  return active
    ? `bg-gradient-to-r ${gradient} text-white shadow-md`
    : 'border-2 border-slate-200 bg-white text-slate-600 hover:border-slate-300'
}

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

const spmWrap = ref<HTMLElement | null>(null)
useClickOutside(spmWrap, () => (showSpmTip.value = false), { enabled: showSpmTip })

function goArena(uuid: string): void {
  showInvitations.value = false
  void router.push(`/battle/arena/${uuid}`)
}

onMounted(async () => {
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
  window.addEventListener('m16:battle-waiting', onWaiting)
})
onBeforeUnmount(() => window.removeEventListener('m16:battle-waiting', onWaiting))

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
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-4" data-testid="battle-lobby">
    <div v-if="!lobby && !lobbyError" class="flex justify-center py-10 text-slate-400">
      <LoadingSpinner :size="28" />
    </div>
    <div v-else-if="lobbyError" class="space-y-3" data-testid="battle-load-error">
      <AlertBox messages="Maaf, berlaku ralat. Sila cuba semula." />
      <button
        type="button"
        class="min-h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <template v-else-if="lobby">
      <div
        v-if="search.errorMsg.value"
        class="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700"
        data-testid="battle-error"
      >
        <span class="min-w-0 flex-1 break-words">{{ search.errorMsg.value }}</span>
        <button
          type="button"
          class="-m-2 flex h-11 w-11 shrink-0 items-center justify-center"
          data-testid="battle-error-close"
          @click="search.clearError()"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Hero -->
      <div class="rounded-3xl bg-gradient-to-r from-red-500 to-orange-500 p-5 text-white shadow-lg">
        <div class="flex items-center gap-3">
          <Zap class="h-8 w-8 shrink-0" />
          <h2 class="text-2xl font-bold">Battle Arena</h2>
          <span class="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold">BARU</span>
        </div>
        <p class="mt-2 text-sm text-white/90">Cabar kawan, cari lawan, atau wakili sekolah anda!</p>
      </div>

      <!-- Question type -->
      <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div class="flex gap-2" data-testid="battle-type-row">
          <button
            type="button"
            class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition"
            :class="typeBtn(sel.questionType === 'biasa', 'from-red-500 to-orange-500')"
            data-testid="battle-type-biasa"
            @click="setType('biasa')"
          >
            <Book class="h-4 w-4" /> Biasa
          </button>
          <button
            type="button"
            class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition"
            :class="typeBtn(sel.questionType === 'pksk', 'from-indigo-500 to-purple-500')"
            data-testid="battle-type-pksk"
            @click="setType('pksk')"
          >
            <ShieldHalf class="h-4 w-4" /> PKSK
          </button>
          <div ref="spmWrap" class="relative shrink-0">
            <button
              v-if="lobby.spmUnlocked"
              type="button"
              class="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition"
              :class="typeBtn(sel.questionType === 'spm', 'from-red-500 to-orange-500')"
              data-testid="battle-type-spm"
              @click="setType('spm')"
            >
              <GraduationCap class="h-4 w-4" /> SPM
            </button>
            <button
              v-else
              type="button"
              class="flex min-h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-3 text-sm font-bold text-slate-400 opacity-60"
              data-testid="battle-type-spm"
              @click="showSpmTip = !showSpmTip"
            >
              <GraduationCap class="h-4 w-4" /> SPM <Lock class="h-3.5 w-3.5" />
            </button>
            <div
              v-if="showSpmTip"
              class="absolute top-full right-0 z-10 mt-2 flex w-56 items-start gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs text-white shadow-lg"
              data-testid="battle-spm-tip"
            >
              <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Khas untuk pelajar Tingkatan 4 &amp; 5 sahaja</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Biasa panel -->
      <div
        v-if="sel.questionType === 'biasa'"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="battle-panel-biasa"
      >
        <p class="mb-3 text-xs font-bold text-slate-500 uppercase">Subjek Teras</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          <button
            v-for="s in coreSubjects"
            :key="s.id"
            type="button"
            class="flex min-h-11 flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition"
            :class="
              sel.subjectId === s.id
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            "
            data-testid="battle-subject"
            @click="sel.subjectId = s.id"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl"
              :style="{ backgroundColor: `${s.colour}20`, color: s.colour }"
            >
              <AppIcon :name="s.icon" class="h-5 w-5" />
            </span>
            <span class="text-xs font-semibold text-slate-700">{{ s.name }}</span>
          </button>
        </div>
        <template v-if="moreSubjects.length > 0">
          <div v-if="showMore" class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            <button
              v-for="s in moreSubjects"
              :key="s.id"
              type="button"
              class="flex min-h-11 flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition"
              :class="
                sel.subjectId === s.id
                  ? 'border-red-500 bg-red-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              "
              data-testid="battle-subject"
              @click="sel.subjectId = s.id"
            >
              <span
                class="flex h-10 w-10 items-center justify-center rounded-xl"
                :style="{ backgroundColor: `${s.colour}20`, color: s.colour }"
              >
                <AppIcon :name="s.icon" class="h-5 w-5" />
              </span>
              <span class="text-xs font-semibold text-slate-700">{{ s.name }}</span>
            </button>
          </div>
          <button
            type="button"
            class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50"
            data-testid="battle-toggle-more"
            @click="showMore = !showMore"
          >
            <template v-if="showMore"><ChevronUp class="h-4 w-4" /> Tutup</template>
            <template v-else
              ><ChevronDown class="h-4 w-4" /> Lagi {{ moreSubjects.length }} subjek lain</template
            >
          </button>
        </template>
      </div>

      <!-- PKSK panel -->
      <div
        v-else-if="sel.questionType === 'pksk'"
        class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="battle-panel-pksk"
      >
        <div>
          <p class="mb-3 text-xs font-bold text-slate-500 uppercase">Pilih Domain PKSK</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="d in lobby.pkskDomains"
              :key="d.id"
              type="button"
              class="flex min-h-11 items-center gap-2 rounded-xl p-2.5 text-left text-xs font-semibold transition"
              :class="
                sel.pkskDomainId === d.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              "
              data-testid="battle-domain"
              @click="sel.pkskDomainId = d.id"
            >
              <AppIcon
                :name="d.icon"
                class="h-4 w-4 shrink-0"
                :style="sel.pkskDomainId === d.id ? undefined : { color: d.colour }"
              />
              <span class="min-w-0">{{ d.name }}</span>
            </button>
          </div>
        </div>
        <div>
          <p class="mb-3 text-xs font-bold text-slate-500 uppercase">Pilih Tahap</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex min-h-11 items-center justify-center gap-2 rounded-xl p-2.5 text-sm font-semibold transition"
              :class="
                sel.pkskLevel === 'T1'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              "
              data-testid="battle-level-t1"
              @click="setLevel('T1')"
            >
              <Sprout class="h-4 w-4" /> Tingkatan 1
            </button>
            <button
              type="button"
              class="flex min-h-11 items-center justify-center gap-2 rounded-xl p-2.5 text-sm font-semibold transition"
              :class="
                sel.pkskLevel === 'T4'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              "
              data-testid="battle-level-t4"
              @click="setLevel('T4')"
            >
              <TreeDeciduous class="h-4 w-4" /> Tingkatan 4
            </button>
          </div>
        </div>
      </div>

      <!-- SPM panel (unlocked accounts; layout PROPOSED) -->
      <div
        v-else
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="battle-panel-spm"
      >
        <p class="mb-3 text-xs font-bold text-slate-500 uppercase">Subjek SPM</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          <button
            v-for="s in lobby.spmSubjects ?? []"
            :key="s.id"
            type="button"
            class="flex min-h-11 items-center justify-center rounded-xl border-2 p-3 text-center text-xs font-semibold text-slate-700 transition"
            :class="
              sel.spmSubjectId === s.id
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            "
            data-testid="battle-spm-subject"
            @click="sel.spmSubjectId = s.id"
          >
            {{ s.name }}
          </button>
        </div>
      </div>

      <!-- Searching / incoming / waiting -->
      <div
        v-if="searching"
        class="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-center"
        data-testid="battle-searching"
      >
        <div class="flex justify-center text-orange-500"><LoadingSpinner :size="32" /></div>
        <h3 class="mt-3 text-lg font-bold text-slate-800">Mencari Lawan...</h3>
        <p class="mt-1 text-sm text-slate-600">
          {{
            sel.openToAll
              ? 'Menunggu pelajar dari mana-mana gred'
              : 'Menunggu pelajar sama darjah & subjek'
          }}
        </p>
        <p class="mt-2 text-2xl font-bold text-orange-600" data-testid="battle-timer">
          {{ search.elapsedText.value }}
        </p>
        <button
          type="button"
          class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          data-testid="battle-cancel"
          @click="search.cancel()"
        >
          <X class="h-4 w-4" /> Batal
        </button>
      </div>
      <div
        v-else-if="search.phase.value === 'incoming' && search.challenger.value"
        class="rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center"
        data-testid="battle-incoming"
      >
        <h3 class="text-lg font-bold text-slate-800">Cabaran Masuk!</h3>
        <p class="mt-1 text-sm text-slate-600">
          {{ search.challenger.value.name }} ingin menyertai battle anda
        </p>
        <div class="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold">
          <span class="rounded-full bg-white px-3 py-1 text-slate-700">{{
            search.challenger.value.grade_label
          }}</span>
          <span class="rounded-full bg-white px-3 py-1 text-slate-700">{{
            search.challenger.value.school
          }}</span>
        </div>
        <p class="mt-3 flex items-start justify-center gap-2 text-xs text-slate-500">
          <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.</span>
        </p>
        <div class="mt-3 flex justify-center gap-3">
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-500 px-5 text-sm font-bold text-white hover:bg-green-600"
            data-testid="battle-incoming-accept"
            @click="search.respond(true)"
          >
            <Check class="h-4 w-4" /> Terima
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-300"
            data-testid="battle-incoming-reject"
            @click="search.respond(false)"
          >
            <X class="h-4 w-4" /> Tolak
          </button>
        </div>
      </div>
      <div
        v-else-if="search.phase.value === 'waiting'"
        class="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-center"
        data-testid="battle-waiting"
      >
        <div class="flex justify-center text-blue-500"><LoadingSpinner :size="32" /></div>
        <h3 class="mt-3 text-lg font-bold text-slate-800">Menunggu Kelulusan...</h3>
        <p class="mt-1 text-sm text-slate-600">
          Menunggu {{ search.waitingName.value }} menerima permohonan anda
        </p>
        <p v-if="search.waitingGrade.value" class="mt-1 text-xs text-slate-500">
          {{ search.waitingGrade.value }}
        </p>
        <button
          type="button"
          class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          data-testid="battle-waiting-cancel"
          @click="search.cancel()"
        >
          <X class="h-4 w-4" /> Batal
        </button>
      </div>

      <!-- Visibility -->
      <div
        v-if="!hideVisibility"
        class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="battle-visibility"
      >
        <Globe class="h-6 w-6 shrink-0 text-blue-500" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-slate-800">Keterlihatan Barisan</p>
          <p class="text-xs text-slate-500" data-testid="battle-visibility-text">
            {{
              sel.openToAll
                ? 'Semua gred boleh nampak & mohon sertai anda'
                : 'Hanya pelajar gred sama boleh match'
            }}
          </p>
        </div>
        <label class="flex min-h-11 shrink-0 cursor-pointer items-center gap-2">
          <span
            class="text-xs font-semibold"
            :class="sel.openToAll ? 'text-blue-600' : 'text-slate-600'"
            data-testid="battle-visibility-label"
            >{{ sel.openToAll ? 'Terbuka' : 'Gred Saya' }}</span
          >
          <input
            v-model="sel.openToAll"
            type="checkbox"
            class="peer sr-only"
            data-testid="battle-visibility-switch"
          />
          <span
            class="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-500 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
          />
        </label>
      </div>

      <!-- Mode buttons -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          class="flex min-h-14 flex-col items-center gap-1 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!ready || busy"
          data-testid="battle-quick-match"
          @click="startMode('quick-match')"
        >
          <Zap class="h-6 w-6" />
          <span class="text-base font-bold">Quick Match</span>
          <span class="text-xs text-white/90">Cari lawan rawak dari darjah yang sama</span>
        </button>
        <button
          type="button"
          class="flex min-h-14 flex-col items-center gap-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!ready"
          data-testid="battle-challenge"
          @click="openChallenge"
        >
          <Users class="h-6 w-6" />
          <span class="text-base font-bold">Cabar Kawan</span>
          <span class="text-xs text-white/90">Hantar cabaran kepada rakan anda</span>
        </button>
        <button
          type="button"
          class="flex min-h-14 flex-col items-center gap-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!ready || busy"
          data-testid="battle-school-battle"
          @click="startMode('school-battle')"
        >
          <School class="h-6 w-6" />
          <span class="text-base font-bold">Battle Sekolah</span>
          <span class="text-xs text-white/90">Lawan pelajar dari sekolah lain!</span>
        </button>
      </div>

      <!-- Ranking links -->
      <div class="grid grid-cols-2 gap-3">
        <RouterLink
          to="/battle/leaderboard"
          class="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          data-testid="battle-link-students"
        >
          <Medal class="h-5 w-5 text-amber-500" /> Ranking Pelajar
        </RouterLink>
        <RouterLink
          to="/battle/ranking-sekolah"
          class="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          data-testid="battle-link-schools"
        >
          <School class="h-5 w-5 text-blue-500" /> Ranking Sekolah
        </RouterLink>
      </div>

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
  </div>
</template>
