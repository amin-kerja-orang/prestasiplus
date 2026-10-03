/**
 * Row types of the two provisional stores still hosted in M17 (F-33; build-plan §2.9, overview
 * §6.7.2, XL3-23). The true owner is M26 (mood check-ins, tuition centres), which is not built yet,
 * so M17 hosts the definitions with `provisional: true`. The shapes are PROVISIONAL (no M26 SRS
 * exists): M17 §6.1 and XR-M17-17/18 give only the field names. The sponsor store moved to M21 in
 * M21-T1 (`@/modules/m21-sponsorship/mock`).
 */

export const MOODS = ['happy', 'okay', 'sad', 'stressed'] as const
export type Mood = (typeof MOODS)[number]

/** Mood check-in (owner M26, PROVISIONAL shape, XR-M17-18). `date` is the MYT calendar day. */
export interface MoodCheckinRow {
  id: number
  userId: number
  mood: Mood
  /** The pupil's reason ("Sebab" of the S7 mood-day modal); `null` when none was given. */
  reason: string | null
  /** `YYYY-MM-DD` (MYT). */
  date: string
}

/**
 * Tuition centre (owner M26, PROVISIONAL shape, XR-M17-17). `activePupils` is the displayed
 * "pelajar aktif" figure; the M26 definition (pupils linked to the centre with at least one answer
 * in 30 days) is PROPOSED, so the observed figure is stored on the row until M26 defines the link.
 */
export interface TuitionCentreRow {
  id: number
  name: string
  city: string
  state: string
  activePupils: number
}

/** An inclusive `YYYY-MM-DD` window; a missing side is open. */
export interface DateWindow {
  from?: string
  to?: string
}
