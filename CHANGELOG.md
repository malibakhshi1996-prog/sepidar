# Changelog

## 0.7.0 — Task lifecycle, safe recovery and export

- Added a UI-connected task domain with status, version, local sync metadata, tombstones and restore.
- Added real Inbox/Today/Upcoming/All/Completed views; undated tasks no longer appear as today's appointments.
- Added accessible native-dialog task editing, inline Jalali calendar, editable time/duration/list/tag/recurrence and reminders without clearing task time.
- Removed default demo records from new installations. Existing records remain untouched.
- Added validated JSON backup, preview and additive/idempotent import; CSV export neutralizes formulas.
- Added Android document export through the system document picker (source only, Android verification blocked).
- Upgraded snapshot schema to 2 without changing the IndexedDB store; serialized writes, logical revisions, atomic fallback and explicit storage errors replace the previous silent-failure path.
- Extracted and tested Persian NLP, corrected weekday substring matching, calendar-month navigation and Tehran timezone handling.
- Connected real Persian normalization to search and made completion controls work in lists and search.
- Prevented duplicate recurrence children after uncomplete/recomplete; corrected focus elapsed-time accounting.
- Added Android prerequisite checker. Web build and domain tests verified; APK build and visual/device QA blocked, not declared ready.


## 0.6.0 — Android target and durable offline repository

- Added a Capacitor Android target with the independent `ir.sepidar.productivity` application ID.
- Added native Android notification-channel setup and local task reminder scheduling.
- Added an independent launcher/notification icon and required Android permissions.
- Replaced direct UI persistence with an IndexedDB repository and a versioned app snapshot.
- Added automatic one-time migration from the existing localStorage task, habit, focus and theme data.
- Kept localStorage as a compatibility mirror/fallback without allowing it to overwrite newer IndexedDB data.
- Added persistence migration tests; the suite now contains seven passing tests.

## 0.5.0 — Local reminders and event definitions

- Added local reminder checking for dated tasks with a time and reminder flag.
- Added browser notification permission flow with an in-app fallback toast.
- Added versioned offline event definitions and category filters in Calendar.
- Added Jalali event cards for selected dates without claiming a complete official catalog.
- Extended domain contracts for reminders, focus sessions, habits and habit completions.

## 0.4.0 — Focus, habits and real statistics

- Stopwatch now counts upward correctly; Pomodoro counts downward and auto-saves completed sessions.
- Focus sessions persist locally with start/end time, duration, type and interruption state.
- Habits now persist completion dates, current streak and best streak.
- Added a real habit creation sheet and seven-day completion dots.
- Statistics now reads completion, focus minutes and habit rate from stored data.

## 0.3.0 — Persian calendar behavior

- Calendar now has week, month and agenda views with real Jalali date keys.
- Week ordering is Saturday-first and Friday is highlighted as the default holiday.
- Quick Add resolves relative dates, weekdays and Jalali dates into persistent `dateKey` values.
- Completing a recurring task creates the next occurrence using the Jalali recurrence engine.
- Calendar agenda completion now updates the same persisted task data as the Today screen.
- Added Jalali date arithmetic and Saturday-first calendar tests.

## 0.2.0 — Phase 1/2 product slice

- Task detail sheet with edit, priority, list, tag, date, reminder, recurrence, note and delete.
- Quick Add parser for Persian relative dates, Jalali dates, time and simple recurrence.
- Global search across task title, description, list and tag.
- Habit screen with completion state and streak counter.
- Lists/projects screen with real task grouping.
- Calendar agenda with selectable week days.
- Statistics now reads completion counts from stored tasks.
- Jalali conversion engine backed by `jalaali-js` with leap-year and round-trip tests.
- Favicon and clean hosted build packaging.
