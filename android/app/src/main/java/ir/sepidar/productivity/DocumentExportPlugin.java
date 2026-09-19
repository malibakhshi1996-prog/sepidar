package ir.sepidar.productivity;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Uses Android's document picker. No broad storage permission or private path exposure. */
@CapacitorPlugin(name = "DocumentExport")
public class DocumentExportPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String text = call.getString("text");
        String name = call.getString("name");
        String mimeType = call.getString("mimeType");
        if (text == null || text.length() > 20 * 1024 * 1024 || name == null ||
            !("application/json".equals(mimeType) || "text/csv".equals(mimeType))) {
            call.reject("Invalid document");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[^a-zA-Z0-9._-]", "_"));
        startActivityForResult(call, intent, "documentCreated");
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (stream == null) { call.reject("Cannot open document"); return; }
                stream.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
                stream.flush();
                call.resolve();
            } catch (Exception ignored) {
                call.reject("Could not save document");
            }
        });
    }
}
