import type { JalaliDateValue } from './date.ts'
import { gregorianForJalali } from './date.ts'

export type EventCategory = 'OFFICIAL_HOLIDAY' | 'OFFICIAL_EVENT' | 'RELIGIOUS' | 'CULTURAL' | 'ANCIENT_IRAN' | 'GLOBAL' | 'PROFESSIONAL' | 'SOCIAL' | 'UNOFFICIAL' | 'USER_DEFINED' | 'HISTORICAL'
export interface CalendarEventDefinition { id: string; title: string; description?: string; category: EventCategory; calendarSystem: 'JALALI' | 'GREGORIAN' | 'HIJRI'; dateRule: string; year?: number; month?: number; day?: number; isHoliday: boolean; isOfficial: boolean; country?: string; region?: string; source?: string; priority: number; enabledByDefault: boolean; startYear?: number; endYear?: number; version: number }

export const eventCategoryLabels: Record<EventCategory, string> = {
  OFFICIAL_HOLIDAY: 'تعطیلات رسمی', OFFICIAL_EVENT: 'مناسبت‌های رسمی', RELIGIOUS: 'مذهبی', CULTURAL: 'فرهنگی', ANCIENT_IRAN: 'ایران باستان', GLOBAL: 'جهانی', PROFESSIONAL: 'حرفه‌ای', SOCIAL: 'اجتماعی', UNOFFICIAL: 'غیررسمی', USER_DEFINED: 'شخصی', HISTORICAL: 'تاریخی'
}
export const eventCategories = Object.keys(eventCategoryLabels) as EventCategory[]

const jalali = (id: string, title: string, month: number, day: number, category: EventCategory, isHoliday = false, priority = 60): CalendarEventDefinition => ({ id, title, category, calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month, day, isHoliday, isOfficial: category === 'OFFICIAL_HOLIDAY' || category === 'OFFICIAL_EVENT', country: 'IR', priority, enabledByDefault: true, version: 2 })
const hijri = (id: string, title: string, month: number, day: number, category: EventCategory, isHoliday = false, priority = 70): CalendarEventDefinition => ({ id, title, category, calendarSystem: 'HIJRI', dateRule: 'FIXED_HIJRI', month, day, isHoliday, isOfficial: isHoliday, country: 'IR', priority, enabledByDefault: true, version: 2 })
const gregorian = (id: string, title: string, month: number, day: number, category: EventCategory, priority = 30): CalendarEventDefinition => ({ id, title, category, calendarSystem: 'GREGORIAN', dateRule: 'FIXED_GREGORIAN', month, day, isHoliday: false, isOfficial: false, priority, enabledByDefault: true, version: 2 })

