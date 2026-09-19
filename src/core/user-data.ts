export type Habit = { id: string; title: string; icon: string; color: string; frequency: string; streak: number; bestStreak?: number; completedToday: boolean; completionDates?: string[] }
export type FocusSession = { id: string; taskId?: string; startAt: string; endAt: string; duration: number; durationSeconds?: number; type: 'POMODORO' | 'STOPWATCH'; completed: boolean; interrupted: boolean }
