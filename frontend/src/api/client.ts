const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

const TOKEN_STORAGE_KEY = 'gymtrack_token'

export interface AuthResponse {
  token: string
  id: string
  email: string
}

export interface CurrentUser {
  id: string
  email: string
}

/**
 * Error from a non-OK API response. `message` is the server's English text; `code` (plus `field`
 * and `rule` for validation failures) is the stable key the UI translates by.
 */
export class ApiError extends Error {
  status: number
  code?: string
  field?: string
  rule?: string
  /** Constraint bounds for Size/Min/Max/DecimalMin/DecimalMax validation failures. */
  min?: number | string
  max?: number | string

  constructor(
    message: string,
    status: number,
    details: {
      code?: string
      field?: string
      rule?: string
      min?: number | string
      max?: number | string
    } = {},
  ) {
    super(message)
    this.status = status
    this.code = details.code
    this.field = details.field
    this.rule = details.rule
    this.min = details.min
    this.max = details.max
  }
}

function bound(value: unknown): number | string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? value : undefined
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    if (body && typeof body.error === 'string') {
      return new ApiError(body.error, res.status, {
        code: typeof body.code === 'string' ? body.code : undefined,
        field: typeof body.field === 'string' ? body.field : undefined,
        rule: typeof body.rule === 'string' ? body.rule : undefined,
        min: bound(body.min),
        max: bound(body.max),
      })
    }
  } catch {
    // response body wasn't JSON — fall through to the generic message
  }
  return new ApiError(`Request failed with status ${res.status}`, res.status, { code: 'REQUEST_FAILED' })
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw await parseError(res)
  }
  return res.json()
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw await parseError(res)
  }
  return res.json()
}

export async function getMe(token: string): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw await parseError(res)
  }
  return res.json()
}

/**
 * Generic fetch wrapper for authenticated requests. Reads the stored token
 * from localStorage and attaches it as a Bearer Authorization header.
 * Future slices should use this for any call to a protected endpoint.
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    throw await parseError(res)
  }
  return res
}

export interface Exercise {
  id: string
  slug: string
  name: string
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
  custom: boolean
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  reps: number
  weightKg: number
  loggedAt: string
  personalRecord: boolean
}

export interface WorkoutSession {
  id: string
  startedAt: string
  endedAt: string | null
  planId: string | null
  sets: WorkoutSet[]
}

export interface LogSetInput {
  exerciseId: string
  reps: number
  weightKg: number
}

export interface ProgressionPoint {
  sessionId: string
  date: string
  topWeightKg: number
}

export async function getExercises(): Promise<Exercise[]> {
  const res = await authFetch('/api/exercises')
  return res.json()
}

export interface CreateExerciseInput {
  name: string
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
}

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const res = await authFetch('/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function updateExercise(id: string, input: CreateExerciseInput): Promise<Exercise> {
  const res = await authFetch(`/api/exercises/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Resolves on 204 No Content; there is no body to parse. */
export async function deleteExercise(id: string): Promise<void> {
  await authFetch(`/api/exercises/${id}`, { method: 'DELETE' })
}

export async function startSession(planId?: string): Promise<WorkoutSession> {
  const res = await authFetch('/api/workout-sessions', {
    method: 'POST',
    ...(planId
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) }
      : {}),
  })
  return res.json()
}

/** Returns null when the user has no active session (204 No Content). */
export async function getCurrentSession(): Promise<WorkoutSession | null> {
  const res = await authFetch('/api/workout-sessions/current')
  if (res.status === 204) {
    return null
  }
  return res.json()
}

export async function endSession(id: string): Promise<WorkoutSession> {
  const res = await authFetch(`/api/workout-sessions/${id}/end`, { method: 'POST' })
  return res.json()
}

