export type CalendarSystem = 'JALALI' | 'GREGORIAN' | 'HIJRI'
import { isLeapJalaaliYear, isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js'

export interface JalaliDateValue { year: number; month: number; day: number }
export type JalaliCalendarView = 'day' | 'week' | 'month'
export interface JalaliCalendarCell extends JalaliDateValue {
  key: string
  inRange: boolean
  weekday: number
}
export const jalaliMonthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export const jalaliWeekdayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const faDigits = (value: string | number) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
const latinDigits = (value: string) => value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

export const todayJalali = (now = new Date(), timezone = 'Asia/Tehran'): JalaliDateValue => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now)
  const field = (name: string) => Number(parts.find(part => part.type === name)!.value)
  const result = toJalaali(field('year'), field('month'), field('day'))
  return { year: result.jy, month: result.jm, day: result.jd }
}
export const jalaliKey = (value: JalaliDateValue) => `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
export const parseJalaliKey = (key: string): JalaliDateValue | null => {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const value = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidJalaaliDate(value.year, value.month, value.day) ? value : null
}
export const formatJalaliInput = (value: JalaliDateValue) => `${faDigits(value.year)}/${faDigits(String(value.month).padStart(2, '0'))}/${faDigits(String(value.day).padStart(2, '0'))}`
export const parseJalaliInput = (input: string): JalaliDateValue | null => {
  const normalized = latinDigits(input).trim().replace(/[٫۔،]/g, '/').replace(/[.\-]/g, '/').replace(/\s+/g, '')
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const value = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidJalaaliDate(value.year, value.month, value.day) ? value : null
}
export const calendarRange = (anchor: JalaliDateValue, view: JalaliCalendarView) => {
  if (view === 'day') return { from: anchor, to: anchor }
  if (view === 'week') {
    const from = addJalaliDays(anchor, -jalaliWeekday(anchor))
    return { from, to: addJalaliDays(from, 6) }
  }
  const from = addJalaliDays({ year: anchor.year, month: anchor.month, day: 1 }, -jalaliWeekday({ year: anchor.year, month: anchor.month, day: 1 }))
  return { from, to: addJalaliDays(from, 41) }
}
export const calendarCells = (anchor: JalaliDateValue, view: JalaliCalendarView): JalaliCalendarCell[] => {
  const range = calendarRange(anchor, view)
  const count = view === 'day' ? 1 : view === 'week' ? 7 : 42
  return Array.from({ length: count }, (_, index) => {
    const value = addJalaliDays(range.from, index)
    const inRange = view !== 'month' || (value.year === anchor.year && value.month === anchor.month)
    return { ...value, key: jalaliKey(value), inRange, weekday: jalaliWeekday(value) }
  })
}
export const moveJalaliCalendar = (anchor: JalaliDateValue, view: JalaliCalendarView, amount: number) => {
  if (view === 'day') return addJalaliDays(anchor, amount)
  if (view === 'week') return addJalaliDays(anchor, amount * 7)
  return addJalaliMonths({ ...anchor, day: 1 }, amount)
}
export const jalaliViewLabel = (anchor: JalaliDateValue, view: JalaliCalendarView) => {
  if (view === 'day') return jalaliLabel(anchor)
  if (view === 'week') {
    const range = calendarRange(anchor, 'week')
    if (range.from.year === range.to.year && range.from.month === range.to.month) return `${faDigits(range.from.day)} تا ${faDigits(range.to.day)} ${jalaliMonthNames[range.from.month - 1]} ${faDigits(range.from.year)}`
    return `${jalaliShortLabel(range.from)} تا ${jalaliLabel(range.to)}`
  }
  return `${jalaliMonthNames[anchor.month - 1]} ${faDigits(anchor.year)}`
}
export const jalaliLabel = (value: JalaliDateValue) => `${faDigits(value.day)} ${jalaliMonthNames[value.month - 1]} ${faDigits(value.year)}`
export const jalaliShortLabel = (value: JalaliDateValue) => `${faDigits(value.day)} ${jalaliMonthNames[value.month - 1]}`

export const gregorianMonthNames = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر']
export const hijriMonthNames = ['محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذیقعده', 'ذیحجه']

const gregorianDateForJalali = (value: JalaliDateValue) => {
  const result = toGregorian(value.year, value.month, value.day)
  return new Date(Date.UTC(result.gy, result.gm - 1, result.gd, 12))
}

const hijriPartsForGregorian = (value: { year: number; month: number; day: number }) => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(value.year, value.month - 1, value.day, 12)))
  const part = (name: string) => Number(parts.find(item => item.type === name)?.value || 0)
  return { year: part('year'), month: part('month'), day: part('day') }
}

export const gregorianForJalali = (value: JalaliDateValue) => {
  const result = toGregorian(value.year, value.month, value.day)
  return { year: result.gy, month: result.gm, day: result.gd }
}

export const jalaliForGregorian = (value: { year: number; month: number; day: number }): JalaliDateValue => {
  const result = toJalaali(value.year, value.month, value.day)
  return { year: result.jy, month: result.jm, day: result.jd }
}

const calendarLabel = (value: JalaliDateValue, calendar: 'gregory' | 'islamic-umalqura') => {
  try {
    return new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}-nu-latn`, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(gregorianDateForJalali(value)).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  } catch {
    return ''
  }
}

