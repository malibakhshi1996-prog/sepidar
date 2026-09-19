# زیتر ۰.۷ — تحویل مرحلهٔ پایداری وظایف و بازیابی

تاریخ: ۲۰۲۶/۰۹/۱۸. این تحویل تکمیل کل محصول یا برابری کامل با TickTick نیست. **APK ساخته نشده است.**

## آنچه واقعاً تغییر کرد

- کارها اکنون از مدل دامنهٔ متصل به UI استفاده می‌کنند: `status`, `createdAt`, `updatedAt`, `version`, `syncState`, `deletedAt`, `userId`, `serverId`, `timezone`, `allDay`, `sortOrder`. سازگاری با رکوردهای قدیمی حفظ شده است.
- ساخت، ویرایش و تکمیل، نسخه را به‌درستی تغییر می‌دهند. تغییر کار محلی همچنان `PENDING_CREATE` است؛ کار تأییدشدهٔ سروری به `PENDING_UPDATE` می‌رود. این metadata به معنی وجود سرویس Sync نیست.
- حذف کار tombstone ایجاد می‌کند؛ سطل زباله همان رکورد را بازیابی می‌کند. حذف دائمی فعال نیست. رکورد حذف‌شده در تقویم، آمار، جست‌وجو، ماتریس یا برنامه‌ریزی یادآوری ظاهر نمی‌شود.
- Inbox، Today شامل عقب‌افتاده‌ها، Upcoming، All و Completed فیلتر واقعی دارند. کار بدون تاریخ دیگر وقت امروز را اشغال نمی‌کند.
- ویرایشگر در dialog بومی HTML با مدیریت فوکوس مرورگر باز می‌شود: انتخاب روز جلالی، تاریخ دستی، ساعت، مدت، عنوان، توضیح، یادداشت، فهرست، برچسب، اولویت، تکرار و یادآوری. نام فهرست سفارشی از طریق همین ویرایشگر قابل ثبت است؛ هنوز Entity مستقل فهرست نیست.
- نصب تازه با دادهٔ خالی شروع می‌شود؛ هیچ کار یا عادت نمایشی به دادهٔ کاربر تزریق نمی‌شود. داده‌های قبلی حفظ می‌شوند.
- JSON شامل کارها و tombstoneها، عادت‌ها و تاریخچه و جلسات تمرکز است. Restore پس از اعتبارسنجی و پیش‌نمایش، فقط idهای جدید را اضافه می‌کند. رکوردهای فعلی، tombstoneها و پوستهٔ فعلی اولویت دارند. import تکراری رکورد تکراری نمی‌سازد. هویت/نسخهٔ سروری واردشده قابل اعتماد تلقی نمی‌شود.
- خروجی CSV کارها دارای UTF-8 BOM، escaping و خنثی‌سازی formula است. پشتیبان JSON **رمزگذاری نشده** و این نکته در UI نمایش داده می‌شود.
- فایل در مرورگر دانلود می‌شود؛ adapter اندروید از Storage Access Framework برای انتخاب محل ذخیره استفاده می‌کند، بدون مجوز گستردهٔ فایل. سورس Android هنوز compile/device-test نشده است.
- NLP از UI جدا و روی کد واقعی تست شده؛ روزهای هفته، تاریخ نسبی/صریح، اعداد فارسی/عربی، برخی ساعت‌های نوشتاری و تکرارهای پایه را تشخیص می‌دهد. ساعت مبهم به کاربر اعلام می‌شود؛ «۸» بی‌صدا به ۲۰ تبدیل نمی‌شود.
- محاسبهٔ امروز و تبدیل ساعت یادآوری با `Asia/Tehran` مستقل از timezone سیستم انجام می‌شود. تغییر ماه از حساب ماه جلالی استفاده می‌کند، نه افزودن ۳۱ روز.
- جست‌وجوی فارسی واقعی به عنوان/یادداشت/توضیح/برچسب/فهرست متصل شد. checkboxهای جست‌وجو و فهرست‌ها دیگر no-op نیستند.
- پومودورو/کرنومتر بر اساس زمان سپری‌شده محاسبه می‌شوند، نه تعداد tick؛ مدت جلسات متوقف‌شده دوباره‌شماری نمی‌شود. بازیابی جلسهٔ فعال پس از بسته‌شدن process هنوز پیاده نشده است.

