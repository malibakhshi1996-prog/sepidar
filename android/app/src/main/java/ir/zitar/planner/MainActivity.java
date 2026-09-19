package ir.zitar.planner;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DocumentExportPlugin.class);
        registerPlugin(ZitarWidgetPlugin.class);
        registerPlugin(ZitarCalendarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