export const gregorianLabelForJalali = (value: JalaliDateValue) => calendarLabel(value, 'gregory')
export const hijriLabelForJalali = (value: JalaliDateValue) => calendarLabel(value, 'islamic-umalqura')

const islamicToJulianDay = (year: number, month: number, day: number) => day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + 1948439 - 1
const julianDayToGregorian = (julianDay: number) => {
  const j = julianDay + 0.5
  const z = Math.floor(j)
  const a = z < 2299161 ? z : (() => { const alpha = Math.floor((z - 1867216.25) / 36524.25); return z + 1 + alpha - Math.floor(alpha / 4) })()
  const b = a + 1524
  const c = Math.floor((b - 122.1) / 365.25)
  const d = Math.floor(365.25 * c)
  const e = Math.floor((b - d) / 30.6001)
  const day = b - d - Math.floor(30.6001 * e)
  const month = e < 14 ? e - 1 : e - 13
  const year = month > 2 ? c - 4716 : c - 4715
  return { year, month, day }
}

export const gregorianForHijri = (value: { year: number; month: number; day: number }) => julianDayToGregorian(islamicToJulianDay(value.year, value.month, value.day))
export const jalaliForHijri = (value: { year: number; month: number; day: number }) => jalaliForGregorian(gregorianForHijri(value))

export const formatCalendarInput = (value: JalaliDateValue, system: CalendarSystem) => {
  if (system === 'JALALI') return `${value.year}/${String(value.month).padStart(2, '0')}/${String(value.day).padStart(2, '0')}`
  if (system === 'GREGORIAN') {
    const date = gregorianForJalali(value)
    return `${date.year}/${String(date.month).padStart(2, '0')}/${String(date.day).padStart(2, '0')}`
  }
  const parts = hijriPartsForGregorian(gregorianForJalali(value))
  const part = (name: 'year' | 'month' | 'day') => parts[name]
  return `${part('year')}/${String(part('month')).padStart(2, '0')}/${String(part('day')).padStart(2, '0')}`
}

export const parseCalendarInput = (input: string, system: CalendarSystem): JalaliDateValue | null => {
  const normalized = latinDigits(input).trim().replace(/[٫۔،.\-]/g, '/').replace(/\s+/g, '')
  const match = normalized.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const value = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  if (system === 'JALALI') return isValidJalaaliDate(value.year, value.month, value.day) ? value : null
  if (system === 'GREGORIAN') {
    const date = new Date(Date.UTC(value.year, value.month - 1, value.day, 12))
    if (date.getUTCFullYear() !== value.year || date.getUTCMonth() + 1 !== value.month || date.getUTCDate() !== value.day) return null
    return jalaliForGregorian(value)
  }
  if (value.month < 1 || value.month > 12 || value.day < 1 || value.day > 30 || value.year < 1) return null
  const approximate = gregorianForHijri(value)
  for (let offset = -4; offset <= 4; offset += 1) {
    const candidate = new Date(Date.UTC(approximate.year, approximate.month - 1, approximate.day + offset, 12))
    const greg = { year: candidate.getUTCFullYear(), month: candidate.getUTCMonth() + 1, day: candidate.getUTCDate() }
    const parts = hijriPartsForGregorian(greg)
    if (parts.year === value.year && parts.month === value.month && parts.day === value.day) return jalaliForGregorian(greg)
  }
  return jalaliForHijri(value)
}

export const calendarLabelsForJalali = (value: JalaliDateValue) => ({
  jalali: jalaliLabel(value),
  gregorian: gregorianLabelForJalali(value),
  hijri: hijriLabelForJalali(value),
})
export const jalaliAtToDate = (key: string, time: string, timezone = 'Asia/Tehran'): Date | null => {
  const value = parseJalaliKey(key)
  const match = latinDigits(time).match(/^(\d{1,2}):(\d{2})$/)
  if (!value || !match) return null
  const hour = Number(match[1]); const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  const gregorian = toGregorian(value.year, value.month, value.day)
  const wall = Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd, hour, minute)
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    const localEpoch = (instant: number) => {
      const parts = formatter.formatToParts(new Date(instant))
      const n = (name: string) => Number(parts.find(part => part.type === name)!.value)
      return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
    }
    let instant = wall
    for (let i = 0; i < 4; i++) { const delta = wall - localEpoch(instant); if (!delta) return new Date(instant); instant += delta }
    return localEpoch(instant) === wall ? new Date(instant) : null // Reject nonexistent wall times.
  } catch { return null }
}
export const jalaliWeekday = (value: JalaliDateValue) => {
  const gregorian = toGregorian(value.year, value.month, value.day)
  return (new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd)).getUTCDay() + 1) % 7
}
export const addJalaliDays = (value: JalaliDateValue, amount: number): JalaliDateValue => {
  const gregorian = toGregorian(value.year, value.month, value.day)
  const date = new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd + amount))
  const result = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  return { year: result.jy, month: result.jm, day: result.jd }
}
export const addJalaliMonths = (value: JalaliDateValue, amount: number): JalaliDateValue => {
  const zeroBased = value.year * 12 + (value.month - 1) + amount
  const year = Math.floor(zeroBased / 12)
  const month = zeroBased % 12 + 1
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : isLeapJalaaliYear(year) ? 30 : 29
  return { year, month, day: Math.min(value.day, maxDay) }
}

