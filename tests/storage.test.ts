import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { APP_DATABASE_NAME, loadAppSnapshot, saveAppSnapshot, normalizeSnapshot, legacySnapshot } from '../src/core/storage.ts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const defaults = {
  tasks: [{ id: 'seed', title: 'کار اولیه' }],
  habits: [{ id: 'habit-seed', title: 'عادت اولیه' }],
  focusSessions: [] as Array<{ id: string }>,
  activeTheme: 'default',
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(APP_DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Test database deletion blocked'))
  })
}

test('legacy localStorage data migrates to IndexedDB on first launch', async () => {
  await deleteDatabase()
  storage.clear()
  storage.setItem('zitar.tasks', JSON.stringify([{ id: 'legacy', title: 'کار قدیمی' }]))
  storage.setItem('zitar.theme', 'turquoise')

  const migrated = await loadAppSnapshot(defaults)
  assert.equal(migrated.tasks[0].id, 'legacy')
  assert.equal(migrated.activeTheme, 'turquoise')

  storage.setItem('zitar.tasks', JSON.stringify([{ id: 'changed-legacy', title: 'نباید جایگزین شود' }]))
  const reopened = await loadAppSnapshot(defaults)
  assert.equal(reopened.tasks[0].id, 'legacy')
})

test('saved snapshot persists all primary offline collections', async () => {
  await deleteDatabase()
  storage.clear()
  await saveAppSnapshot({
    tasks: [{ id: 'task-1', title: 'ثبت در دیتابیس' }],
    habits: [{ id: 'habit-1', title: 'مطالعه' }],
    focusSessions: [{ id: 'focus-1' }],
    activeTheme: 'peach',
  })

  const restored = await loadAppSnapshot(defaults)
  assert.deepEqual(restored.tasks.map((task) => task.id), ['task-1'])
  assert.deepEqual(restored.habits.map((habit) => habit.id), ['habit-1'])
  assert.deepEqual(restored.focusSessions.map((session) => session.id), ['focus-1'])
  assert.equal(restored.activeTheme, 'peach')
})

test('schema v1 migration preserves all collections, future or corrupt snapshots are rejected', () => {
  const snapshot = legacySnapshot(defaults, new MemoryStorage())
  const old = { ...snapshot, schemaVersion: 1 }
  assert.equal(normalizeSnapshot(old, snapshot).schemaVersion, 2)
  assert.deepEqual(normalizeSnapshot(old, snapshot).tasks, old.tasks)
  assert.throws(() => normalizeSnapshot({ ...old, schemaVersion: 999 }, snapshot))
  assert.throws(() => normalizeSnapshot({ ...old, tasks: null }, snapshot))
})
test('concurrent writes are serialized and capture state before caller mutation', async () => {
  await deleteDatabase(); storage.clear(); await loadAppSnapshot(defaults)
  const first = { ...defaults, tasks: [{ id: 'first', title: 'اول' }] }
  const a = saveAppSnapshot(first)
  first.tasks[0].title = 'mutation after save'
  await a
  assert.equal((await loadAppSnapshot(defaults)).tasks[0].title, 'اول')
  await Promise.all(Array.from({ length: 30 }, (_, i) => saveAppSnapshot({ ...defaults, tasks: [{ id: String(i), title: 't' }] })))
  assert.equal((await loadAppSnapshot(defaults)).tasks[0].id, '29')
})
test('fallback is atomic, survives reload, and newer fallback recovers into IndexedDB', async () => {
  await deleteDatabase(); storage.clear(); await loadAppSnapshot(defaults)
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
  assert.equal(await saveAppSnapshot({ ...defaults, tasks: [{ id: 'fallback', title: 'پشتیبان' }] }), 'localstorage')
  assert.equal((await loadAppSnapshot(defaults)).tasks[0].id, 'fallback')
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB })
  assert.equal((await loadAppSnapshot(defaults)).tasks[0].id, 'fallback')
  storage.clear()
  assert.equal((await loadAppSnapshot(defaults)).tasks[0].id, 'fallback')
})
test('total storage failure rejects rather than falsely reporting success', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } } })
  await assert.rejects(saveAppSnapshot(defaults), /ذخیره انجام نشد/)
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  await loadAppSnapshot(defaults)
  await assert.doesNotReject(saveAppSnapshot(defaults))
})
