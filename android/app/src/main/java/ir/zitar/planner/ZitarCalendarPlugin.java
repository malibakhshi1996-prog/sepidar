package ir.zitar.planner;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.provider.CalendarContract;
import android.database.Cursor;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.time.ZoneId;

@CapacitorPlugin(name = "ZitarCalendar", permissions = {
    @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
})
public class ZitarCalendarPlugin extends Plugin {
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState("calendar") == com.getcapacitor.PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("calendar", call, "calendarPermissionsCallback");
    }

    @PermissionCallback
    private void calendarPermissionsCallback(PluginCall call) {
        if (getPermissionState("calendar") == com.getcapacitor.PermissionState.GRANTED) call.resolve();
        else call.reject("مجوز دسترسی به تقویم گوشی داده نشد.");
    }

    @PluginMethod
    public void createEvent(PluginCall call) {
        if (!hasPermission(Manifest.permission.WRITE_CALENDAR)) {
            call.reject("CALENDAR_PERMISSION_REQUIRED");
            return;
        }
        String title = call.getString("title", "زیتر");
        long start = call.getLong("startAt", 0L);
        long end = call.getLong("endAt", start + 30 * 60_000L);
        boolean allDay = call.getBoolean("allDay", false);
        ContentResolver resolver = getContext().getContentResolver();
        Long calendarId = writableCalendarId(resolver);
        if (calendarId == null) { call.reject("تقویم قابل ویرایش روی گوشی پیدا نشد."); return; }
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
        values.put(CalendarContract.Events.TITLE, title);
        values.put(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
        values.put(CalendarContract.Events.DTSTART, start);
        values.put(CalendarContract.Events.DTEND, Math.max(end, start + 60_000L));
        values.put(CalendarContract.Events.EVENT_TIMEZONE, ZoneId.systemDefault().getId());
        values.put(CalendarContract.Events.ALL_DAY, allDay ? 1 : 0);
        android.net.Uri uri = resolver.insert(CalendarContract.Events.CONTENT_URI, values);
        if (uri == null) { call.reject("ثبت رویداد در تقویم گوشی ناموفق بود."); return; }
        JSObject result = new JSObject();
        result.put("eventId", Long.parseLong(uri.getLastPathSegment()));
        call.resolve(result);
    }

    @PluginMethod
    public void updateEvent(PluginCall call) {
        if (!hasPermission(Manifest.permission.WRITE_CALENDAR)) {
            call.reject("CALENDAR_PERMISSION_REQUIRED");
            return;
        }
        Long eventId = call.getLong("eventId", -1L);
        if (eventId == null || eventId < 1L) { call.reject("شناسهٔ رویداد معتبر نیست."); return; }
        ContentValues values = eventValues(call);
        int updated = getContext().getContentResolver().update(
                android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId),
                values, null, null);
        if (updated < 1) call.reject("رویداد تقویم گوشی پیدا نشد."); else call.resolve();
    }

    @PluginMethod
    public void deleteEvent(PluginCall call) {
        if (!hasPermission(Manifest.permission.WRITE_CALENDAR)) {
            call.reject("CALENDAR_PERMISSION_REQUIRED");
            return;
        }
        Long eventId = call.getLong("eventId", -1L);
        if (eventId == null || eventId < 1L) { call.reject("شناسهٔ رویداد معتبر نیست."); return; }
        int deleted = getContext().getContentResolver().delete(
                android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId),
                null, null);
        if (deleted < 1) call.reject("رویداد تقویم گوشی پیدا نشد."); else call.resolve();
    }

    private ContentValues eventValues(PluginCall call) {
        long start = call.getLong("startAt", 0L);
        long end = call.getLong("endAt", start + 30 * 60_000L);
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.TITLE, call.getString("title", "زیتر"));
        values.put(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
        values.put(CalendarContract.Events.DTSTART, start);
        values.put(CalendarContract.Events.DTEND, Math.max(end, start + 60_000L));
        values.put(CalendarContract.Events.EVENT_TIMEZONE, ZoneId.systemDefault().getId());
        values.put(CalendarContract.Events.ALL_DAY, call.getBoolean("allDay", false) ? 1 : 0);
        return values;
    }

    private Long writableCalendarId(ContentResolver resolver) {
        String[] projection = { CalendarContract.Calendars._ID };
        String selection = CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + " >= ?";
        try (Cursor cursor = resolver.query(CalendarContract.Calendars.CONTENT_URI, projection, selection, new String[] { String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) }, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getLong(0);
        } catch (SecurityException ignored) { }
        return null;
    }
}