export async function logSet(sessionId: string, input: LogSetInput): Promise<WorkoutSet> {
  const res = await authFetch(`/api/workout-sessions/${sessionId}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function deleteSet(sessionId: string, setId: string): Promise<void> {
  await authFetch(`/api/workout-sessions/${sessionId}/sets/${setId}`, { method: 'DELETE' })
}

export async function getProgression(exerciseId: string): Promise<ProgressionPoint[]> {
  const res = await authFetch(`/api/exercises/${exerciseId}/progression`)
  return res.json()
}

export async function getSubstitutes(exerciseId: string): Promise<Exercise[]> {
  const res = await authFetch(`/api/exercises/${exerciseId}/substitutes`)
  return res.json()
}

export interface ProgressionRecommendation {
  exerciseId: string
  currentWeightKg: number
  recommendedWeightKg: number
  workouts: number
  targetSets: number
  targetReps: number
}

/** Returns null when there is no recommendation for the exercise (204 No Content). */
export async function getProgressionRecommendation(
  exerciseId: string,
): Promise<ProgressionRecommendation | null> {
  const res = await authFetch(`/api/exercises/${exerciseId}/progression-recommendation`)
  if (res.status === 204) {
    return null
  }
  return res.json()
}

export interface PreviousWorkout {
  exerciseId: string
  sessionId: string
  endedAt: string
  sets: { reps: number; weightKg: number }[]
}

/** Returns null when the exercise has no earlier workout in this plan (204 No Content). */
export async function getPreviousWorkout(
  exerciseId: string,
  planId: string,
): Promise<PreviousWorkout | null> {
  const res = await authFetch(
    `/api/exercises/${exerciseId}/previous-workout?planId=${encodeURIComponent(planId)}`,
  )
  if (res.status === 204) {
    return null
  }
  return res.json()
}

export interface PeriodTotals {
  workoutCount: number
  totalDurationSeconds: number
  totalVolumeKg: number
}

export interface DashboardStats {
  /** null for the unbounded "all" window. */
  days: number | null
  workoutCount: number
  totalDurationSeconds: number
  totalVolumeKg: number
  /** Totals for the equally long preceding window; null for "all". */
  previous: PeriodTotals | null
}

export type StatsWindow = 7 | 30 | 90 | 'all'

export async function getDashboardStats(days: StatsWindow): Promise<DashboardStats> {
  const res = await authFetch(`/api/dashboard/stats?days=${days}`)
  return res.json()
}

export interface MuscleGroupStats {
  /** null for the unbounded "all" window. */
  days: number | null
  totalSets: number
  /** Every muscle group, zeros included. */
  groups: { muscleGroup: string; sets: number }[]
}

export async function getMuscleGroupStats(days: StatsWindow): Promise<MuscleGroupStats> {
  const res = await authFetch(`/api/dashboard/muscle-groups?days=${days}`)
  return res.json()
}

export interface WeeklyVolume {
  weekStart: string
  workoutCount: number
  volumeKg: number
}

export interface Streak {
  goal: number | null
  weeks: number
  currentWeekWorkouts: number
}

export interface RecentPersonalRecord {
  sessionId: string
  exerciseId: string
  exerciseName: string
  reps: number
  weightKg: number
  achievedAt: string
}

export interface DashboardInsights {
  /** 12 items, oldest first. */
  weeklyVolume: WeeklyVolume[]
  streak: Streak
  /** At most 5, newest first. */
  recentPersonalRecords: RecentPersonalRecord[]
}

export async function getDashboardInsights(): Promise<DashboardInsights> {
  const res = await authFetch('/api/dashboard/insights')
  return res.json()
}

/** `weeklyGoal` is 1-14, or null to clear the goal. */
export async function setWeeklyGoal(weeklyGoal: number | null): Promise<{ weeklyGoal: number | null }> {
  const res = await authFetch('/api/dashboard/weekly-goal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeklyGoal }),
  })
  return res.json()
}

export interface PlanSummary {
  id: string
  name: string
  exerciseCount: number
  updatedAt: string
}

export interface PlanEntry {
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  position: number
  sets: number
  reps: number
}

export interface Plan {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  exercises: PlanEntry[]
}

/** sets/reps are sent as typed; null (empty field) is left for the server to reject. */
export interface PlanEntryInput {
  exerciseId: string
  sets: number | null
  reps: number | null
}

export interface PlanInput {
  name: string
  entries: PlanEntryInput[]
}

export async function listPlans(): Promise<PlanSummary[]> {
  const res = await authFetch('/api/training-plans')
  return res.json()
}

export async function getPlan(id: string): Promise<Plan> {
  const res = await authFetch(`/api/training-plans/${id}`)
  return res.json()
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  const res = await authFetch('/api/training-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function updatePlan(id: string, input: PlanInput): Promise<Plan> {
  const res = await authFetch(`/api/training-plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Deletes a workout together with its sets. Resolves on 204 No Content. */
export async function deleteWorkout(id: string): Promise<void> {
  await authFetch(`/api/workout-sessions/${id}`, { method: 'DELETE' })
}

/** Resolves on 204 No Content; there is no body to parse. */
export async function deletePlan(id: string): Promise<void> {
  await authFetch(`/api/training-plans/${id}`, { method: 'DELETE' })
}

export interface HistoryItem {
  id: string
  startedAt: string
  endedAt: string
  planId: string | null
  planName: string | null
  durationSeconds: number
  setCount: number
  volumeKg: number
}

export interface HistoryPage {
  items: HistoryItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** `page` is 0-based, matching the backend. */
export async function getHistory(
  page: number,
  plan: { planId?: string; noPlan?: boolean },
): Promise<HistoryPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (plan.planId) {
    params.set('planId', plan.planId)
  } else if (plan.noPlan) {
    params.set('noPlan', 'true')
  }
  const res = await authFetch(`/api/workout-sessions?${params.toString()}`)
  return res.json()
}

export interface HistoryDetail {
  id: string
  startedAt: string
  endedAt: string
  planId: string | null
  planName: string | null
  durationSeconds: number
  volumeKg: number
  exercises: { exerciseId: string; sets: { reps: number; weightKg: number; personalRecord: boolean }[] }[]
}

export async function getHistorySession(id: string): Promise<HistoryDetail> {
  const res = await authFetch(`/api/workout-sessions/${encodeURIComponent(id)}`)
  return res.json()
}
