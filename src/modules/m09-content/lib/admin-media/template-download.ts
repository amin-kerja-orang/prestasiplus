/**
 * The two Audio KBAT template downloads (FN-M09-5.1.3, FR-M09-62; placeholder files, OQ-M09-03).
 * `/admin/audio-kbat/template` is the XLSX, `/admin/audio-kbat/template-word` the Word file.
 */

import { saveBlob } from '@/lib/save-blob'

import { fetchAudioTemplate, type AudioTemplateFormat } from '../../api/admin-media'

const FALLBACK_NAME: Record<AudioTemplateFormat, string> = {
  xlsx: 'templat-audio-kbat.xlsx',
  docx: 'templat-audio-kbat.docx',
}

/** Fetches the template through the API and saves it, as a live download link would. */
export async function downloadAudioTemplate(format: AudioTemplateFormat): Promise<void> {
  const file = await fetchAudioTemplate(format)
  saveBlob(file.blob, file.filename ?? FALLBACK_NAME[format])
}