/** Offline catalogue: stable Solar Hijri dates plus moving Hijri events. */
export const offlineEventDefinitions: CalendarEventDefinition[] = [
  jalali('nowruz-1', 'نوروز؛ آغاز سال نو', 1, 1, 'OFFICIAL_HOLIDAY', true, 100), jalali('nowruz-2', 'تعطیلات نوروز', 1, 2, 'OFFICIAL_HOLIDAY', true, 100), jalali('nowruz-3', 'تعطیلات نوروز', 1, 3, 'OFFICIAL_HOLIDAY', true, 100), jalali('nowruz-4', 'تعطیلات نوروز', 1, 4, 'OFFICIAL_HOLIDAY', true, 100),
  jalali('republic-day', 'روز جمهوری اسلامی ایران', 1, 12, 'OFFICIAL_HOLIDAY', true, 95), jalali('nature-day', 'روز طبیعت', 1, 13, 'OFFICIAL_HOLIDAY', true, 95), jalali('teacher-day', 'روز معلم', 2, 12, 'OFFICIAL_EVENT', false, 70), jalali('khorramshahr', 'روز آزادسازی خرمشهر', 3, 3, 'OFFICIAL_EVENT', false, 75),
  jalali('khomeini-death', 'رحلت امام خمینی', 3, 14, 'OFFICIAL_HOLIDAY', true, 95), jalali('khordad-uprising', 'قیام پانزده خرداد', 3, 15, 'OFFICIAL_HOLIDAY', true, 95), jalali('judiciary-day', 'روز قوه قضائیه', 4, 7, 'OFFICIAL_EVENT'), jalali('constitutional-day', 'سالروز صدور فرمان مشروطیت', 5, 14, 'HISTORICAL'),
  jalali('journalist-day', 'روز خبرنگار', 5, 17, 'PROFESSIONAL', false, 55), jalali('iran-iraq-war', 'آغاز هفته دفاع مقدس', 6, 31, 'HISTORICAL'), jalali('student-day', 'روز دانش‌آموز', 8, 13, 'OFFICIAL_EVENT'), jalali('student-day-azar', 'روز دانشجو', 9, 16, 'OFFICIAL_EVENT'), jalali('yalda', 'شب یلدا', 9, 30, 'ANCIENT_IRAN', false, 70),
  jalali('revolution', 'پیروزی انقلاب اسلامی ایران', 11, 22, 'OFFICIAL_HOLIDAY', true, 100), jalali('oil-nationalization', 'روز ملی شدن صنعت نفت ایران', 12, 29, 'OFFICIAL_HOLIDAY', true, 95),
  hijri('mabath', 'مبعث پیامبر اسلام (ص)', 7, 27, 'RELIGIOUS', true, 95), hijri('imam-ali-birth', 'ولادت امام علی (ع) و روز پدر', 7, 13, 'RELIGIOUS', true, 90), hijri('imam-mahdi-birth', 'ولادت حضرت مهدی (عج)', 8, 15, 'RELIGIOUS', true, 90), hijri('ramadan-19', 'شب قدر؛ ضربت خوردن امام علی (ع)', 9, 19, 'RELIGIOUS', false, 85), hijri('ramadan-21', 'شهادت امام علی (ع)؛ شب قدر', 9, 21, 'RELIGIOUS', true, 95),
  hijri('eid-fitr-1', 'عید سعید فطر', 10, 1, 'RELIGIOUS', true, 100), hijri('eid-fitr-2', 'تعطیل عید سعید فطر', 10, 2, 'RELIGIOUS', true, 100), hijri('imam-sadegh', 'شهادت امام جعفر صادق (ع)', 10, 25, 'RELIGIOUS', true, 90), hijri('arafah', 'روز عرفه', 12, 9, 'RELIGIOUS'), hijri('eid-ghorban', 'عید سعید قربان', 12, 10, 'RELIGIOUS', true, 95), hijri('eid-ghadir', 'عید سعید غدیر خم', 12, 18, 'RELIGIOUS', true, 100),
  hijri('tasua', 'تاسوعای حسینی', 1, 9, 'RELIGIOUS', true, 100), hijri('ashura', 'عاشورای حسینی', 1, 10, 'RELIGIOUS', true, 100), hijri('arbaeen', 'اربعین حسینی', 2, 20, 'RELIGIOUS', true, 100), hijri('prophet-death', 'رحلت پیامبر اسلام (ص) و شهادت امام حسن (ع)', 2, 28, 'RELIGIOUS', true, 95), hijri('imam-reza-martyrdom', 'شهادت امام رضا (ع)', 2, 30, 'RELIGIOUS', true, 95), hijri('prophet-birth', 'میلاد پیامبر اسلام (ص) و امام صادق (ع)', 3, 17, 'RELIGIOUS', true, 95), hijri('fatima-martyrdom', 'شهادت حضرت فاطمه زهرا (س)', 6, 3, 'RELIGIOUS', true, 90),
  gregorian('new-year', 'آغاز سال میلادی', 1, 1, 'GLOBAL'), gregorian('womens-day', 'روز جهانی زن', 3, 8, 'GLOBAL'), gregorian('world-health-day', 'روز جهانی بهداشت', 4, 7, 'GLOBAL'), gregorian('workers-day', 'روز جهانی کارگر', 5, 1, 'PROFESSIONAL'), gregorian('environment-day', 'روز جهانی محیط زیست', 6, 5, 'GLOBAL'), gregorian('human-rights-day', 'روز جهانی حقوق بشر', 12, 10, 'GLOBAL')
]

const hijriForGregorianDate = (year: number, month: number, day: number) => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(year, month - 1, day, 12)))
  const part = (name: string) => Number(parts.find(item => item.type === name)?.value || 0)
  return { year: part('year'), month: part('month'), day: part('day') }
}

export const eventsForJalaliDate = (date: JalaliDateValue, enabledCategories: EventCategory[] = eventCategories) => {
  const greg = gregorianForJalali(date); const hij = hijriForGregorianDate(greg.year, greg.month, greg.day)
  return offlineEventDefinitions.filter((event) => {
    if (!enabledCategories.includes(event.category)) return false
    if (event.calendarSystem === 'JALALI') return event.month === date.month && event.day === date.day && (!event.year || event.year === date.year)
    if (event.calendarSystem === 'GREGORIAN') return event.month === greg.month && event.day === greg.day
    return event.month === hij.month && event.day === hij.day
  }).sort((a, b) => b.priority - a.priority)
}
