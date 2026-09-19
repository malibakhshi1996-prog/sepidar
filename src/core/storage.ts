export const APP_DATABASE_NAME = 'sepidar-offline'
export const APP_DATABASE_VERSION = 1
export const APP_STATE_SCHEMA_VERSION = 2
const FALLBACK_KEY = 'sepidar.snapshot'
export class StorageError extends Error {}

const APP_STATE_STORE = 'app_state'
const APP_STATE_KEY = 'current'

export interface AppStateDefaults<TTask, THabit, TFocusSession> {
  tasks: TTask[]
  habits: THabit[]
  focusSessions: TFocusSession[]
  activeTheme: string
}

export interface AppSnapshot<TTask, THabit, TFocusSession> extends AppStateDefaults<TTask, THabit, TFocusSession> {
  schemaVersion: number
  updatedAt: string
  revision?: number
}

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>

function cloneArray<T>(value: T[]): T[] {
  return value.map((item) => typeof structuredClone === 'function' ? structuredClone(item) : JSON.parse(JSON.stringify(item)))
}

function parseArray<T>(storage: StorageReader, key: string, fallback: T[]): T[] {
  try {
    const value = storage.getItem(key)
    if (!value) return cloneArray(fallback)
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : cloneArray(fallback)
  } catch {
    return cloneArray(fallback)
  }
}

export function legacySnapshot<TTask, THabit, TFocusSession>(
  defaults: AppStateDefaults<TTask, THabit, TFocusSession>,
  storage: StorageReader,
): AppSnapshot<TTask, THabit, TFocusSession> {
  let activeTheme = defaults.activeTheme
  try { activeTheme = storage.getItem('sepidar.theme') || defaults.activeTheme } catch { /* Keep the default when legacy storage is unavailable. */ }
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    tasks: parseArray(storage, 'sepidar.tasks', defaults.tasks),
    habits: parseArray(storage, 'sepidar.habits', defaults.habits),
    focusSessions: parseArray(storage, 'sepidar.focusSessions', defaults.focusSessions),
    activeTheme,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeSnapshot<TTask, THabit, TFocusSession>(
  candidate: unknown,
  fallback: AppSnapshot<TTask, THabit, TFocusSession>,
): AppSnapshot<TTask, THabit, TFocusSession> {
  if (!candidate || typeof candidate !== 'object') throw new StorageError('دادهٔ ذخیره‌شده قابل خواندن نیست؛ بازنویسی متوقف شد.')
  const value = candidate as Partial<AppSnapshot<TTask, THabit, TFocusSession>>
  if (typeof value.schemaVersion !== 'number' || value.schemaVersion < 1 || value.schemaVersion > APP_STATE_SCHEMA_VERSION) {
    throw new StorageError('این داده با نسخهٔ برنامه سازگار نیست. نسخهٔ جدیدتر را نصب کنید.')
  }
  if (!Array.isArray(value.tasks) || !Array.isArray(value.habits) || !Array.isArray(value.focusSessions)) {
    throw new StorageError('مجموعهٔ داده ناقص است؛ برای جلوگیری از حذف اطلاعات، ذخیره متوقف شد.')
  }
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    tasks: Array.isArray(value.tasks) ? value.tasks : fallback.tasks,
    habits: Array.isArray(value.habits) ? value.habits : fallback.habits,
    focusSessions: Array.isArray(value.focusSessions) ? value.focusSessions : fallback.focusSessions,
    activeTheme: typeof value.activeTheme === 'string' && value.activeTheme ? value.activeTheme : fallback.activeTheme,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    revision: Number.isSafeInteger(value.revision) && value.revision! >= 0 ? value.revision : 0,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_DATABASE_NAME, APP_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(APP_STATE_STORE)) database.createObjectStore(APP_STATE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'))
  })
}

async function readIndexedSnapshot(): Promise<unknown> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(APP_STATE_STORE, 'readonly').objectStore(APP_STATE_STORE).get(APP_STATE_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed'))
    })
  } finally {
    database.close()
  }
}

