import { addJalaliDays, addJalaliMonths, jalaliWeekday, type JalaliDateValue } from './date.ts'
import { isLeapJalaaliYear } from 'jalaali-js'

export type RecurrenceRule =
  | { kind: 'DAILY'; interval: number }
  | { kind: 'WEEKLY'; interval: number; weekday?: number }
  | { kind: 'MONTHLY'; interval: number }
  | { kind: 'YEARLY'; interval: number }

export const parseRecurrence = (input: string): RecurrenceRule | null => {
  const value = input.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim()
  const names = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
  const weekday = value.match(/^هر\s+(یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه)$/)
  if (weekday) return { kind: 'WEEKLY', interval: 1, weekday: names.indexOf(weekday[1].replace('سه شنبه', 'سه‌شنبه')) }
  if (/هر روز/.test(value)) return { kind: 'DAILY', interval: 1 }
  if (/^هر هفته$/.test(value)) return { kind: 'WEEKLY', interval: 1 }
  if (/هر دو هفته/.test(value)) return { kind: 'WEEKLY', interval: 2 }
  if (/هر ماه/.test(value)) return { kind: 'MONTHLY', interval: 1 }
  if (/هر سال/.test(value)) return { kind: 'YEARLY', interval: 1 }
  const custom = value.match(/هر\s+(\d+)\s+(روز|هفته|ماه|سال)/)
  if (!custom) return null
  const interval = Number(custom[1])
  if (!Number.isSafeInteger(interval) || interval < 1 || interval > 1000) return null
  const kinds = { روز: 'DAILY', هفته: 'WEEKLY', ماه: 'MONTHLY', سال: 'YEARLY' } as const
  return { kind: kinds[custom[2] as keyof typeof kinds], interval }
}

export const nextOccurrence = (date: JalaliDateValue, rule: RecurrenceRule): JalaliDateValue => {
  if (!Number.isInteger(rule.interval) || rule.interval < 1) throw new RangeError('Invalid recurrence interval')
  if (rule.kind === 'DAILY') return addJalaliDays(date, rule.interval)
  if (rule.kind === 'WEEKLY') return addJalaliDays(date, rule.weekday === undefined ? rule.interval * 7 : ((rule.weekday - jalaliWeekday(date) + 7) % 7 || 7) + (rule.interval - 1) * 7)
  if (rule.kind === 'MONTHLY') return addJalaliMonths(date, rule.interval)
  const year = date.year + rule.interval
  return { year, month: date.month, day: Math.min(date.day, date.month === 12 && !isLeapJalaaliYear(year) ? 29 : date.day) }
}
