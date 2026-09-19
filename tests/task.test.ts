import test from 'node:test'
import assert from 'node:assert/strict'
import { createTask, migrateTask, editTask, softDeleteTask, restoreTask, selectTasks } from '../src/core/task.ts'
const now = '2026-09-18T10:00:00.000Z'

test('legacy task migration is additive and idempotent', () => {
  const task = migrateTask({ id: 'old', title: 'کار', list: 'Inbox', priority: 'none', completed: true, note: 'یادداشت' }, now)
  assert.equal(task.status, 'COMPLETED'); assert.equal(task.note, 'یادداشت'); assert.equal(task.version, 1)
  assert.deepEqual(migrateTask(task, '2027-01-01T00:00:00Z'), task)
})
test('task edits protect identity and retain pending create until acknowledged', () => {
  const task = createTask({ title: 'اول' }, now)
  const edited = editTask(task, { title: 'دوم', id: 'forged', userId: 'other', version: 999 }, now)
  assert.equal(edited.id, task.id); assert.equal(edited.userId, 'local'); assert.equal(edited.version, 2)
  assert.equal(edited.syncState, 'PENDING_CREATE')
  assert.equal(editTask({ ...task, serverId: 's1', syncState: 'SYNCED' }, { note: 'n' }).syncState, 'PENDING_UPDATE')
  assert.equal(editTask({ ...task, syncState: 'CONFLICT' }, { title: 'سوم' }).syncState, 'CONFLICT')
})
test('soft deletion is idempotent and restoring retains data and completion status', () => {
  const task = editTask(createTask({ title: 'کار' }, now), { completed: true }, now)
  const deleted = softDeleteTask(task, now)
  assert.equal(deleted.syncState, 'PENDING_DELETE'); assert.equal(deleted.status, 'COMPLETED')
  assert.deepEqual(softDeleteTask(deleted), deleted)
  assert.equal(selectTasks([deleted], 'completed', '1405-06-27').length, 0)
  const restored = restoreTask(deleted, now)
  assert.equal(restored.deletedAt, undefined); assert.equal(restored.title, task.title)
  assert.equal(restored.syncState, 'PENDING_CREATE'); assert.equal(restored.version, 4)
})
test('today excludes undated tasks but includes overdue, upcoming and inbox are independent', () => {
  const tasks = [createTask({ title: 'بدون تاریخ' }), createTask({ title: 'عقب', dateKey: '1405-06-26' }), createTask({ title: 'امروز', dateKey: '1405-06-27' }), createTask({ title: 'آینده', dateKey: '1405-06-28' })]
  assert.deepEqual(selectTasks(tasks, 'today', '1405-06-27').map(t => t.title), ['عقب', 'امروز'])
  assert.deepEqual(selectTasks(tasks, 'upcoming', '1405-06-27').map(t => t.title), ['آینده'])
  assert.equal(selectTasks(tasks, 'inbox', '1405-06-27').length, 4)
})
test('blank titles are rejected and completions maintain timestamps', () => {
  assert.throws(() => createTask({ title: '  ' }))
  const task = createTask({ title: 'test' }, now)
  assert.throws(() => editTask(task, { title: ' ' }))
  const completed = editTask(task, { completed: true }, now)
  assert.equal(completed.completedAt, now)
  assert.equal(editTask(completed, { completed: false }).completedAt, undefined)
})
