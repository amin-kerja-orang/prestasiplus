<script setup lang="ts">
/**
 * S5 `/cikgu/essay/baharu` essay form (FR-M13-51..55; URS FT-M13-4.2). Client only: "Hantar ke Cikgu
 * Alesa" (`type=button`) trims the fields, alerts when the essay is under 50 characters, otherwise
 * stores the essay in `sessionStorage.cikgu_pending_essay` and opens S1 with the hand-off query. The
 * form has no action and no control has a `name`; Enter does nothing (no submit button).
 */
import { Bot } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { alertNative } from '@/components/overlay/native-dialogs'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'

import { RUBRICS } from '../api'
import { PENDING_ESSAY_KEY } from '../components/chat/chat-lib'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { handoffQuery, wordCount } from '../components/teacher/lib'

const router = useRouter()

const rubric = ref(RUBRICS[0]?.key ?? 'spm_bm_karangan')
const subject = ref('')
const level = ref('')
const student = ref('')
const title = ref('')
const essay = ref('')

const words = computed(() => wordCount(essay.value))

function submitToChat(): void {
  const text = essay.value.trim()
  if (text.length < 50) {
    alertNative(C.tooShort)
    return
  }
  try {
    sessionStorage.setItem(PENDING_ESSAY_KEY, text)
  } catch {
    /* storage unavailable: S1 then opens with an empty input (as without a stored essay) */
  }
  void router.push(
    `/cikgu?${handoffQuery({
      rubric: rubric.value,
      subject: subject.value.trim(),
      level: level.value.trim(),
      student: student.value.trim(),
      title: title.value.trim(),
    })}`,
  )
}

const LABEL = 'mb-1 block text-sm font-semibold text-slate-700'
const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center text-sm font-semibold'
</script>

<template>
  <div class="mx-auto min-w-0 max-w-3xl space-y-4" data-testid="essay-form-page">
    <RouterLink
      to="/cikgu/essay"
      class="inline-flex min-h-11 items-center text-sm font-medium text-purple-600 hover:underline"
      data-testid="essay-back"
      >{{ C.back }}</RouterLink
    >

    <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <h1 class="font-heading text-xl font-bold text-slate-800">{{ C.formTitle }}</h1>
      <p class="mt-1 mb-4 text-sm text-slate-500">
        {{ C.intro }} Klik <strong>{{ C.introBold }}</strong> {{ C.introAfter }}
      </p>

      <form id="essay-form" class="space-y-4" @submit.prevent>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="min-w-0">
            <label for="rubric_key" :class="LABEL">{{ C.rubric }}</label>
            <select id="rubric_key" v-model="rubric" :class="FORM_SELECT_CLASS">
              <option v-for="r in RUBRICS" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
          </div>
          <div class="min-w-0">
            <label for="subject_name" :class="LABEL">{{ C.subject }}</label>
            <input
              id="subject_name"
              v-model="subject"
              type="text"
              :placeholder="C.subjectPh"
              :class="FORM_INPUT_CLASS"
            />
          </div>
          <div class="min-w-0">
            <label for="level" :class="LABEL">{{ C.level }}</label>
            <input
              id="level"
              v-model="level"
              type="text"
              :placeholder="C.levelPh"
              :class="FORM_INPUT_CLASS"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="min-w-0">
            <label for="student_name" :class="LABEL">{{ C.student }}</label>
            <input id="student_name" v-model="student" type="text" :class="FORM_INPUT_CLASS" />
          </div>
          <div class="min-w-0">
            <label for="essay_title" :class="LABEL">{{ C.essayTitle }}</label>
            <input id="essay_title" v-model="title" type="text" :class="FORM_INPUT_CLASS" />
          </div>
        </div>
        <div class="min-w-0">
          <label for="essay_text" :class="LABEL">{{ C.essayText }}</label>
          <textarea
            id="essay_text"
            v-model="essay"
            rows="14"
            required
            minlength="50"
            :placeholder="C.essayPh"
            :class="[FORM_INPUT_CLASS, 'font-mono text-sm']"
          />
          <p id="word-counter" class="mt-1 text-xs text-slate-400">{{ words }} perkataan</p>
        </div>

        <div
          class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          data-testid="essay-amber"
        >
          <strong>{{ C.amberBold }}</strong> {{ C.amber }}
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            id="essay-submit"
            type="button"
            :class="[BTN, 'bg-purple-500 text-white hover:bg-purple-600']"
            @click="submitToChat"
          >
            <Bot class="h-4 w-4 shrink-0" />{{ C.submit }}
          </button>
          <RouterLink
            to="/cikgu/essay"
            :class="[BTN, 'bg-slate-200 text-slate-700 hover:bg-slate-300']"
            data-testid="essay-cancel"
            >{{ C.cancel }}</RouterLink
          >
        </div>
      </form>
    </section>
  </div>
</template>
