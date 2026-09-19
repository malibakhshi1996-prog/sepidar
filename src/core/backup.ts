import { migrateTask, type Task, type LegacyTask } from './task.ts'
import type { Habit, FocusSession } from './user-data.ts'
import { parseJalaliKey } from './date.ts'

export interface BackupData { tasks: Task[]; habits: Habit[]; focusSessions: FocusSession[]; activeTheme: string }
export interface BackupEnvelope { format: 'zitar-backup'; version: 1; exportedAt: string; data: BackupData }
const fail = (): never => { throw new Error('فایل پشتیبان معتبر نیست یا نسخهٔ آن پشتیبانی نمی‌شود.') }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail()
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const checkCollection = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value) || value.length > 100_000) return fail()
  const ids = new Set<string>()
  return value.map(item => { const v = record(item); if (!nonempty(v.id) || ids.has(v.id)) return fail(); ids.add(v.id); return v })
}
const textFields = (value: Record<string, unknown>, fields: string[]) => {
  for (const field of fields) if (value[field] !== undefined && typeof value[field] !== 'string') fail()
}

export function exportBackup(data: BackupData): string {
  const backup: BackupEnvelope = { format: 'zitar-backup', version: 1, exportedAt: new Date().toISOString(), data }
  return JSON.stringify(backup, null, 2)
}
export function parseBackup(text: string): BackupData {
  if (text.length > 20 * 1024 * 1024) throw new Error('اندازهٔ فایل باید کمتر از ۲۰ مگابایت باشد.')
  let envelope: Record<string, unknown>
  try { envelope = record(JSON.parse(text)) } catch { return fail() }
  if (envelope.format !== 'zitar-backup' || envelope.version !== 1) return fail()
  const data = record(envelope.data)
  const tasks = checkCollection(data.tasks).map(task => {
    if (!nonempty(task.title) || !nonempty(task.list) || typeof task.completed !== 'boolean' || !['none', 'low', 'medium', 'high'].includes(String(task.priority))) fail()
    textFields(task, ['description', 'note', 'date', 'dateKey', 'time', 'tag', 'recurrence', 'status', 'createdAt', 'updatedAt', 'deletedAt', 'completedAt', 'serverId', 'userId', 'parentTaskId', 'projectId', 'recurrenceSourceId', 'timezone'])
    if (task.status !== undefined && !['OPEN', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(String(task.status))) fail()
    if (task.reminder !== undefined && typeof task.reminder !== 'boolean') fail()
    if (task.dateKey && !parseJalaliKey(String(task.dateKey))) fail()
    if (task.time) {
      const time = String(task.time).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail()
    }
    if (task.sortOrder !== undefined && (typeof task.sortOrder !== 'number' || !Number.isFinite(task.sortOrder))) fail()
    if (task.duration !== undefined && (typeof task.duration !== 'number' || !Number.isFinite(task.duration) || task.duration < 0)) fail()
    // Keep exported metadata, but do not trust it as server authority when merging below.
    return migrateTask(task as unknown as LegacyTask)
  })
  const habits = checkCollection(data.habits).map(habit => {
    if (!nonempty(habit.title) || !nonempty(habit.frequency) || !Array.isArray(habit.completionDates) || !habit.completionDates.every(key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key))) fail()
    if (typeof habit.color !== 'string' || !/^#[\da-fA-F]{6}$/.test(habit.color)) fail()
    if (!(habit.completionDates as string[]).every(date => parseJalaliKey(date))) fail()
    textFields(habit, ['icon'])
    return { ...habit, streak: 0, completedToday: false, bestStreak: 0 } as unknown as Habit
  })
  const focusSessions = checkCollection(data.focusSessions).map(session => {
    if (!['POMODORO', 'STOPWATCH'].includes(String(session.type)) || typeof session.duration !== 'number' || !Number.isFinite(session.duration) || session.duration < 0) fail()
    if (typeof session.startAt !== 'string' || !Number.isFinite(Date.parse(session.startAt)) || typeof session.endAt !== 'string' || !Number.isFinite(Date.parse(session.endAt))) fail()
    if (typeof session.completed !== 'boolean' || typeof session.interrupted !== 'boolean') fail()
    if (session.durationSeconds !== undefined && (typeof session.durationSeconds !== 'number' || session.durationSeconds < 0)) fail()
    textFields(session, ['taskId'])
    return session as unknown as FocusSession
  })
  if (typeof data.activeTheme !== 'string' || !['default', 'dark', 'light', 'system', 'turquoise', 'peach', 'pebble', 'spring', 'summer', 'autumn', 'winter'].includes(data.activeTheme)) fail()
  return { tasks, habits, focusSessions, activeTheme: data.activeTheme as string }
}

/** Non-destructive restore: existing ids win, including tombstones. Reimport is idempotent. */
export function mergeBackup(current: BackupData, incoming: BackupData, now = new Date().toISOString()): BackupData {
  const taskIds = new Set(current.tasks.map(t => t.id))
  const habitIds = new Set(current.habits.map(h => h.id))
  const focusIds = new Set(current.focusSessions.map(f => f.id))
  const added = incoming.tasks.filter(t => !taskIds.has(t.id)).map(t => ({ ...t, serverId: undefined, userId: 'local',
    updatedAt: now, version: 1, syncState: (t.deletedAt ? 'PENDING_DELETE' : 'PENDING_CREATE') as Task['syncState'] }))
  return { ...current, tasks: [...current.tasks, ...added], habits: [...current.habits, ...incoming.habits.filter(h => !habitIds.has(h.id))],
    focusSessions: [...current.focusSessions, ...incoming.focusSessions.filter(f => !focusIds.has(f.id))] }
}

// Prevent spreadsheet formulas when exported task titles are opened in Excel/LibreOffice.
const csvCell = (value: unknown) => {
  let text = String(value ?? '')
  if (/^[\s]*[=+@\-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function exportTasksCsv(tasks: Task[]): string {
  const rows = [['id', 'title', 'status', 'priority', 'list', 'jalali_date', 'time', 'timezone', 'note']]
  tasks.filter(t => !t.deletedAt).forEach(t => rows.push([t.id, t.title, t.status, t.priority, t.list, t.dateKey || '', t.time || '', t.timezone, t.note || '']))
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
