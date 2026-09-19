export type SyncState = 'SYNCED' | 'PENDING_CREATE' | 'PENDING_UPDATE' | 'PENDING_DELETE' | 'CONFLICT'
export type TaskStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
export type Priority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

export interface TaskRecord {
  id: string
  serverId?: string
  userId: string
  title: string
  description?: string
  note?: string
  status: TaskStatus
  priority: Priority
  listId?: string
  projectId?: string
  parentTaskId?: string
  startAt?: string
  dueAt?: string
  allDay: boolean
  timezone: string
  recurrenceRule?: string
  recurrenceMode?: 'SCHEDULED_DATE' | 'COMPLETION_DATE'
  estimatedDuration?: number
  actualDuration?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  deletedAt?: string
  syncState: SyncState
  version: number
}

export type ReminderType = 'AT_TIME' | 'BEFORE_TASK' | 'RECURRING' | 'LOCATION'
export interface TaskReminder {
  id: string
  taskId: string
  type: ReminderType
  remindAt?: string
  minutesBefore?: number
  timezone: string
  enabled: boolean
  localScheduled: boolean
  lastTriggeredAt?: string
  version: number
}

export interface FocusSessionRecord {
  id: string
  userId: string
  taskId?: string
  startAt: string
  endAt?: string
  duration: number
  type: 'POMODORO' | 'STOPWATCH' | 'SHORT_BREAK' | 'LONG_BREAK'
  completed: boolean
  interrupted: boolean
  syncState: SyncState
  version: number
}

export interface HabitRecord {
  id: string
  userId: string
  title: string
  icon?: string
  color?: string
  frequency: string
  target?: number
  unit?: string
  startDate: string
  archived: boolean
  syncState: SyncState
  version: number
}

export interface HabitCompletion {
  id: string
  habitId: string
  dateKey: string
  completedAt: string
  status: 'COMPLETED' | 'SKIPPED' | 'FAILED'
  note?: string
  version: number
}

export interface CalendarEventDefinition {
  id: string
  title: string
  description?: string
  category: 'OFFICIAL_HOLIDAY' | 'OFFICIAL_EVENT' | 'RELIGIOUS' | 'CULTURAL' | 'ANCIENT_IRAN' | 'GLOBAL' | 'PROFESSIONAL' | 'SOCIAL' | 'UNOFFICIAL' | 'USER_DEFINED'
  calendarSystem: 'JALALI' | 'GREGORIAN' | 'HIJRI'
  dateRule: string
  year?: number
  month: number
  day: number
  isHoliday: boolean
  isOfficial: boolean
  country?: string
  region?: string
  source?: string
  priority: number
  enabledByDefault: boolean
  startYear?: number
  endYear?: number
  version: number
}