## معماری و دیتابیس فعلی

معماری موجود React/TypeScript/Vite + Capacitor حفظ شد؛ بازنویسی Flutter، تعویض دیتابیس یا تغییر backend انجام نشد. توصیهٔ قدیمی Flutter در گزارش Phase 0 تصمیم اجراشده نیست و بدون تصمیم جداگانه اجرا نمی‌شود.

| لایه | فایل‌های اصلی |
|---|---|
| Presentation | `src/main.tsx`, `features/tasks/TaskEditor.tsx`, `features/data/DataScreen.tsx` |
| Domain | `core/task.ts`, `date.ts`, `recurrence.ts`, `nlp.ts`, `search.ts`, `focus.ts` |
| Data | `core/storage.ts`, `core/backup.ts` |
| Native | Capacitor notifications و `DocumentExportPlugin.java` |

IndexedDB: نام `zitar-offline`، نسخهٔ دیتابیس **۱**، store برابر `app_state`، کلید `current`. ساختار ذخیره:

```text
schemaVersion: 2
revision: شمارندهٔ محلی افزایشی
updatedAt: ISO instant
tasks: Task[]
habits: Habit[]
focusSessions: FocusSession[]
activeTheme: string
```

مهاجرت schema ۱→۲ افزایشی است؛ هیچ store یا داده‌ای حذف نشده. revision جلوی از دست رفتن نوشتن fallback در یک میلی‌ثانیهٔ مشترک با IDB را می‌گیرد. نوشتن‌ها صف‌بندی و snapshot قبل از ورود به صف clone می‌شود. fallback اتمی در یک کلید `zitar.snapshot` است؛ کلیدهای قدیمی حذف نمی‌شوند. دادهٔ نسخهٔ آینده یا خراب خطا می‌دهد و بازنویسی متوقف می‌شود. در نبود دسترسی خواندن IDB، UI با دادهٔ قدیمی ادامه نمی‌دهد. پرشدن هر دو storage موفقیت جعلی برنمی‌گرداند.

این ساختار **SQLite رابطه‌ای نیست**. هنوز برای نوشتن هم‌زمان چند tab، outbox تراکنشی و query حجیم به کار نیاز دارد. `TaskRecord` در `model.ts` قرارداد هدف کامل‌تر است؛ فیلدهای UI-compatible هنوز به adapter نهایی listId/dateهای canonical تبدیل نشده‌اند. این بدهی فنی صریح است، نه همگام‌سازی کامل.

## پذیرش و Feature Parity

هیچ screen به‌صرف وجود UI، VERIFIED نیست. «تست دامنه موفق» با «تأیید روی گوشی» متفاوت است.

