/**
 * Saving of an intake batch from the editor: one save at a time, and a result the caller can trust.
 * Autosave, "Simpan draf" and "Hantar untuk semakan" all go through `save()`, so a manual save waits
 * for an autosave still in flight instead of reading its half-finished state.
 */
export type SaveState = 'tersimpan' | 'belum' | 'menyimpan' | 'gagal'

export interface DraftSaverOptions {
  /** False when there is nothing to save (no batch, or no longer a Draf). */
  canSave: () => boolean
  /** Sends the batch to the server; rejects when it cannot be saved. */
  run: () => Promise<void>
  onState: (state: SaveState) => void
}

export interface DraftSaver {
  /** Resolves true when the batch was saved, false when it failed or there was nothing to save. */
  save: () => Promise<boolean>
}

export function createDraftSaver(opts: DraftSaverOptions): DraftSaver {
  let last: Promise<boolean> | null = null

  async function exec(): Promise<boolean> {
    if (!opts.canSave()) return false
    opts.onState('menyimpan')
    try {
      await opts.run()
      opts.onState('tersimpan')
      return true
    } catch {
      opts.onState('gagal')
      return false
    }
  }

  function save(): Promise<boolean> {
    const prev = last
    const next = (async () => {
      if (prev) await prev
      return exec()
    })()
    last = next
    void next.then(() => {
      if (last === next) last = null
    })
    return next
  }

  return { save }
}

/** The confirmation shown after the user presses "Simpan draf". */
export function draftSavedFlash(saved: boolean): { type: 'success' | 'error'; message: string } {
  return saved
    ? { type: 'success', message: 'Draf disimpan.' }
    : { type: 'error', message: 'Draf tidak dapat disimpan. Cuba lagi.' }
}
