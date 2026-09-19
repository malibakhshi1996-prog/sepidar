import test from 'node:test'
import assert from 'node:assert/strict'
import { focusSeconds, endFocus } from '../src/core/focus.ts'
const start = '2026-09-18T10:00:00.000Z'
test('wall-clock focus remains accurate after throttled background ticks', () => {
  assert.equal(focusSeconds('pomo', start, Date.parse(start) + 120_000), 1380)
  assert.equal(focusSeconds('stopwatch', start, Date.parse(start) + 120_000), 120)
  assert.equal(focusSeconds('pomo', start, Date.parse(start) + 3_600_000), 0)
})
test('focus completion caps at 25 minutes, interruption records only this session', () => {
  const complete = endFocus('pomo', start, new Date(Date.parse(start) + 3_600_000))
  assert.equal(complete.durationSeconds, 1500); assert.equal(complete.completed, true)
  assert.equal(complete.endAt, '2026-09-18T10:25:00.000Z')
  const interrupted = endFocus('pomo', start, new Date(Date.parse(start) + 10_000))
  assert.equal(interrupted.durationSeconds, 10); assert.equal(interrupted.interrupted, true)
})