| Feature | TickTick reference | Our app | Status | UI parity | Behavior parity | Tests | Notes |
|---|---|---|---|---|---|---|---|
| Tasks / Inbox / Today / Upcoming | capture + smart lists | فیلتر، CRUD، completion و overdue | PARTIAL | مقایسه نشده | هسته اجراشده | task unit | reorder/swipe/multi-select بعدی |
| Task detail | سریع و کم‌عمق | dialog + ویرایش تاریخ/ساعت/متن/تکرار | PARTIAL | مقایسه نشده | واقعی | build/domain | نیازمند UI test |
| Trash | حذف قابل‌بازیابی | tombstone + restore | PARTIAL | مستقل | domain تأیید | task unit | device verification باقی |
| Quick Add / NLP | date + recurrence parsing | parser آفلاین + پیش‌نمایش ابهام | PARTIAL | مستقل | grammar پایه | domain tests | NLP کامل نیست |
| Lists / Projects / Folders | سلسله‌مراتب و share | نام فهرست در رکورد کار | PARTIAL | مقایسه نشده | گروه‌بندی پایه | build | Entity مستقل، nesting و share ندارد |
| Tags / smart filters | چندبرچسب و AND/OR | یک tag متنی | PARTIAL | پایه | محدود | search unit | موتور فیلتر NOT_STARTED |
| Subtasks / checklist | مستقل و چندسطحی | parentTaskId در مدل؛ UI ندارد | NOT_STARTED | ندارد | ندارد | ندارد | مدل هدف موجود |
| Search | fuzzy global | normalization + substring در فیلدهای کار | PARTIAL | پایه | واقعی، غیر fuzzy | domain unit | attachment/comment ندارد |
| Recurrence | calendar-aware complex | daily/weekly/monthly/yearly/interval | PARTIAL | پایه | next occurrence | leap/interval tests | ماهانه پس از clamp نیازمند anchor؛ nth weekday بعدی |
| Reminder | reliable native | local-notifications + Tehran time | PARTIAL | مجوز پایه | source موجود | date unit only | reboot/Doze/exact alarm/race هنوز بررسی نشده |
| Calendar | day/week/month/agenda/year, drag | week/month/agenda | PARTIAL | مقایسه نشده | date selection + task display | date tests | time grid/drag/resize/views پیشرفته ندارد |
| Hijri / events | selectable catalogs | seed محدود جلالی | PARTIAL | پایه | محدود | ندارد | سرور/قمری/منبع رسمی به‌روز پیاده نشده |
| Calendar adapters | external sources | طراحی مستند | NOT_STARTED | ندارد | ندارد | ندارد | Google/device/CalDAV بعدی |
| Focus | pomo/stopwatch/break/task | clock-based timer + saved sessions | PARTIAL | مقایسه نشده | پایه | focus unit | background process/break/task binding بعدی |
| Habits | goals/frequency/streak/history | ثبت روزانه و تاریخچه | PARTIAL | مقایسه نشده | frequency labels کامل اعمال نمی‌شوند | backup only | skip/fail/goals باقی |
| Matrix | quadrants + drag/filter | اولویت‌بندی ساده | PARTIAL | مقایسه نشده | بدون drag | build | urgency مستقل ندارد |
| Statistics | overview/day/week/month | دادهٔ پایه و نمودار ۷روز | PARTIAL | مقایسه نشده | تب‌های پیشرفته ناقص | build | نرخ/نمودار نیازمند بازبینی |
| Settings / theme | persistent display system | برخی رنگ‌ها persistent | PARTIAL | مقایسه نشده | display controls کامل نیستند | storage tests | READY قدیمی تصحیح شد |
| Backup / CSV | export + restore | JSON additive restore, CSV safe cells | PARTIAL | مستقل | دامنه تأیید | backup tests | Android document picker تأیید نشده |
| Offline DB | local source of truth | IDB schema2 + recovery | PARTIAL | failure UI | دامنه تأیید | migration/quota/order | multi-tab و crash kill تست نشده |
| Sync / auth / backend | multi-device | metadata و قرارداد هدف | NOT_STARTED | ندارد | سرویس وجود ندارد | ندارد | backend strategy تغییر نکرد |
| Sharing / attachments / comments | collaborative tasks | فقط قرارداد مدل | NOT_STARTED | ندارد | ندارد | ندارد | upload/auth لازم است |
| Widgets / native app-icon variants | launcher integration | launcher مستقل پایه | NOT_STARTED | ندارد | variant/widget ندارد | ندارد | settings preview به معنی اجرا نیست |
| Countdown / Kanban / Timeline | advanced views | فقط backlog | NOT_STARTED | ندارد | ندارد | ندارد | timeline از نسخه اول قابل تعویق |
| Voice / AI | optional capture/planning | پیاده نشده | NOT_STARTED | ندارد | ندارد | ندارد | core به AI وابسته نیست |
| Accessibility / visual golden | readable/RTL/gesture | RTL، focus dialog، labels پایه | PARTIAL | diff انجام نشده | نیازمند ممیزی | build | TalkBack/contrast/dynamic font بعدی |
| APK | installable verified build | Android source target | NOT_STARTED | device QA ندارد | APK موجود نیست | build blocked | release signed نشده |

