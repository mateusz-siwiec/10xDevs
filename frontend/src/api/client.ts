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

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // response body wasn't JSON — fall through to the generic message
  }
  return `Request failed with status ${res.status}`
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
    throw new Error(await parseErrorMessage(res))
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
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

export async function getMe(token: string): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
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
    throw new Error(await parseErrorMessage(res))
  }
  return res
}

export interface Exercise {
  id: string
  slug: string
  name: string
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  reps: number
  weightKg: number
  loggedAt: string
}

export interface WorkoutSession {
  id: string
  startedAt: string
  endedAt: string | null
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

export async function startSession(): Promise<WorkoutSession> {
  const res = await authFetch('/api/workout-sessions', { method: 'POST' })
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

export interface PlanSummary {
  id: string
  name: string
  exerciseCount: number
  updatedAt: string
}

export interface PlanEntry {
  exerciseId: string
  exerciseName: string
  position: number
}

export interface Plan {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  exercises: PlanEntry[]
}

export interface PlanInput {
  name: string
  exerciseIds: string[]
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

/** Resolves on 204 No Content; there is no body to parse. */
export async function deletePlan(id: string): Promise<void> {
  await authFetch(`/api/training-plans/${id}`, { method: 'DELETE' })
}
