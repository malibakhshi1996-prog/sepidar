import type { FocusSession } from './user-data.ts'
export function focusSeconds(mode: 'pomo' | 'stopwatch', startAt: string, now = Date.now()): number {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(startAt)) / 1000))
  return mode === 'pomo' ? Math.max(0, 1500 - elapsed) : elapsed
}
export function endFocus(mode: 'pomo' | 'stopwatch', startAt: string, now = new Date()): FocusSession {
  const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(startAt)) / 1000))
  const seconds = mode === 'pomo' ? Math.min(elapsed, 1500) : elapsed
  const completed = mode === 'pomo' && elapsed >= 1500
  return { id: crypto.randomUUID(), startAt, endAt: completed ? new Date(Date.parse(startAt) + 1500_000).toISOString() : now.toISOString(),
    duration: seconds / 60, durationSeconds: seconds, type: mode === 'pomo' ? 'POMODORO' : 'STOPWATCH', completed, interrupted: !completed }
}
