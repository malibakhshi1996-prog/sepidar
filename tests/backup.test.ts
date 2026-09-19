import test from 'node:test'
import assert from 'node:assert/strict'
import { exportBackup, parseBackup, mergeBackup, exportTasksCsv, type BackupData } from '../src/core/backup.ts'
import { createTask, softDeleteTask } from '../src/core/task.ts'
const empty = (): BackupData => ({ tasks: [], habits: [], focusSessions: [], activeTheme: 'default' })
test('JSON roundtrip retains tasks, tombstones, focus seconds and habit history', () => {
  const data = { ...empty(), tasks: [softDeleteTask(createTask({ title: 'یادداشت فارسی' }))], habits: [{ id: 'h1', title: 'مطالعه', color: '#4773fa', frequency: 'هر روز', icon: 'book', streak: 0, completedToday: false, bestStreak: 0, completionDates: ['1405-06-27'] }], focusSessions: [{ id: 'f1', startAt: '2026-09-18T10:00:00Z', endAt: '2026-09-18T10:00:10Z', duration: 0, durationSeconds: 10, type: 'POMODORO' as const, completed: false, interrupted: true }] }
  assert.deepEqual(parseBackup(exportBackup(data)), JSON.parse(JSON.stringify(data)))
})
test('restore merges idempotently without overwriting local tasks or tombstones', () => {
  const task = createTask({ title: 'قدیمی' })
  const current = { ...empty(), tasks: [softDeleteTask({ ...task, title: 'تغییر محلی' })] }
  const incoming = { ...empty(), tasks: [task, { ...createTask({ title: 'جدید' }), serverId: 'foreign', userId: 'other', syncState: 'SYNCED' as const }] }
  const merged = mergeBackup(current, incoming)
  assert.equal(merged.tasks.length, 2); assert.deepEqual(merged.tasks[0], current.tasks[0])
  assert.equal(merged.tasks[1].serverId, undefined); assert.equal(merged.tasks[1].syncState, 'PENDING_CREATE')
  assert.deepEqual(mergeBackup(merged, incoming), merged)
})
test('malformed, future, duplicate-id and wrong-field-type backups are rejected', () => {
  assert.throws(() => parseBackup('not json'))
  const valid = JSON.parse(exportBackup({ ...empty(), tasks: [createTask({ title: 'test' })] }))
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, version: 2 })))
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, data: { ...valid.data, tasks: [...valid.data.tasks, ...valid.data.tasks] } })))
  valid.data.tasks[0].dateKey = { invalid: true }
  assert.throws(() => parseBackup(JSON.stringify(valid)))
})
test('CSV quotes commas/newlines and neutralizes formula injection', () => {
  const csv = exportTasksCsv([createTask({ title: '=HYPERLINK("bad")', note: 'الف،\nب' })])
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"')); assert.ok(csv.includes('"الف،\nب"'))
  assert.ok(!exportTasksCsv([softDeleteTask(createTask({ title: 'deleted' }))]).includes('deleted'))
})
