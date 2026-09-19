import test from 'node:test'
import assert from 'node:assert/strict'
import { createTask, migrateTask, selectTasks } from '../src/core/task.ts'
import { exportBackup, parseBackup } from '../src/core/backup.ts'

test('10,000-task domain dataset with 1,000 completions, 500 recurring tasks and 100 habits roundtrips', () => {
  const start = performance.now()
  const tasks = Array.from({ length: 10_000 }, (_, i) => migrateTask({ ...createTask({ title: `آزمون ${i}`, dateKey: '1405-06-27', recurrence: i < 500 ? 'هر روز' : undefined }), status: i < 1000 ? 'COMPLETED' : 'OPEN' }))
  assert.equal(selectTasks(tasks, 'completed', '1405-06-27').length, 1000)
  assert.equal(selectTasks(tasks, 'today', '1405-06-27').length, 9000)
  const habits = Array.from({ length: 100 }, (_, i) => ({ id: `h${i}`, title: `عادت ${i}`, frequency: 'هر روز', icon: 'book', color: '#4773fa', completedToday: false, streak: 0, completionDates: ['1405-06-27'] }))
  const backup = exportBackup({ tasks, habits, focusSessions: [], activeTheme: 'default' })
  const parsed = parseBackup(backup)
  assert.equal(parsed.tasks.length, 10_000); assert.equal(parsed.habits.length, 100)
  assert.equal(parsed.tasks.filter(t => t.recurrence).length, 500)
  console.log(`Domain scale fixture: ${Math.round(performance.now() - start)}ms, ${Math.round(backup.length / 1024)} KiB JSON; not a UI/FPS benchmark.`)
})
