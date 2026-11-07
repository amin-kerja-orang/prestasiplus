/**
 * Shared save flow of the create and edit pages (R1-GUR-44b): uploads the optional stimulus image first,
 * calls the API, and turns a refusal into field errors (422) or one message (409 and others: the server's own
 * BM text, else a fixed line). The typed values stay in the form on every refusal.
 */
import { ref } from 'vue'

import { isApiError } from '@/api'

import { uploadStimulusImage } from '../api/structured-submit'
import { moduleMessage } from './generic-server-text'
import {
  buildBody,
  STRUCTURED_EXTRA_COPY,
  type StructuredFormValues,
  type StructuredSubmitBody,
} from './structured-form'

/** Key of the one message that belongs to no field (a 409, a network failure). */
export const FORM_MESSAGE_KEY = 'form'

export function useStructuredSave() {
  const saving = ref(false)
  const fields = ref<Record<string, string>>({})

  /** Runs `send` with the body; resolves true on success. */
  async function save(
    values: StructuredFormValues,
    image: File | null,
    savedImageId: string | null,
    send: (body: StructuredSubmitBody) => Promise<unknown>,
  ): Promise<boolean> {
    if (saving.value) return false
    saving.value = true
    fields.value = {}
    try {
      const token = image ? await uploadStimulusImage(image) : savedImageId
      await send(buildBody(values, token))
      return true
    } catch (err) {
      if (isApiError(err) && err.status === 422 && err.fields && Object.keys(err.fields).length) {
        fields.value = err.fields
      } else {
        fields.value = {
          [FORM_MESSAGE_KEY]: moduleMessage(err) ?? STRUCTURED_EXTRA_COPY.saveFailed,
        }
      }
      window.scrollTo?.({ top: 0 })
      return false
    } finally {
      saving.value = false
    }
  }

  return { saving, fields, save }
}