## شواهد تست و QA

- `npm test`: **۳۰ تست موفق** شامل migration، ترتیب نوشتن، شکست quota، fallback recovery، Task lifecycle، backup/import، Persian NLP/search، leap/year/month boundary، Tehran instant و Focus.
- fixture دامنه: ۱۰٬۰۰۰ کار، ۱٬۰۰۰ completed، ۵۰۰ recurring، ۱۰۰ habit، round-trip حدود ۱۱۸ms در یک اجرا و JSON حدود ۵۰۲۵KiB. این **آزمون FPS، startup یا rendering موبایل نیست**.
- `npm run build`: موفق؛ TypeScript و build production.
- `npx cap sync android`: موفق؛ به معنی compile شدن Android نیست.
- `npm run mobile:doctor`: JDK 21/javac، SDK، platform36 و Build Tools موجود نیستند.
- `npm run mobile:build:debug`: تا build وب و sync موفق؛ دانلود Gradle 8.14.3 با `java.net.SocketException: Network is unreachable` متوقف شد.
- مهارت browser برای آزمون UI به‌کار رفت؛ دسترسی مرورگر cloud به localhost با `ERR_BLOCKED_BY_CLIENT` مسدود شد. مسیر دیگری برای دورزدن محدودیت امتحان نشد. **اسکرین‌شات، visual diff و E2E در این تحویل موجود نیستند.**
- هیچ آزمون real-device، notification reboot/Doze، نصب/ارتقای APK یا compile افزونهٔ Java تأیید نشده است.

## امنیت، مجوز و تغییرات حفظ‌شده

dependency جدید یا license جدید اضافه نشد. کد/دارایی اختصاصی TickTick استفاده نشده است. محافظت CSV و اعتبارسنجی فایل ورودی اضافه شد؛ tokens، backend credentials و کلید امضا ایجاد/منتقل نشدند. داده‌ها هنوز E2E encrypted نیستند. فونت remote، seed مناسبت‌ها، بخش‌های monolithic UI و metadata انتقالی از ریسک‌های باقی‌مانده‌اند.

قبل→بعد: حذف فیزیکی→tombstone؛ ذخیرهٔ debounce با خطای پنهان→صف نوشتن با error UI؛ کارت معرفی قابلیت‌ها→فیلتر واقعی کارها؛ Task Detail toggleهای ثابت→ویرایشگر. حذف قابلیت واقعی انجام نشده است؛ کد seed بلااستفاده و ویرایشگر قدیمی جایگزین شدند. تاریخچه و دادهٔ قبلی حذف نشده‌اند.

## مرحلهٔ لازم برای خروجی نهایی

۱. محیط دارای JDK21، Android SDK36 و Build Tools و دسترسی Gradle/Maven یا cache تأمین شود. پذیرش licenseهای SDK و کلید release متعلق به صاحب پروژه است.
۲. `npm ci` → `npm test` → `npm run mobile:doctor` → `npm run mobile:build:debug` اجرا شود.
۳. APK حاصل روی دستگاه نصب شود؛ سناریوهای افزودن/بستن/بازکردن، delete/restore، file picker، مجوز اعلان، Doze/reboot، RTL و مهاجرت اجرا شوند.
۴. باقی backlog پذیرش بالا feature-by-feature تکمیل و goldenها در viewport تصاویر مرجع تولید شوند.
۵. تنها پس از رفع موارد، signed release ساخته و checksum/artifact تحویل شود. هیچ فایل وب یا آرشیو سورس جای APK معرفی نمی‌شود.
