# سپیدار — گزارش Phase 0 تا Phase 5

> گزارش تاریخی است. وضعیت فعلی و اصلاح ادعاهای آمادگی در [گزارش ۰.۷](milestone-0.7.md) آمده است. تنظیمات نمایشی، همگام‌سازی، سرور مناسبت‌ها و APK هنوز کامل یا تأییدشده نیستند؛ عنوان READY در جدول قدیمی معیار پذیرش فعلی نیست.

تاریخ: ۱۴۰۵/۰۶/۲۷ — نسخه: ۰.۶.۰ — معیار تجربه: TickTick-level / Persian-first

## 1. خلاصه اجرایی

Repository قبلی وجود نداشت. یک prototype اجرایی mobile-first ساخته شد که مسیرهای اصلی مرجع را دارد: کارها، تقویم، ماتریس، تمرکز، بیشتر، آمار و تنظیمات. داده‌های کار در Repository آفلاین مبتنی بر IndexedDB ذخیره می‌شوند؛ داده‌های localStorage نسخه‌های قبل نیز بدون حذف مهاجرت می‌شوند.

هدف نهایی «کلون سطحی» نیست؛ معیار نهایی، نزدیکی عملی و بصری به TickTick با کد مستقل، برند مستقل و تفاوت‌های فارسی/ایران‌محور است.

## 2. تصمیم معماری

معماری نهایی پیشنهادی برای محصول: Flutter برای Android/iOS/Web/desktop، Clean Architecture، feature modules، SQLite/Drift یا Isar در کلاینت، PostgreSQL در backend، REST versioned به‌همراه sync cursor و local notification engine.

Phase 0 با React + TypeScript + Vite اجرا شده چون Flutter SDK در محیط موجود نبود. این انتخاب فقط برای prototype و اعتبارسنجی UX است؛ مدل دامنه در `src/core` از UI مستقل نگه داشته شده است.

لایه‌ها: Presentation → Application → Domain → Data → Infrastructure.

## 3. Technology Stack

| لایه | انتخاب Phase 0 | انتخاب محصول |
|---|---|---|
| UI | React 19 + TypeScript | Flutter/Dart |
| Build | Vite | Flutter build + CI |
| Local | IndexedDB repository + legacy migration | SQLite/Drift یا Isar |
| API | قرارداد مستندشده | REST `/api/v1` |
| Sync | مدل وضعیت در دامنه | cursor + optimistic local writes |
| Icons | Phosphor Icons | icon system مستقل |
| Typography | Vazirmatn | Vazirmatn یا فونت فارسی دارای مجوز |

## 4. ساختار repository

```text
src/
  core/          model, date contract, Persian search normalization
  main.tsx       Phase 0 screens and interaction shell
  styles.css     design tokens and responsive visual system
docs/            architecture and acceptance documents
tests/           domain smoke tests
```

## 5. موجودی کامل قابلیت‌ها

### اجراشده در Phase 0 و 1/2/3

کارها، Inbox، Quick Add، تکمیل کار، ذخیره محلی، Today-like task list، تقویم جلالی با نماهای هفته/ماه/دستورکار، ماتریس چهارخانه، Pomodoro/stopwatch shell، آمار، settings tabs، theme selection، RTL، فونت فارسی، bottom navigation، FAB، empty states، local persistence و ساخت occurrence بعدی برای کارهای تکرارشونده.

### قرارداد معماری‌شده ولی هنوز کامل اجرا نشده

reminder engine بومی، calendar subscriptions، attachments، collaboration، auth، backend، sync، widgets، export/backup، tests گسترده، notification بومی و دیتابیس SQLite/Drift یا Isar.

## 6. TickTick Parity Matrix

| Feature | TickTick reference | Our app | Status | UI parity | Behavior parity | Tests | Notes |
|---|---|---|---|---|---|---|---|
| Task list | dense list + completion | task list + completion | PARTIAL | نزدیک | پایه | smoke | subtasks بعدی |
| Quick Add | fast capture | sheet + Jalali date/time/recurrence | PARTIAL | نزدیک | واقعی روی local data | smoke | NLP confidence و تایید پیشرفته بعدی |
| Calendar | multi-view planner | week/month/agenda + Jalali events | PARTIAL | نزدیک | واقعی روی local data | smoke | server catalog و drag/resize بعدی |
| Focus | Pomo/Stopwatch | timer واقعی + ذخیره Session | PARTIAL | نزدیک | واقعی روی local data | smoke | task binding و native background بعدی |
| Matrix | 4 quadrants | 4 quadrants + priority filter | PARTIAL | نزدیک | پایه | pending | drag بعدی |
| Statistics | cards + curves | cards + series از task/focus/habit | PARTIAL | نزدیک | واقعی روی local data | smoke | day/week/month drill-down بعدی |
| Display/Theme | tabs/cards/themes | functional tabs and themes | READY | نزدیک | پایه | manual | visual QA required |
| Offline | instant local UI | IndexedDB + localStorage fallback + native reminder | PARTIAL | n/a | واقعی | migration | SQLite native و outbox sync بعدی |

