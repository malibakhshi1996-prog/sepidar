import test from 'node:test'
import assert from 'node:assert/strict'
import { isLeapJalaaliYear, isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js'

test('Jalali leap year and Esfand validation', () => {
  assert.equal(isLeapJalaaliYear(1399), true)
  assert.equal(isValidJalaaliDate(1399, 12, 30), true)
  assert.equal(isValidJalaaliDate(1400, 12, 30), false)
})

test('Jalali/Gregorian conversion round trip', () => {
  const gregorian = toGregorian(1405, 6, 27)
  const jalali = toJalaali(gregorian.gy, gregorian.gm, gregorian.gd)
  assert.deepEqual(jalali, { jy: 1405, jm: 6, jd: 27 })
})

test('Jalali calendar uses Saturday as the first weekday', () => {
  const date = toGregorian(1405, 6, 27)
  const weekday = (new Date(Date.UTC(date.gy, date.gm - 1, date.gd)).getUTCDay() + 1) % 7
  assert.equal(weekday, 6)
})
