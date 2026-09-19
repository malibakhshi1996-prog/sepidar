import { jalaliKey, parseNaturalDateValue, todayJalali } from './date.ts'
import { parseRecurrence } from './recurrence.ts'
export interface ParsedTask { title: string; date: string; dateKey: string; time: string; recurrence: string; warnings: string[] }
const weekdays = 'یکشنبه|دوشنبه|سه‌شنبه|سه شنبه|چهارشنبه|پنجشنبه|جمعه|شنبه'
const months = 'فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند'
const words: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10, یازده: 11, دوازده: 12 }

/** Deterministic, offline NLP. Unknown/invalid tokens stay in the title. */
export function parseQuickAdd(input: string, now = new Date()): ParsedTask {
  let text = input.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const warnings: string[] = []
  let date = ''; let dateKey = ''; let time = ''; let recurrence = ''
  const repeat = text.match(new RegExp(`(?:^|\\s)(هر\\s+(?:(?:\\d+|دو)\\s+(?:روز|هفته|ماه|سال)|روز|هفته|ماه|سال|${weekdays}))(?=\\s|$)`))
  if (repeat && parseRecurrence(repeat[1])) { recurrence = repeat[1]; text = text.replace(repeat[1], ' ') }
  const datePattern = new RegExp(`(?:^|\\s)(پس‌فردا|پس فردا|امروز|فردا|هفته بعد|ماه بعد|اول ماه|آخر ماه|(?:\\d+|سه) روز (?:دیگه|دیگر)|\\d{1,2}\\s*(?:${months})(?:\\s+\\d{4})?|${weekdays})(?=\\s|$)`)
  const dateToken = text.match(datePattern)
  if (dateToken) {
    const parsed = parseNaturalDateValue(dateToken[1], now)
    if (parsed) { date = parsed.label; dateKey = jalaliKey(parsed.value); text = text.replace(dateToken[1], ' ') }
    else warnings.push('تاریخ معتبر نیست؛ آن را اصلاح کنید.')
  } else if (recurrence) {
    const scheduled = parseNaturalDateValue(recurrence, now)
    date = scheduled?.label || 'امروز'; dateKey = jalaliKey(scheduled?.value || todayJalali(now))
  }
  const number = `(?:\\d{1,2}|${Object.keys(words).sort((a, b) => b.length - a.length).join('|')})`
  const match = text.match(new RegExp(`(?:^|\\s)(ساعت\\s*(${number})(?:[:٫](\\d{2}))?\\s*(صبح|شب|عصر)?|(${number})\\s*(صبح|شب|عصر))(?=\\s|$)`))
  if (match) {
    const hourText = match[2] || match[5]
    let hour = words[hourText] ?? Number(hourText)
    const minute = Number(match[3] || 0); const period = match[4] || match[6]
    if (hour > 23 || minute > 59 || (period && (hour < 1 || hour > 12))) warnings.push('ساعت معتبر نیست؛ آن را اصلاح کنید.')
    else {
      if (period === 'صبح' && hour === 12) hour = 0
      if ((period === 'شب' || period === 'عصر') && hour < 12) hour += 12
      time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      if (!period && hour >= 1 && hour <= 12) warnings.push(`ساعت ${time} در نظر گرفته شد؛ برای عصر یا شب آن را مشخص کنید.`)
      if (!dateKey) { date = 'امروز'; dateKey = jalaliKey(todayJalali(now)) }
      text = text.replace(match[1], ' ')
    }
  }
  return { title: text.replace(/\s+/g, ' ').trim(), date, dateKey, time, recurrence, warnings }
}
