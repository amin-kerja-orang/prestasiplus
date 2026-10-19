/**
 * Seed registry. Each lane adds ONE import and ONE array entry for its seed module
 * (append-only; never reorder). BE-02 wires `be:db:seed` to `runSeeds(seedModules)`.
 */
export interface SeedModule {
  /** Domain name, e.g. `core`, `curriculum`. */
  name: string
  /** Idempotent and deterministic; fictitious data only. */
  run(): Promise<void>
}

export const seedModules: SeedModule[] = []

export async function runSeeds(modules: SeedModule[] = seedModules): Promise<string[]> {
  const done: string[] = []
  for (const m of modules) {
    await m.run()
    done.push(m.name)
  }
  return done
}
