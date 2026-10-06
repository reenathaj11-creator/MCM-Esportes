package com.mcm.esportes;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RtspProbePlugin.class);
        registerPlugin(RtspLivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
