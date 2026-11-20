import type { Measure, PlanEntryInput } from '../api/client'
import { formatDate } from './format'

// Mirrors the backend limits in PlanRequest / PlanEntryRequest.
const MAX_SETS = 20
const MIN_REPS = 1
const MAX_REPS = 100
const MIN_DURATION_SECONDS = 1
const MAX_DURATION_SECONDS = 3600
/** Target for an exercise that became timed after its rep sets were logged (e.g. Plank before it turned timed). */
const LEGACY_DURATION_TARGET_SECONDS = 30
const MAX_ENTRIES = 50
export const PLAN_NAME_MAX_LENGTH = 60

export interface LoggedSet {
  exerciseId: string
  /** Set for rep-based sets; null for timed sets. */
  reps: number | null
  /** Set for timed sets; null/absent for rep-based sets. */
  durationSeconds?: number | null
  /** The exercise's measure. When known it decides the target kind, even if the set data is a legacy shape. */
  measure?: Measure
}

/** Most frequent value; ties go to the higher one. */
function mostCommon(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = values[0]
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Timed exercises get a duration target (most common seconds), rep exercises a reps target, each clamped to the plan
 * limits. The exercise's measure decides, so legacy rep sets of an exercise that is now timed still yield a valid
 * duration target; without a known measure the shape of the sets decides.
 */
function targetFor(run: readonly LoggedSet[]): Pick<PlanEntryInput, 'reps' | 'targetDurationSeconds'> {
  const durations = run.flatMap((s) => (s.durationSeconds != null ? [s.durationSeconds] : []))
  const timed = run[0].measure === 'DURATION' || (run[0].measure === undefined && durations.length > 0)
  if (timed) {
    const seconds = durations.length > 0 ? mostCommon(durations) : LEGACY_DURATION_TARGET_SECONDS
    return {
      targetDurationSeconds: Math.min(Math.max(seconds, MIN_DURATION_SECONDS), MAX_DURATION_SECONDS),
    }
  }
  const reps = run.map((s) => s.reps ?? 0)
  return { reps: Math.min(Math.max(mostCommon(reps), MIN_REPS), MAX_REPS) }
}

/** Consecutive runs of the same exercise, in logged order (before any plan limit is applied). */
function groupRuns(sets: readonly LoggedSet[]): LoggedSet[][] {
  const runs: LoggedSet[][] = []
  for (const set of sets) {
    const last = runs[runs.length - 1]
    if (last && last[0].exerciseId === set.exerciseId) last.push(set)
    else runs.push([set])
  }
  return runs
}

/** True when saving would drop data: more than 50 exercise runs, or a run of more than 20 sets. */
export function exceedsPlanLimits(sets: readonly LoggedSet[]): boolean {
  const runs = groupRuns(sets)
  return runs.length > MAX_ENTRIES || runs.some((run) => run.length > MAX_SETS)
}

/**
 * Turns a workout's sets (in logged order) into plan entries: one entry per consecutive run of the same
 * exercise, so an exercise revisited later stays a separate entry. Sets = run length (capped), reps (or a duration target for timed
 * exercises) = the most common value in the run, at most 50 entries.
 */
export function workoutToPlanEntries(sets: readonly LoggedSet[]): PlanEntryInput[] {
  return groupRuns(sets).slice(0, MAX_ENTRIES).map((run) => ({
    exerciseId: run[0].exerciseId,
    sets: Math.min(run.length, MAX_SETS),
    ...targetFor(run),
  }))
}

/** Name suggested for a plan saved from a workout: the plan it was started from, else the workout date. */
export function defaultPlanName(sourcePlanName: string | null, startedAt: string): string {
  const name = sourcePlanName?.trim() ? sourcePlanName.trim() : formatDate(startedAt)
  return name.slice(0, PLAN_NAME_MAX_LENGTH)
}
