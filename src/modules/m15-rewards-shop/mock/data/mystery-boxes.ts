/**
 * DATA-M15-03: the four mystery boxes (SRS M15 v1.4 §6.4; all values OBSERVED on the snapshot).
 * Constants: no live UI edits them. Rarity colours live in the UI; the data keeps the key.
 */

import type { MysteryBox } from '../repository/types'

export const MYSTERY_BOXES: readonly MysteryBox[] = [
  {
    id: 1,
    name: 'Kotak Gangsa',
    description: 'Kotak biasa — ganjaran kecil tapi pasti!',
    icon: '📦',
    rarity: null,
    costTokens: 2,
    coinMin: 1,
    coinMax: 20,
    xpMin: 1,
    xpMax: 10,
    color1: '#9ca3af',
    color2: '#6b7280',
  },
  {
    id: 2,
    name: 'Kotak Perak',
    description: 'Kotak lebih besar — peluang ganjaran lebih baik',
    icon: '🎁',
    rarity: 'rare',
    costTokens: 5,
    coinMin: 10,
    coinMax: 50,
    xpMin: 5,
    xpMax: 25,
    color1: '#3b82f6',
    color2: '#2563eb',
  },
  {
    id: 3,
    name: 'Kotak Emas',
    description: 'Kotak premium — ganjaran besar menanti!',
    icon: '✨',
    rarity: 'epic',
    costTokens: 10,
    coinMin: 25,
    coinMax: 150,
    xpMin: 10,
    xpMax: 50,
    color1: '#8b5cf6',
    color2: '#7c3aed',
  },
  {
    id: 4,
    name: 'Kotak Legenda',
    description: 'Kotak terhebat — ganjaran WOW!',
    icon: '👑',
    rarity: 'legendary',
    costTokens: 25,
    coinMin: 100,
    coinMax: 500,
    xpMin: 25,
    xpMax: 100,
    color1: '#f59e0b',
    color2: '#ef4444',
  },
]
