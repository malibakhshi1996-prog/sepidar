package ir.zitar.planner;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZitarWidget")
public class ZitarWidgetPlugin extends Plugin {
    private static final String PREFS = "zitar_widget";
    private static final String TASKS = "today_tasks";

    @PluginMethod
    public void update(PluginCall call) {
        JSArray taskArray = call.getArray("tasks");
        String tasks = taskArray == null ? "[]" : taskArray.toString();
        // Keep only the small widget projection. The main task database remains in the app.
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        preferences.edit().putString(TASKS, tasks).apply();
        ZitarTodayWidget.updateAll(getContext());
        call.resolve();
    }

    static String readTasks(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(TASKS, "[]");
    }
}
