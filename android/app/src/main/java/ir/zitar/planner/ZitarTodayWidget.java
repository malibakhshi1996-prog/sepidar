package ir.zitar.planner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class ZitarTodayWidget extends AppWidgetProvider {
    private static final int[] ROWS = {R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3, R.id.widget_task_4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) updateAll(context);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, ZitarTodayWidget.class);
        for (int id : manager.getAppWidgetIds(component)) update(context, manager, id);
    }

    private static void update(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setTextViewText(R.id.widget_title, "کارهای امروز");
        for (int row : ROWS) {
            views.setViewVisibility(row, View.GONE);
        }
        try {
            JSONArray tasks = new JSONArray(ZitarWidgetPlugin.readTasks(context));
            for (int i = 0; i < Math.min(tasks.length(), ROWS.length); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null) continue;
                String title = task.optString("title", "");
                String time = task.optString("time", "");
                views.setTextViewText(ROWS[i], (time.isEmpty() ? "□  " : time + "  ·  ") + title);
                views.setViewVisibility(ROWS[i], View.VISIBLE);
            }
        } catch (Exception ignored) {
            views.setTextViewText(R.id.widget_task_1, "خطا در خواندن کارها");
            views.setViewVisibility(R.id.widget_task_1, View.VISIBLE);
        }
        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 701, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        manager.updateAppWidget(id, views);
    }
}