هیچ مورد PARTIAL به‌عنوان production-ready اعلام نمی‌شود.

## 7. Screen inventory

Tasks/Today، Calendar/Week، Eisenhower Matrix، Focus/Pomo، More، Statistics/Overview، Settings/Display، Settings/App Icons، Settings/Theme، Quick Add sheet، Empty states.

## 8. Database entities

Task، TaskTag، TaskReminder، TaskAttachment، TaskComment، TaskChecklistItem، TaskAssignee، TaskRelation، List، Folder، Project، Tag، Habit، HabitCompletion، FocusSession، CalendarEvent، CalendarEventDefinition، CalendarSource، User، DeviceSession، SyncOperation، AuditLog، ThemeDefinition، BackupExport.

مدل پایه Task و CalendarEventDefinition در `src/core/model.ts` قرار دارد.

## 9. API architecture

```text
POST /api/v1/auth/session
GET  /api/v1/sync/pull?cursor=...
POST /api/v1/sync/push
GET/POST/PATCH/DELETE /api/v1/tasks
GET/POST/PATCH/DELETE /api/v1/lists
GET/POST/PATCH/DELETE /api/v1/habits
GET /api/v1/calendar-definitions?version=...
GET /api/v1/statistics/summary
POST /api/v1/exports
```

سرور منبع notification timing نیست؛ reminderهای نزدیک باید روی دستگاه schedule شوند.

## 10. Sync architecture

هر entity دارای `id/serverId/updatedAt/version/syncState/deletedAt` است. نوشتن ابتدا local است، سپس outbox operation ثبت می‌شود. pull با cursor، push با idempotency key، retry با exponential backoff و conflict با version check انجام می‌شود. Conflict برای دادهٔ کار نباید silently overwrite شود.

## 11. Persian calendar architecture

تقویم جلالی در Domain/Core قرار می‌گیرد و UI صرفاً renderer است. قواعد اسفند کبیسه، تبدیل جلالی/میلادی، هفته از شنبه، جمعه تعطیل پیش‌فرض و ساعت/منطقه زمانی در test matrix اجباری هستند. تقویم قمری برای مناسبت‌ها باید منبع/روش محاسبهٔ versioned داشته باشد.

## 12. Holiday/Event architecture

`CalendarEventDefinition` از اپ جداست و از server versioned update می‌شود. دسته‌های رسمی، مذهبی، فرهنگی، باستانی، جهانی، حرفه‌ای، اجتماعی، غیررسمی و user-defined مستقل هستند. اپ بدون update برای مناسبت جدید قابل‌به‌روزرسانی می‌ماند.

## 13. Persian NLP architecture

pipeline: normalize text → tokenize → date lexicon → time lexicon → recurrence grammar → confidence → user confirmation → Task draft. NLP نباید مستقیماً Task نهایی را بدون امکان اصلاح ذخیره کند. `src/core/date.ts` قرارداد اولیه را نگه می‌دارد.

## 14. Design System

توکن‌های استخراج‌شده از اسکرین‌شات‌های ۷۹۸×۱۵۳۶:

| Token | Baseline |
|---|---|
| Background | `#000000` |
| Surface | `#1C1C1E` |
| Accent | `#4773FA` |
| Primary text | `#F5F5F7` |
| Secondary text | `#88888F` |
| Large radius | 25–26px |
| Small radius | 12–17px |
| Bottom nav | حدود ۷۸px |
| FAB | حدود ۷۴px |
| Main content padding | ۱۶–۳۴px responsive |
| Typography | bold, dense, high-contrast |

Component primitives: AppScaffold، TopBar، BottomNavigation، FAB، Card، TaskRow، Checkbox، SectionHeader، TabBar، BottomSheet، Toggle، Chip، EmptyState، ChartCard.

## 15. Milestone plan

Phase 0: skeleton + design system + contracts + screens. پایان‌یافته در حد prototype.

Phase 1: real Task domain، SQLite، Inbox، Today، Lists، Task Detail، subtasks.

Phase 2: reminders، recurrence، tags، filters، fuzzy search، Persian NLP.

Phase 3: calendar views، Jalali engine، event definitions، holidays، subscriptions.

Phase 4: Focus persistence، habits و statistics. widgets بعد از native client.

Phase 5: local reminder loop و offline event definitions. server event catalog، native alarms و external calendar adapters بعدی.

Phase 5: backend، accounts، sync، sharing، attachments، audit.

Phase 6: native packaging، performance، accessibility، beta hardening.

## 16. Technical risks

بزرگ‌ترین ریسک‌ها: دقت recurrence جلالی، محدودیت‌های Android alarm، conflict sync، timezone/DST، حجم تقویم مناسبت‌ها، migration بدون از دست رفتن داده، parity واقعی gestureها و تفاوت اندازه/فونت در Androidهای مختلف.

## 17. Licensing risks

