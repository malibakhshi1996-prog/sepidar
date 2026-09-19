import type { JalaliDateValue } from './date'

export type EventCategory = 'OFFICIAL_HOLIDAY' | 'OFFICIAL_EVENT' | 'RELIGIOUS' | 'CULTURAL' | 'ANCIENT_IRAN' | 'GLOBAL' | 'PROFESSIONAL' | 'SOCIAL' | 'UNOFFICIAL' | 'USER_DEFINED'
export interface CalendarEventDefinition { id: string; title: string; description?: string; category: EventCategory; calendarSystem: 'JALALI' | 'GREGORIAN' | 'HIJRI'; dateRule: string; year?: number; month?: number; day?: number; isHoliday: boolean; isOfficial: boolean; country?: string; region?: string; source?: string; priority: number; enabledByDefault: boolean; startYear?: number; endYear?: number; version: number }

export const eventCategoryLabels: Record<EventCategory, string> = {
  OFFICIAL_HOLIDAY: 'تعطیلات رسمی', OFFICIAL_EVENT: 'مناسبت‌های رسمی', RELIGIOUS: 'مذهبی', CULTURAL: 'فرهنگی', ANCIENT_IRAN: 'ایران باستان', GLOBAL: 'جهانی', PROFESSIONAL: 'حرفه‌ای', SOCIAL: 'اجتماعی', UNOFFICIAL: 'غیررسمی', USER_DEFINED: 'شخصی'
}
export const eventCategories = Object.keys(eventCategoryLabels) as EventCategory[]

// This is a small offline seed. Production must replace/merge it with the versioned server catalog.
export const offlineEventDefinitions: CalendarEventDefinition[] = [
  { id: 'nowruz-1', title: 'نوروز', description: 'آغاز سال نو خورشیدی', category: 'OFFICIAL_HOLIDAY', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 1, day: 1, isHoliday: true, isOfficial: true, country: 'IR', priority: 100, enabledByDefault: true, version: 1 },
  { id: 'nowruz-2', title: 'تعطیلات نوروز', category: 'OFFICIAL_HOLIDAY', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 1, day: 2, isHoliday: true, isOfficial: true, country: 'IR', priority: 100, enabledByDefault: true, version: 1 },
  { id: 'republic-day', title: 'روز جمهوری اسلامی ایران', category: 'OFFICIAL_HOLIDAY', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 1, day: 12, isHoliday: true, isOfficial: true, country: 'IR', priority: 90, enabledByDefault: true, version: 1 },
  { id: 'nature-day', title: 'روز طبیعت', category: 'OFFICIAL_HOLIDAY', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 1, day: 13, isHoliday: true, isOfficial: true, country: 'IR', priority: 90, enabledByDefault: true, version: 1 },
  { id: 'teacher-day', title: 'روز معلم', category: 'OFFICIAL_EVENT', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 2, day: 12, isHoliday: false, isOfficial: true, country: 'IR', priority: 60, enabledByDefault: true, version: 1 },
  { id: 'book-day', title: 'روز کتاب و کتاب‌خوانی', category: 'CULTURAL', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 8, day: 24, isHoliday: false, isOfficial: true, country: 'IR', priority: 70, enabledByDefault: true, version: 1 },
  { id: 'yalda', title: 'شب یلدا', category: 'ANCIENT_IRAN', calendarSystem: 'JALALI', dateRule: 'FIXED_JALALI', month: 9, day: 30, isHoliday: false, isOfficial: false, country: 'IR', priority: 50, enabledByDefault: true, version: 1 }
]

export const eventsForJalaliDate = (date: JalaliDateValue, enabledCategories: EventCategory[] = eventCategories) => offlineEventDefinitions.filter((event) => event.calendarSystem === 'JALALI' && event.month === date.month && event.day === date.day && enabledCategories.includes(event.category))
