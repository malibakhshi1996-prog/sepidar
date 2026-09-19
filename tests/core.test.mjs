import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizePersianSearch } from '../src/core/search.ts'
import { parseNaturalDateValue } from '../src/core/date.ts'

test('Persian search normalization is tolerant', () => {
  assert.equal(normalizePersianSearch('  كِتاب‌ها ١٢ '), 'کتابها 12')
})

test('Jalali domain accepts Persian date tokens for the Phase 0 parser contract', () => {
  const input = '۲۸ اسفند ۱۴۰۵'
  assert.deepEqual(parseNaturalDateValue(input)?.value, { year: 1405, month: 12, day: 28 })
})
