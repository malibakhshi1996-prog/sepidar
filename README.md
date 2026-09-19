# سپیدار — Persian-first productivity suite

An independent Persian-first productivity app in active development. Current milestone: 0.7.0 (offline task hardening). This is not yet TickTick feature parity or a production release.

```bash
npm ci
npm test
npm run dev
```

The prototype is intentionally independent from TickTick source code and proprietary assets. It reproduces the reference interaction model with an original brand and Persian-first domain contracts.

## Android build

This repository includes a Capacitor Android target. Install JDK 21, Android SDK platform 36, Android Build Tools and accept the SDK licenses yourself. Provide `ANDROID_HOME` or `sdk.dir` in `android/local.properties`. With Gradle/Maven connectivity or a populated cache, run:

```bash
npm run mobile:doctor
npm run mobile:build:debug
```

After a successful build, the debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. This path is not evidence that an APK currently exists.

The Android target is version `0.7.0` (`ir.sepidar.productivity`). Native notifications and document export still require Android device verification. `mobile:build:release` produces an **unsigned** release unless signing is configured separately; do not distribute it as a signed production release or commit keystore secrets.

Build attempts in this workspace failed at downloading Gradle (`Network is unreachable`); JDK 21 and Android SDK are also missing. **No APK was generated.**

## Current capabilities

- Local task capture/edit/complete, Inbox/Today/Upcoming/All/Completed, soft-delete and restore.
- Jalali calendar/date editor and deterministic offline Persian NLP; ambiguous times are shown for review.
- Versioned IndexedDB snapshot with legacy migration, serialized writes, atomic local fallback, explicit failure UI.
- JSON backup/import preview with non-destructive idempotent merge; CSV task export with formula neutralization.
- Persian-tolerant search, basic recurrence, focus sessions, habits, matrix and statistics (see limitations).

Fresh installations start empty; existing user data is never replaced with a demo dataset. JSON backups are not encrypted.

See [current milestone report](docs/milestone-0.7.md) for acceptance status, schema, test evidence, known issues and Android release gates. The old Phase 0 report is historical, not a statement of current completion.