async function writeIndexedSnapshot(snapshot: unknown): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(APP_STATE_STORE, 'readwrite')
      transaction.objectStore(APP_STATE_STORE).put(snapshot, APP_STATE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB write failed'))
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB write aborted'))
    })
  } finally {
    database.close()
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function writeFallback(snapshot: unknown, storage: StorageWriter | null): void {
  if (!storage) throw new StorageError('ذخیره‌سازی در دسترس نیست. از داده‌ها پشتیبان بگیرید.')
  // Single-key atomic fallback. Legacy keys are retained, never deleted or partially overwritten.
  try { storage.setItem(FALLBACK_KEY, JSON.stringify(snapshot)) }
  catch { throw new StorageError('ذخیره انجام نشد؛ فضای دستگاه یا مجوز ذخیره‌سازی را بررسی کنید.') }
}

let lastWrite: Promise<unknown> = Promise.resolve()
let forceFallback = false
let lastRevision = 0

export async function loadAppSnapshot<TTask, THabit, TFocusSession>(
  defaults: AppStateDefaults<TTask, THabit, TFocusSession>,
): Promise<AppSnapshot<TTask, THabit, TFocusSession>> {
  const storage = browserStorage()
  await lastWrite.catch(() => undefined)
  let fallback = storage ? legacySnapshot(defaults, storage) : { ...defaults, schemaVersion: APP_STATE_SCHEMA_VERSION, updatedAt: new Date().toISOString() }
  let localSnapshot: AppSnapshot<TTask, THabit, TFocusSession> | undefined
  const storedFallback = storage?.getItem(FALLBACK_KEY)
  if (storedFallback) {
    try { localSnapshot = normalizeSnapshot(JSON.parse(storedFallback), fallback); fallback = localSnapshot }
    catch (error) { throw error instanceof StorageError ? error : new StorageError('پشتیبان محلی آسیب دیده است؛ داده بازنویسی نشد.') }
  }
  if (typeof indexedDB === 'undefined') { forceFallback = true; lastRevision = Math.max(lastRevision, fallback.revision || 0); return fallback }
  let stored: unknown
  try {
    stored = await readIndexedSnapshot()
  } catch {
    forceFallback = true
    throw new StorageError('خواندن دیتابیس ممکن نشد. برای جلوگیری از جایگزینی داده با نسخهٔ قدیمی، برنامه را دوباره باز کنید.')
  }
  forceFallback = false
  const primary = stored ? normalizeSnapshot(stored, fallback) : undefined
  // A fallback write can be newer after a previous IDB failure. Never replace it with stale IDB data.
  const selected = primary && (!localSnapshot || (primary.revision || 0) > (localSnapshot.revision || 0) ||
    ((primary.revision || 0) === (localSnapshot.revision || 0) && primary.updatedAt > localSnapshot.updatedAt)) ? primary : fallback
  lastRevision = Math.max(lastRevision, selected.revision || 0)
  try { await writeIndexedSnapshot(selected) } catch { forceFallback = true }
  return selected
}

export function saveAppSnapshot<TTask, THabit, TFocusSession>(
  state: AppStateDefaults<TTask, THabit, TFocusSession>,
): Promise<'indexeddb' | 'localstorage'> {
  const snapshot: AppSnapshot<TTask, THabit, TFocusSession> = structuredClone({
    ...state,
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    revision: ++lastRevision,
  })
  const write = async (): Promise<'indexeddb' | 'localstorage'> => {
    if (!forceFallback && typeof indexedDB !== 'undefined') {
      try { await writeIndexedSnapshot(snapshot); return 'indexeddb' }
      catch { forceFallback = true }
    }
    writeFallback(snapshot, browserStorage())
    return 'localstorage'
  }
  const result = lastWrite.catch(() => undefined).then(write)
  lastWrite = result
  return result
}
