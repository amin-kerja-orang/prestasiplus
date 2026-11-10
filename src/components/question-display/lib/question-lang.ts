import { ref, type Ref } from 'vue'

/** Language of a bilingual question (FR-PA-04): `ms` BM only, `en` English only, `both` BM then English. */
export type QuestionLang = 'ms' | 'en' | 'both'

export const QUESTION_LANG_KEY = 'pp.qd.lang'
const VALUES: readonly QuestionLang[] = ['ms', 'en', 'both']

function read(): QuestionLang {
  try {
    const v = localStorage.getItem(QUESTION_LANG_KEY)
    if (v && (VALUES as readonly string[]).includes(v)) return v as QuestionLang
  } catch {
    /* storage unavailable */
  }
  return 'both'
}

/** One app-wide choice, shared by every consumer. */
const lang = ref<QuestionLang>(read())

export function useQuestionLang(): { lang: Ref<QuestionLang>; setLang: (v: QuestionLang) => void } {
  function setLang(v: QuestionLang): void {
    lang.value = v
    try {
      localStorage.setItem(QUESTION_LANG_KEY, v)
    } catch {
      /* storage unavailable: the choice still holds for this session */
    }
  }
  return { lang, setLang }
}

/** Re-read the stored choice (a fresh page load; used by tests to simulate a remount). */
export function reloadQuestionLang(): void {
  lang.value = read()
}
