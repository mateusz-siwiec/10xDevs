import type { PlanEntry, WorkoutSet } from '../api/client'

export interface EntryProgress {
  entry: PlanEntry
  logged: number
}

/**
 * Walks plan entries in order; each consumes up to its `sets` logged sets of the same
 * exercise, so a repeated exercise fills its first entry before the second.
 */
export function computeProgress(entries: PlanEntry[], sets: WorkoutSet[]): EntryProgress[] {
  const remaining = new Map<string, number>()
  for (const set of sets) {
    remaining.set(set.exerciseId, (remaining.get(set.exerciseId) ?? 0) + 1)
  }
  return [...entries]
    .sort((a, b) => a.position - b.position)
    .map((entry) => {
      const available = remaining.get(entry.exerciseId) ?? 0
      const logged = Math.min(available, entry.sets)
      remaining.set(entry.exerciseId, available - logged)
      return { entry, logged }
    })
}

/** Index of the first entry whose logged sets are below its target, or -1 when all are done. */
export function currentIndex(progress: EntryProgress[]): number {
  return progress.findIndex((p) => p.logged < p.entry.sets)
}
