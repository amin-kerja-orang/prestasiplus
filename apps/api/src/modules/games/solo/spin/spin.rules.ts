export interface SpinSegment {
  label: string
  type: 'syiling' | 'nothing'
  value: number
  weight: number
  color: string
  icon: string
}

/** The 8 fixed Roda Nasib segments in order, weights 25/20/15/8/3/15/10/4 (BR-M16-29; observed on live, 0-based `segment_index`). */
export const SPIN_SEGMENTS: readonly SpinSegment[] = [
  { label: '1 Syiling', type: 'syiling', value: 1, weight: 25, color: '#3b82f6', icon: '🪙' },
  { label: '3 Syiling', type: 'syiling', value: 3, weight: 20, color: '#8b5cf6', icon: '💰' },
  { label: '5 Syiling', type: 'syiling', value: 5, weight: 15, color: '#10b981', icon: '💎' },
  { label: '10 Syiling', type: 'syiling', value: 10, weight: 8, color: '#f59e0b', icon: '🏆' },
  { label: '20 Syiling', type: 'syiling', value: 20, weight: 3, color: '#ef4444', icon: '🔥' },
  { label: 'Cuba Lagi', type: 'nothing', value: 0, weight: 15, color: '#6b7280', icon: '😅' },
  { label: '2 Syiling', type: 'syiling', value: 2, weight: 10, color: '#ec4899', icon: '✨' },
  { label: '7 Syiling', type: 'syiling', value: 7, weight: 4, color: '#14b8a6', icon: '🎁' },
]

/** The segment index for a draw `r` in [0, 100): the first segment whose cumulative weight passes it. */
export function segmentOf(r: number): number {
  let left = r
  const i = SPIN_SEGMENTS.findIndex((s) => (left -= s.weight) < 0)
  return i < 0 ? SPIN_SEGMENTS.length - 1 : i
}
