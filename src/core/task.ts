import type { SyncState, TaskStatus } from './model'

export type TaskPriority = 'none' | 'low' | 'medium' | 'high'
export interface Task {
  id: string
  title: string
  description?: string
  list: string
  priority: TaskPriority
  completed: boolean
  completedAt?: string
  date?: string
  dateKey?: string
  time?: string
  reminder?: boolean
  duration?: number
  recurrence?: string
  tag?: string
  note?: string
  serverId?: string
  userId: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  deletedAt?: string
  syncState: SyncState
  version: number
  allDay: boolean
  timezone: string
  sortOrder: number
  parentTaskId?: string
  projectId?: string
  recurrenceSourceId?: string
  recurrenceMode?: 'SCHEDULED_DATE' | 'COMPLETION_DATE'
}
export type LegacyTask = Pick<Task, 'id' | 'title' | 'list' | 'priority' | 'completed'> & Partial<Task>
const statuses: TaskStatus[] = ['OPEN', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
const syncStates: SyncState[] = ['SYNCED', 'PENDING_CREATE', 'PENDING_UPDATE', 'PENDING_DELETE', 'CONFLICT']

/** Additive migration: never changes an existing id, timestamp or server version. */
export function migrateTask(value: LegacyTask, now = new Date().toISOString(), index = 0): Task {
  const status = statuses.includes(value.status!) ? value.status! : value.completed ? 'COMPLETED' : 'OPEN'
  return {
    ...value, userId: value.userId || 'local', status, completed: status === 'COMPLETED',
    createdAt: value.createdAt || now, updatedAt: value.updatedAt || now,
    syncState: syncStates.includes(value.syncState!) ? value.syncState! : value.deletedAt ? 'PENDING_DELETE' : 'PENDING_CREATE',
    version: Number.isInteger(value.version) && value.version! > 0 ? value.version! : 1,
    allDay: !value.time, timezone: value.timezone || 'Asia/Tehran', sortOrder: value.sortOrder ?? index,
  }
}

export function createTask(draft: Partial<Task> & Pick<Task, 'title'>, now = new Date().toISOString()): Task {
  if (!draft.title.trim()) throw new Error('عنوان کار نمی‌تواند خالی باشد.')
  return migrateTask({ ...draft, id: crypto.randomUUID(), title: draft.title.trim(), list: draft.list || 'Inbox',
    priority: draft.priority || 'none', completed: false, status: 'OPEN', serverId: undefined,
    completedAt: undefined, deletedAt: undefined, createdAt: now, updatedAt: now, version: 1, syncState: 'PENDING_CREATE' }, now)
}

export function editTask(task: Task, patch: Partial<Task>, now = new Date().toISOString()): Task {
  if (task.deletedAt) throw new Error('ابتدا کار را از سطل زباله بازیابی کنید.')
  const title = (patch.title ?? task.title).trim()
  if (!title) throw new Error('عنوان کار نمی‌تواند خالی باشد.')
  const status = patch.status ?? (patch.completed === undefined ? task.status : patch.completed ? 'COMPLETED' : 'OPEN')
  return { ...task, ...patch, title, id: task.id, userId: task.userId, serverId: task.serverId,
    createdAt: task.createdAt, deletedAt: task.deletedAt, updatedAt: now, version: task.version + 1,
    status, completed: status === 'COMPLETED',
    completedAt: status === 'COMPLETED' ? task.completedAt || now : undefined,
    allDay: !(patch.time ?? task.time),
    syncState: task.syncState === 'CONFLICT' ? 'CONFLICT' : task.syncState === 'PENDING_CREATE' ? 'PENDING_CREATE' : 'PENDING_UPDATE' }
}

export function softDeleteTask(task: Task, now = new Date().toISOString()): Task {
  if (task.deletedAt) return task
  return { ...task, deletedAt: now, updatedAt: now, version: task.version + 1, syncState: 'PENDING_DELETE' }
}
export function restoreTask(task: Task, now = new Date().toISOString()): Task {
  if (!task.deletedAt) return task
  return { ...task, deletedAt: undefined, updatedAt: now, version: task.version + 1,
    syncState: task.serverId ? 'PENDING_UPDATE' : 'PENDING_CREATE' }
}
export const isVisibleTask = (task: Task) => !task.deletedAt && task.status !== 'ARCHIVED' && task.status !== 'CANCELLED'
export type TaskView = 'today' | 'inbox' | 'upcoming' | 'all' | 'completed'
export function selectTasks(tasks: Task[], view: TaskView, today: string): Task[] {
  return tasks.filter(isVisibleTask).filter(task => {
    if (view === 'completed') return task.completed
    if (task.completed) return false
    if (view === 'today') return !!task.dateKey && task.dateKey <= today
    if (view === 'inbox') return task.list === 'Inbox'
    if (view === 'upcoming') return !!task.dateKey && task.dateKey > today
    return true
  }).sort((a, b) => view === 'upcoming' || view === 'today'
    ? (a.dateKey || '').localeCompare(b.dateKey || '') || (a.time || '').localeCompare(b.time || '') || a.sortOrder - b.sortOrder
    : a.sortOrder - b.sortOrder)
}
