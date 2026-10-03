<script setup lang="ts">
/**
 * S16 `/gamification/referral` "Rujuk Kawan, Dapat Syiling!" (M14-T2b; FR-M14-56..59, BR-M14-18/19;
 * FN-M14-7.1.*). Reward tiles (50 / 25), the viewer's code with "Salin Kod" ("✓ Disalin!"),
 * WhatsApp and Telegram links (new tab), "Salin Link" ("✓ Link Disalin!") and the three statistics.
 * A copied label stays until the page is reloaded (as live).
 */
import { Copy, Link } from '@lucide/vue'
import { ref } from 'vue'

import { useApi } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchReferral } from '../../api'
import BrandTelegramIcon from '../../components/student-b/BrandTelegramIcon.vue'
import BrandWhatsAppIcon from '../../components/student-b/BrandWhatsAppIcon.vue'
import StudentBLoadState from '../../components/student-b/StudentBLoadState.vue'
import { REFERRAL_COPY } from '../../lib/student/referral-lib'
import { copyText } from '../../lib/student/studentb-share'

const { data, error, reload } = useApi((signal) => fetchReferral({ signal }))

const codeCopied = ref(false)
const linkCopied = ref(false)

async function copyCode(): Promise<void> {
  if (!data.value) return
  await copyText(data.value.code)
  codeCopied.value = true
}

async function copyLink(): Promise<void> {
  if (!data.value) return
  await copyText(data.value.registerUrl)
  linkCopied.value = true
}

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm'
</script>

<template>
  <div class="space-y-5" data-testid="referral-page">
    <template v-if="data">
      <section
        class="rounded-2xl bg-linear-to-br from-emerald-600 to-emerald-400 px-5 py-5 text-center text-white shadow-lg"
        data-testid="referral-hero"
      >
        <h1 class="font-heading text-2xl font-bold text-white">{{ REFERRAL_COPY.title }}</h1>
        <p class="mt-1 text-sm text-white/95">{{ REFERRAL_COPY.subtitle }}</p>
      </section>

      <div class="grid grid-cols-2 gap-3 sm:gap-5" data-testid="referral-tiles">
        <div class="rounded-2xl bg-white p-4 text-center shadow-sm sm:p-6">
          <div class="text-4xl" aria-hidden="true">🎁</div>
          <div class="mt-2 font-heading text-3xl font-bold text-amber-500" data-testid="reward-you">
            {{ data.rewardReferrer }}
          </div>
          <div class="mt-1 text-sm text-slate-600">{{ REFERRAL_COPY.forYou }}</div>
        </div>
        <div class="rounded-2xl bg-white p-4 text-center shadow-sm sm:p-6">
          <div class="text-4xl" aria-hidden="true">👋</div>
          <div
            class="mt-2 font-heading text-3xl font-bold text-amber-500"
            data-testid="reward-friend"
          >
            {{ data.rewardReferee }}
          </div>
          <div class="mt-1 text-sm text-slate-600">{{ REFERRAL_COPY.forFriend }}</div>
        </div>
      </div>

      <section
        class="rounded-2xl border-2 border-dashed border-emerald-500 p-5 text-center sm:p-6"
        data-testid="referral-code-box"
      >
        <div class="text-sm text-slate-600">{{ REFERRAL_COPY.codeLabel }}</div>
        <div
          class="mx-auto mt-3 inline-block max-w-full rounded-xl bg-emerald-100 px-6 py-3 font-heading text-2xl font-bold tracking-[0.25em] wrap-anywhere text-emerald-700 sm:text-3xl"
          data-testid="referral-code"
        >
          {{ data.code }}
        </div>
        <div class="mt-3">
          <button
            type="button"
            :class="[BUTTON, 'bg-emerald-600']"
            data-testid="referral-copy-code"
            @click="copyCode"
          >
            <Copy class="h-4 w-4" aria-hidden="true" />
            {{ codeCopied ? REFERRAL_COPY.copiedCode : REFERRAL_COPY.copyCode }}
          </button>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-center gap-3">
          <a
            :href="data.whatsappUrl"
            target="_blank"
            rel="noopener noreferrer"
            :class="[BUTTON, 'bg-green-500']"
            data-testid="referral-whatsapp"
          >
            <BrandWhatsAppIcon class="h-4 w-4" />
            {{ REFERRAL_COPY.whatsapp }}
          </a>
          <a
            :href="data.telegramUrl"
            target="_blank"
            rel="noopener noreferrer"
            :class="[BUTTON, 'bg-sky-600']"
            data-testid="referral-telegram"
          >
            <BrandTelegramIcon class="h-4 w-4" />
            {{ REFERRAL_COPY.telegram }}
          </a>
          <button
            type="button"
            :class="[BUTTON, 'bg-slate-500']"
            data-testid="referral-copy-link"
            @click="copyLink"
          >
            <Link class="h-4 w-4" aria-hidden="true" />
            {{ linkCopied ? REFERRAL_COPY.copiedLink : REFERRAL_COPY.copyLink }}
          </button>
        </div>
      </section>

      <section class="rounded-2xl bg-white p-5 shadow-sm sm:p-6" data-testid="referral-stats">
        <h3 class="font-heading text-lg font-bold text-slate-800">
          {{ REFERRAL_COPY.statsTitle }}
        </h3>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="min-w-0">
            <div
              class="font-heading text-2xl font-bold text-slate-800"
              data-testid="stat-referrals"
            >
              {{ formatNumber(data.stats.referrals) }}
            </div>
            <div class="text-xs text-slate-500 sm:text-sm">{{ REFERRAL_COPY.referrals }}</div>
          </div>
          <div class="min-w-0">
            <div class="font-heading text-2xl font-bold text-slate-800" data-testid="stat-rewarded">
              {{ formatNumber(data.stats.rewarded) }}
            </div>
            <div class="text-xs text-slate-500 sm:text-sm">{{ REFERRAL_COPY.rewarded }}</div>
          </div>
          <div class="min-w-0">
            <div class="font-heading text-2xl font-bold text-slate-800" data-testid="stat-earned">
              {{ formatNumber(data.stats.syilingEarned) }}
            </div>
            <div class="text-xs text-slate-500 sm:text-sm">{{ REFERRAL_COPY.earned }}</div>
          </div>
        </div>
      </section>
    </template>
    <StudentBLoadState
      v-else
      :error="error !== null"
      :message="REFERRAL_COPY.loadError"
      :retry-label="REFERRAL_COPY.retry"
      test-key="referral"
      @retry="reload()"
    />
  </div>
</template>
