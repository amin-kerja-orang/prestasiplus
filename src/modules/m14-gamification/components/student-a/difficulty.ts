import { gamDifficultyLabel } from '../../lib/student/s11-format'

/** Nuxt UI badge colour of a challenge difficulty (green, amber, red; neutral for unknown). */
export function difficultyColor(difficulty: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (gamDifficultyLabel(difficulty)) {
    case 'Mudah':
      return 'success'
    case 'Sederhana':
      return 'warning'
    case 'Sukar':
      return 'error'
    default:
      return 'neutral'
  }
}
