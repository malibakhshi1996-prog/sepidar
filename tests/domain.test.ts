import test from 'node:test'
import assert from 'node:assert/strict'
import { addJalaliDays, addJalaliMonths, calendarCells, calendarLabelsForJalali, formatCalendarInput, formatJalaliInput, parseCalendarInput, todayJalali, jalaliAtToDate, jalaliKey, jalaliWeekday, moveJalaliCalendar, parseJalaliInput, parseNaturalDateValue } from '../src/core/date.ts'
import { eventsForJalaliDate } from '../src/core/events.ts'
import { parseQuickAdd } from '../src/core/nlp.ts'
import { parseRecurrence, nextOccurrence } from '../src/core/recurrence.ts'
import { matchesPersianQuery } from '../src/core/search.ts'
const now = new Date('2026-09-18T10:00:00Z')
test('Jalali leap and non-leap Esfand rolls into Farvardin', () => {
  assert.equal(jalaliKey(addJalaliDays({ year: 1399, month: 12, day: 30 }, 1)), '1400-01-01')
  assert.equal(jalaliKey(addJalaliDays({ year: 1400, month: 12, day: 29 }, 1)), '1401-01-01')
  assert.equal(jalaliKey(addJalaliDays({ year: 1405, month: 6, day: 31 }, 1)), '1405-07-01')
  assert.equal(jalaliKey(addJalaliMonths({ year: 1405, month: 7, day: 30 }, -1)), '1405-06-30')
})
test('Vilia-style calendar range is Saturday-first and accepts Persian date input', () => {
  const anchor = { year: 1405, month: 6, day: 27 }
  assert.deepEqual(parseJalaliInput('۱۴۰۵/۰۶/۲۷'), anchor)
  assert.deepEqual(parseJalaliInput('1405-6-27'), anchor)
  assert.equal(formatJalaliInput(anchor), '۱۴۰۵/۰۶/۲۷')
  const month = calendarCells(anchor, 'month')
  assert.equal(month.length, 42)
  assert.equal(month[0].weekday, 0)
  assert.equal(month[0].key, '1405-05-31')
  assert.equal(calendarCells(anchor, 'week').length, 7)
  assert.equal(jalaliKey(moveJalaliCalendar(anchor, 'week', 1)), '1405-07-03')
})
test('Iran today and notification time are independent of host timezone', () => {
  assert.equal(jalaliKey(todayJalali(new Date('2026-09-18T21:00:00Z'))), '1405-06-28')
  assert.equal(jalaliAtToDate('1405-06-27', '۰۹:۰۰')?.toISOString(), '2026-09-18T05:30:00.000Z')
  assert.equal(jalaliAtToDate('1405-06-27', '٢٣:٥٩')?.toISOString(), '2026-09-18T20:29:00.000Z')
  for (const time of ['25:00', '10:99', 'bad']) assert.equal(jalaliAtToDate('1405-06-27', time), null)
  assert.equal(jalaliAtToDate('1400-12-30', '09:00'), null)
})
test('one deadline can be entered and displayed in all three calendars', () => {
  const value = { year: 1405, month: 6, day: 27 }
  for (const system of ['JALALI', 'GREGORIAN', 'HIJRI'] as const) assert.deepEqual(parseCalendarInput(formatCalendarInput(value, system), system), value)
  const labels = calendarLabelsForJalali(value)
  assert.ok(labels.jalali.includes('شهریور'))
  assert.ok(labels.gregorian.length > 6)
  assert.ok(labels.hijri.length > 6)
})
test('offline calendar includes official, historic and moving religious events', () => {
  assert.ok(eventsForJalaliDate({ year: 1405, month: 1, day: 1 }).some(event => event.title.includes('نوروز')))
  assert.ok(eventsForJalaliDate({ year: 1405, month: 3, day: 3 }).some(event => event.title.includes('خرمشهر')))
  const mabath = parseCalendarInput('۱۴۴۷/۰۷/۲۷', 'HIJRI')
  assert.ok(mabath && eventsForJalaliDate(mabath).some(event => event.title.includes('مبعث')))
})
test('weekday parsing matches Thursday and Sunday, not the substring Saturday', () => {
  assert.equal(jalaliWeekday(parseNaturalDateValue('پنجشنبه', now)!.value), 5)
  assert.equal(jalaliWeekday(parseNaturalDateValue('یکشنبه', now)!.value), 1)
  assert.equal(jalaliKey(parseNaturalDateValue('پس‌فردا', now)!.value), '1405-06-29')
})
test('NLP handles real Persian examples and preserves title words around recurrence', () => {
  const a = parseQuickAdd('فردا ساعت ۸ شب با احمد تماس بگیر', now)
  assert.equal(a.time, '20:00'); assert.equal(a.dateKey, '1405-06-28'); assert.equal(a.title, 'با احمد تماس بگیر')
  const b = parseQuickAdd('هر پنجشنبه ساعت ۹ گزارش فروش رو بررسی کن', now)
  assert.equal(b.title, 'گزارش فروش رو بررسی کن'); assert.equal(b.time, '09:00'); assert.equal(b.recurrence, 'هر پنجشنبه')
  assert.equal(jalaliWeekday(parseNaturalDateValue(b.date, now)!.value), 5)
  assert.equal(parseQuickAdd('۲۸ اسفند خرید عید', now).dateKey, '1405-12-28')
  assert.equal(parseQuickAdd('سه روز دیگه ساعت ۴ جلسه', now).dateKey, '1405-06-30')
  assert.equal(parseQuickAdd('فردا ساعت نه با علی تماس بگیر', now).time, '09:00')
  assert.equal(parseQuickAdd('هر دو هفته گزارش', now).title, 'گزارش')
})
test('NLP reports invalid and ambiguous times without inventing an evening appointment', () => {
  const invalid = parseQuickAdd('ساعت ۲۹:۷۰ جلسه', now)
  assert.equal(invalid.time, ''); assert.equal(invalid.warnings.length, 1)
  assert.ok(parseQuickAdd('فردا ساعت ۸ تماس', now).warnings.length)
  assert.equal(parseQuickAdd('۸ صبح مطالعه', now).time, '08:00')
  assert.equal(parseQuickAdd('۱۲ صبح مطالعه', now).time, '00:00')
  assert.equal(parseQuickAdd('پس فردا خرید', now).title, 'خرید')
})
test('recurrence clamps leap Esfand and month ends, rejects zero and accepts Persian digits', () => {
  assert.equal(jalaliKey(nextOccurrence({ year: 1399, month: 12, day: 30 }, { kind: 'YEARLY', interval: 1 })), '1400-12-29')
  assert.equal(jalaliKey(nextOccurrence({ year: 1405, month: 6, day: 31 }, { kind: 'MONTHLY', interval: 1 })), '1405-07-30')
  assert.deepEqual(parseRecurrence('هر ۲ هفته'), { kind: 'WEEKLY', interval: 2 })
  assert.equal(parseRecurrence('هر ۰ روز'), null)
  assert.throws(() => nextOccurrence({ year: 1405, month: 1, day: 1 }, { kind: 'DAILY', interval: 0 }))
  assert.equal(jalaliWeekday(nextOccurrence(todayJalali(now), parseRecurrence('هر پنجشنبه')!)), 5)
})
test('real search engine tolerates Persian/Arabic letters, diacritics, half spaces and digits', () => {
  assert.equal(matchesPersianQuery(['كِتاب‌ها ١٢'], 'کتاب ها ۱۲'), true)
  assert.equal(matchesPersianQuery(['جلسه علی'], 'علي'), true)
  assert.equal(matchesPersianQuery(['تهران'], 'شیراز'), false)
})
