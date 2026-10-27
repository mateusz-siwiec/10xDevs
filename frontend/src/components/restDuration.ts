export const REST_PRESETS = [60, 90, 120, 180]
const DEFAULT_REST = 90
const STORAGE_KEY = 'gymtrack.restDuration'

export function loadRestDuration(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return REST_PRESETS.includes(value) ? value : DEFAULT_REST
  } catch {
    return DEFAULT_REST
  }
}

export function saveRestDuration(sec: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(sec))
  } catch {
    // storage blocked: the choice just won't persist
  }
}