کد TickTick استفاده نمی‌شود. هر OSS باید قبل از ورود بررسی شود. Vicu/TickTick-like UI قابل استفاده به‌عنوان مرجع نیستند مگر license و dependency tree بررسی شود. GPL/AGPL نباید ناخواسته کد client/backend اختصاصی را مشتق کند؛ برای محصول مستقل، MIT/Apache/BSD ترجیح دارد.

## 18. Testing strategy

Unit: search/date/recurrence/NLP. Database: migrations, indexes, soft delete. Sync: retry, duplicate, conflict. UI: RTL, empty/loading/error, quick add, completion. Golden: same viewport/state as each reference. Performance: ۱۰هزار کار، ۵۰۰ recurring، ۱۰۰ habit. Security: auth/session/upload/rate-limit/authorization.

## 19. Definition of Done

یک قابلیت فقط وقتی READY است که رفتار واقعی، persistence، offline path، error state، accessibility، migration impact، test و visual comparison داشته باشد. وجود یک screen به‌تنهایی کافی نیست.

## 20. وضعیت شروع Phase 0

اسکلت اجرایی و صفحات اصلی ساخته شده‌اند. ادامه باید روی parity رفتاری Task Detail، reminder، event definitions و local database واقعی متمرکز شود؛ نه افزایش تعداد کارت‌های نمایشی.

## 21. تغییرات نسخه ۰.۲.۰

در ادامهٔ کار، Task Detail، ویرایش/حذف، جست‌وجوی سراسری، Quick Add فارسی با تشخیص زمان و تکرار، عادت‌ها، فهرست‌ها و پروژه‌ها، agenda تقویم و موتور واقعی تبدیل جلالی اضافه شد. این قابلیت‌ها هنوز جایگزین کامل backend، notification native و sync چنددستگاهی نیستند؛ اما دیگر صرفاً کارت نمایشی نیستند و مسیرهای اصلی روی دادهٔ محلی کار می‌کنند.

## 22. تغییرات نسخه ۰.۳.۰

Calendar اکنون از date key جلالی پایدار استفاده می‌کند و نماهای هفته، ماه و دستورکار دارد. روزهای هفته از شنبه مرتب می‌شوند و جمعه به‌عنوان تعطیل بصری مشخص است. Quick Add تاریخ‌های نسبی، روزهای هفته و تاریخ جلالی را به همین مدل متصل می‌کند. وقتی کار تکرارشونده تکمیل می‌شود، occurrence بعدی ساخته و در تاریخ جلالی بعدی ذخیره می‌شود. این مرحله هنوز event database سروری، drag/resize تقویم، reminder بومی و recurring ruleهای پیچیده مثل nth weekday را کامل نکرده است.

## 23. تغییرات نسخه ۰.۴.۰

Stopwatch دیگر شمارش معکوس ندارد و پایان یا توقف جلسهٔ تمرکز را به‌صورت local ذخیره می‌کند. Pomodoro در پایان خودکار Session کامل‌شده می‌سازد. عادت‌ها اکنون تاریخچهٔ روزانه، streak فعلی، بهترین streak و وضعیت هفت روز اخیر دارند و کاربر می‌تواند عادت جدید بسازد. کارت‌های Statistics از دادهٔ واقعی Task، Focus و Habit محاسبه می‌شوند. اتصال Session به Task، اجرای Focus در پس‌زمینهٔ Native و نمودارهای drill-down روز/هفته/ماه هنوز به کلاینت موبایل و زیرساخت Native نیاز دارند.

## 24. تغییرات نسخه ۰.۵.۰

Task دارای reminder flag شد و برای Taskهای دارای تاریخ جلالی و ساعت، حلقهٔ بررسی محلی اجرا می‌شود. در صورت اجازهٔ مرورگر، Web Notification ارسال می‌شود و در غیر این صورت هشدار داخل برنامه نمایش داده می‌شود. Calendar اکنون Event Definitionهای versioned آفلاین، دسته‌بندی و فیلتر قابل انتخاب دارد. این داده‌ها seed اولیه هستند و هنوز جایگزین Holiday/Event Service سروری، اعلان Android/iOS در حالت بسته، timezone policy کامل و تقویم‌های خارجی نیستند.

## 25. تغییرات نسخه ۰.۶.۰

هدف Android با Capacitor و شناسه مستقل `ir.sepidar.productivity` ایجاد شد. زمان‌بندی reminder در محیط Native از Local Notifications استفاده می‌کند و مجوزها، channel و آیکون اعلان مستقل دارد. Persistence مستقیم UI به Repository مبتنی بر IndexedDB منتقل شد؛ snapshot دارای schema version است و داده‌های قبلی localStorage را در اولین اجرا مهاجرت می‌دهد. localStorage صرفاً fallback/mirror سازگاری است. build وب، sync Android و هفت تست دامنه/مهاجرت موفق‌اند؛ تولید فایل APK همچنان نیازمند Android SDK، Build Tools و Gradle قابل دسترس است.
