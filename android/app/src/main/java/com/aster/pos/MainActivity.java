package com.aster.pos;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.aster.pos.plugins.localserver.LocalSyncServerPlugin;
import com.aster.pos.plugins.sms.NativeSmsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalSyncServerPlugin.class);
        registerPlugin(NativeSmsPlugin.class);
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
