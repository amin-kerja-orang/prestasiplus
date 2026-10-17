/** Texts and bar colours of S8 (SRS M12 BR-M12-28 / 29 / 30). */

import type { StudentKirkpatrick } from '../../../api/types'
import { pct, pct1 } from '../common/kirkpatrick-format'

/** BR-M12-29 PROPOSED threshold of the accuracy sentence. */
export const GOOD_ACCURACY = 70

/** The ALESA paragraph (BR-M12-29): fixed first sentence, accuracy sentence at >= 70, strongest subject if any. */
export function alesaParagraph(d: StudentKirkpatrick): string {
  const parts = [
    `Penggunaan Prestasi Plus oleh ${d.student.name} masih pada tahap minimum dengan hanya ${d.activeDays} hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi.`,
  ]
  if (d.accuracy >= GOOD_ACCURACY) {
    parts.push(`Ketepatan jawapan pada ${pct(d.accuracy)} menunjukkan pemahaman yang baik.`)
  }
  if (d.strongest) {
    parts.push(`Subjek terkuat: ${d.strongest.subjectName} (${pct1(d.strongest.accuracy)}).`)
  }
  return parts.join(' ')
}

/** BR-M12-28 bar colours: success >= 70, warning 50 to < 70, error below 50. */
export const barColor = (accuracy: number): 'success' | 'warning' | 'error' =>
  accuracy >= 70 ? 'success' : accuracy >= 50 ? 'warning' : 'error'

/**
 * The form ("Tingkatan") of a user grade: the API gives the school year of the users dataset (grade 10 = Tingkatan 4,
 * grade 11 = Tingkatan 5), the page prints the Tingkatan ("Tingkatan 5", AC-M12-30.1).
 */
export const tingkatanOf = (grade: number) => (grade >= 10 ? grade - 6 : grade)
