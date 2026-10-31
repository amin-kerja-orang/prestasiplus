import { api } from './client'
import { API_ERROR_CODES, ApiError, isApiError } from './errors'

/** The stored file as `POST /api/files` answers (BE-04 `FileRef`); `id` is the public token. */
export interface UploadedFile {
  id: string
  url: string
}

/** Fallback text when the upload is refused without a message of its own. */
const UPLOAD_FAILED = 'Gambar gagal dimuat naik.'

/**
 * Uploads one question image (`POST /api/files?purpose=question_image`, multipart field `file`) and
 * returns its public token, which the question JSON takes as `questionImageFileId` /
 * `optionImageFileIds[i]`. Shared by the admin question form (M04) and the teacher form (M10).
 *
 * A refusal (422 `fields.file`, 403, 429, 5xx) is rethrown as a 422 `ApiError` keyed by `fieldKey`
 * (`questionImage` / `optionImages.<i>`) so the form shows it under the right image. A network failure
 * is rethrown unchanged, so the form shows its general message.
 */
export async function uploadQuestionImage(file: Blob, fieldKey: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  try {
    const stored = await api.multipart<UploadedFile>('/api/files', form, {
      query: { purpose: 'question_image' },
    })
    return stored.id
  } catch (err) {
    if (!isApiError(err) || err.code === API_ERROR_CODES.NETWORK_ERROR) throw err
    const message = err.fields?.file ?? (err.message === '' ? UPLOAD_FAILED : err.message)
    throw new ApiError({
      status: 422,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message,
      fields: { [fieldKey]: message },
      cause: err,
    })
  }
}