export const parseNaturalDateValue = (input: string, now = new Date()): { value: JalaliDateValue; label: string } | null => {
  const normalized = latinDigits(input).replace(/[يى]/g, 'ی').replace(/[ك]/g, 'ک').replace(/\s+/g, ' ').trim()
  const today = todayJalali(now)
  if (/امروز/.test(normalized)) return { value: today, label: 'امروز' }
  if (/پس‌فردا|پس فردا/.test(normalized)) return { value: addJalaliDays(today, 2), label: 'پس‌فردا' }
  if (/فردا/.test(normalized)) return { value: addJalaliDays(today, 1), label: 'فردا' }
  if (/سه روز (?:دیگه|دیگر)/.test(normalized)) return { value: addJalaliDays(today, 3), label: 'سه روز دیگر' }
  if (/هفته بعد/.test(normalized)) return { value: addJalaliDays(today, 7), label: 'هفته بعد' }
  if (/ماه بعد/.test(normalized)) { const value = addJalaliMonths(today, 1); return { value, label: 'ماه بعد' } }
  const weekdayIndex: Record<string, number> = { شنبه: 0, یکشنبه: 1, دوشنبه: 2, 'سه‌شنبه': 3, 'سه شنبه': 3, چهارشنبه: 4, پنجشنبه: 5, جمعه: 6 }
  if (/اول ماه/.test(normalized)) return { value: { ...addJalaliMonths(today, 1), day: 1 }, label: 'اول ماه' }
  if (/آخر ماه/.test(normalized)) return { value: addJalaliDays({ ...addJalaliMonths(today, 1), day: 1 }, -1), label: 'آخر ماه' }
  const relativeDays = normalized.match(/(\d+) روز (?:دیگر|دیگه)/)
  if (relativeDays) return { value: addJalaliDays(today, Number(relativeDays[1])), label: relativeDays[0] }
  const weekday = Object.keys(weekdayIndex).sort((a, b) => b.length - a.length).find((name) => new RegExp(`(?:^|\\s)(?:هر\\s+)?${name}(?=\\s|$)`).test(normalized))
  if (weekday) {
    const distance = (weekdayIndex[weekday] - jalaliWeekday(today) + 7) % 7 || 7
    return { value: addJalaliDays(today, distance), label: weekday }
  }
  const date = normalized.match(/(\d{1,2})\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)(?:\s*(\d{4}))?/)
  if (!date) return null
  const month = jalaliMonthNames.indexOf(date[2]) + 1
  const year = date[3] ? Number(date[3]) : today.year
  const value = { year, month, day: Number(date[1]) }
  if (!isValidJalaaliDate(value.year, value.month, value.day)) return null
  return { value, label: jalaliShortLabel(value) }
}

export interface PersianDateEngine {
  toGregorian(jalali: { year: number; month: number; day: number }): { year: number; month: number; day: number }
  toJalali(gregorian: { year: number; month: number; day: number }): { year: number; month: number; day: number }
  isLeapJalaliYear(year: number): boolean
  parseNaturalDate(input: string, now?: Date): { system: CalendarSystem; year?: number; month?: number; day?: number; relative?: string } | null
}

export const jalaliRules: PersianDateEngine = {
  toGregorian: ({ year, month, day }) => {
    if (!isValidJalaaliDate(year, month, day)) throw new RangeError(`Invalid Jalali date: ${year}/${month}/${day}`)
    const result = toGregorian(year, month, day)
    return { year: result.gy, month: result.gm, day: result.gd }
  },
  toJalali: ({ year, month, day }) => {
    const result = toJalaali(year, month, day)
    return { year: result.jy, month: result.jm, day: result.jd }
  },
  isLeapJalaliYear: isLeapJalaaliYear,
  parseNaturalDate: (input) => {
    const normalized = latinDigits(input).replace(/[يى]/g, 'ی').replace(/[ك]/g, 'ک')
    const relative = normalized.match(/امروز|پس‌فردا|فردا|سه روز دیگر|هفته بعد|ماه بعد/)
    if (relative) return { system: 'JALALI', relative: relative[0] }
    const date = normalized.match(/(\d{1,2})\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)(?:\s*(\d{4}))?/)
    if (!date) return null
    const month = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].indexOf(date[2]) + 1
    const year = date[3] ? Number(date[3]) : undefined
    if (year && !isValidJalaaliDate(year, month, Number(date[1]))) return null
    return { system: 'JALALI', year, month, day: Number(date[1]) }
  }
}
