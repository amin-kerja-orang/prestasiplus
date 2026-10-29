<script setup lang="ts">
/**
 * `/password/reset` entry (SW8-07b). The v2 API mails `/password/reset#token=...&email=...` with the
 * token in the URL FRAGMENT only, so it never reaches a server, a log or a Referer header. With a
 * token in the fragment this shows S4 (the reset form) with the token held in component state; the
 * fragment is read when it arrives (also when it changes later in the same tab) and scrubbed from
 * the address bar at once (`router.replace`, hash dropped; the token never enters the path or the query). The e-mail in the fragment pre-fills the form.
 * Without a token in the fragment this is S3 (`PasswordForgotPage`), exactly as before. The path
 * route `/password/reset/:token` is untouched and renders S4 itself.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { formatTabTitle } from '@/composables/tabTitle'

import PasswordForgotPage from './PasswordForgotPage.vue'
import PasswordResetPage from './PasswordResetPage.vue'

const RESET_TITLE = formatTabTitle('Reset Kata Laluan')

const route = useRoute()
const router = useRouter()

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The fragment as `key -> value`. vue-router has already percent-decoded `route.hash`, which would
 * make `%26` / `%2B` in a value ambiguous, so the browser's raw hash is parsed when there is one.
 * Values are percent-decoded only (`+` is a plus, as `encodeURIComponent` in the mail writes it).
 */
function fragmentParams(): Map<string, string> {
  const raw = typeof window === 'undefined' ? '' : window.location.hash
  const fromBrowser = raw.length > 1
  const text = (fromBrowser ? raw : route.hash).replace(/^#/, '')
  const out = new Map<string, string>()
  for (const part of text.split('&')) {
    const at = part.indexOf('=')
    const key = at < 0 ? part : part.slice(0, at)
    const value = at < 0 ? '' : part.slice(at + 1)
    if (key !== '' && !out.has(key)) out.set(key, fromBrowser ? decode(value) : value)
  }
  return out
}

const token = ref('')
const email = ref<string | undefined>(undefined)
const showReset = computed(() => token.value !== '')

/**
 * Takes a token link from the current fragment, if it has a `token` key. Returns whether it did,
 * i.e. whether the fragment must be scrubbed. An empty token changes nothing (S3 stays S3, an open
 * form stays as it is). The fragment is read when it arrives, so the scrub (an empty hash) is
 * ignored here and cannot flip S4 back to S3.
 */
function takeFragment(): boolean {
  const params = fragmentParams()
  if (!params.has('token')) return false
  const next = (params.get('token') ?? '').trim()
  if (next !== '') {
    token.value = next
    email.value = params.get('email')
  }
  return true
}

function scrub(): void {
  void router
    .replace({ path: route.path, query: route.query, hash: '' })
    // The after-each hook puts the S3 title back; the reset form keeps the S4 title.
    .then(() => {
      if (showReset.value) document.title = RESET_TITLE
    })
}

// First load: read in setup so the form renders at once; scrub once mounted.
const fromLoad = takeFragment()
onMounted(() => {
  if (fromLoad) scrub()
})
// A later hash-only change in the same tab (a link pasted into the address bar).
watch(
  () => route.hash,
  () => {
    // The scrub itself ends here (an empty hash): nothing to take, nothing to scrub, no loop.
    if (route.hash !== '' && takeFragment()) scrub()
  },
)
</script>

<template>
  <PasswordResetPage
    v-if="showReset"
    :key="`${token}|${email ?? ''}`"
    :token="token"
    :email="email"
  />
  <PasswordForgotPage v-else />
</template>
