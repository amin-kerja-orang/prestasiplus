import { randomInt } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import { segmentOf, SPIN_SEGMENTS } from './spin.rules'

/**
 * Draws the Roda Nasib segment with `node:crypto` (a seeded stream is predictable). `forceNext` is the test seam: the
 * next draw lands on that segment, then the draw is random again.
 */
@Injectable()
export class SpinDraw {
  private forced: number | null = null

  forceNext(index: number | null): void {
    if (index !== null && (!Number.isInteger(index) || index < 0 || index >= SPIN_SEGMENTS.length)) throw new RangeError('segment index')
    this.forced = index
  }

  draw(): number {
    if (this.forced !== null) {
      const index = this.forced
      this.forced = null
      return index
    }
    return segmentOf(randomInt(0, 100)) // the weights are integers summing to 100
  }
}
