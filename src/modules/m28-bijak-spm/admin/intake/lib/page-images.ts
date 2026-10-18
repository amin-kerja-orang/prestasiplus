/**
 * Page images of a batch, kept in memory for the browser session only (a data URL per page is too
 * big for the persisted mock store). After a refresh the review screen falls back to the page text.
 */
import type { PageImage } from '../types'

const images = new Map<string, PageImage[]>()

export function setPageImages(batchId: string, list: PageImage[]): void {
  images.set(batchId, list)
}

export function getPageImages(batchId: string): PageImage[] {
  return images.get(batchId) ?? []
}
