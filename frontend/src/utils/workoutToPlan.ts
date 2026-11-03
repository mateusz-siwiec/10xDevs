import type { PlanEntryInput } from '../api/client'
import { formatDate } from './format'

// Mirrors the backend limits in PlanRequest / PlanEntryRequest.
const MAX_SETS = 20
const MIN_REPS = 1
const MAX_REPS = 100
const MAX_ENTRIES = 50
export const PLAN_NAME_MAX_LENGTH = 60

export interface LoggedSet {
  exerciseId: string
  reps: number
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
 * exercise, so an exercise revisited later stays a separate entry. Sets = run length (capped), reps = the
 * most common rep count in the run, at most 50 entries.
 */
export function workoutToPlanEntries(sets: readonly LoggedSet[]): PlanEntryInput[] {
  return groupRuns(sets).slice(0, MAX_ENTRIES).map((run) => ({
    exerciseId: run[0].exerciseId,
    sets: Math.min(run.length, MAX_SETS),
    reps: Math.min(Math.max(mostCommon(run.map((s) => s.reps)), MIN_REPS), MAX_REPS),
  }))
}

/** Name suggested for a plan saved from a workout: the plan it was started from, else the workout date. */
export function defaultPlanName(sourcePlanName: string | null, startedAt: string): string {
  const name = sourcePlanName?.trim() ? sourcePlanName.trim() : formatDate(startedAt)
  return name.slice(0, PLAN_NAME_MAX_LENGTH)
}
