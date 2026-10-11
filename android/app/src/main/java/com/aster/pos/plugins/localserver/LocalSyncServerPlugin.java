package com.aster.pos.plugins.localserver;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoWSD;

/**
 * LocalSyncServerPlugin — Capacitor native plugin that runs an embedded
 * NanoHTTPD WebSocket server on port 8765 for local Wi-Fi POS sync.
 *
 * The Main Counter device starts this server; Manager Devices connect
 * to ws://<main-counter-ip>:8765 as WebSocket clients (from JavaScript).
 *
 * This requires ZERO internet — it works entirely on the local network.
 */
@CapacitorPlugin(name = "LocalSyncServer")
public class LocalSyncServerPlugin extends Plugin {

    private static final String TAG = "LocalSyncServer";
    private static final int SERVER_PORT = 8765;

    private SyncWebSocketServer server;
    private final ConcurrentHashMap<String, NanoWSD.WebSocket> connectedClients = new ConcurrentHashMap<>();
    private WifiManager.MulticastLock multicastLock;

    @PluginMethod
    public void startServer(PluginCall call) {
        if (server != null && server.isAlive()) {
            JSObject ret = new JSObject();
            ret.put("status", "already_running");
            ret.put("ip", getLocalIpAddress());
            ret.put("port", SERVER_PORT);
            call.resolve(ret);
            return;
        }

        try {
            server = new SyncWebSocketServer(SERVER_PORT);
            server.start(5000); // 5s timeout

            Context ctx = getContext();
            if (ctx != null) {
                WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    multicastLock = wm.createMulticastLock("AsterPosSyncMulticastLock");
                    multicastLock.acquire();
                }
            }

            String ip = getLocalIpAddress();
            Log.i(TAG, "Sync server started on " + ip + ":" + SERVER_PORT);

            JSObject ret = new JSObject();
            ret.put("status", "started");
            ret.put("ip", ip);
            ret.put("port", SERVER_PORT);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Failed to start server", e);
            call.reject("Failed to start sync server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        if (server != null) {
            // Close all client connections
            for (Map.Entry<String, NanoWSD.WebSocket> entry : connectedClients.entrySet()) {
                try {
                    entry.getValue().close(NanoWSD.WebSocketFrame.CloseCode.GoingAway, "Server stopping", false);
                } catch (Exception e) {
                    Log.w(TAG, "Error closing client: " + e.getMessage());
                }
            }
            connectedClients.clear();
            server.stop();
            server = null;
            if (multicastLock != null && multicastLock.isHeld()) {
                multicastLock.release();
                multicastLock = null;
            }
            Log.i(TAG, "Sync server stopped");
        }

        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void broadcast(PluginCall call) {
        String message = call.getString("message");
        if (message == null || message.isEmpty()) {
            call.reject("Message is required");
            return;
        }

        int sent = 0;
        for (Map.Entry<String, NanoWSD.WebSocket> entry : connectedClients.entrySet()) {
            try {
                entry.getValue().send(message);
                sent++;
            } catch (IOException e) {
                Log.w(TAG, "Failed to send to client " + entry.getKey() + ": " + e.getMessage());
                connectedClients.remove(entry.getKey());
            }
        }

        JSObject ret = new JSObject();
        ret.put("sent", sent);
        ret.put("total", connectedClients.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", server != null && server.isAlive());
        ret.put("ip", getLocalIpAddress());
        ret.put("port", SERVER_PORT);
        ret.put("clients", connectedClients.size());
        call.resolve(ret);
    }

    @PluginMethod
    public void getLocalIp(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ip", getLocalIpAddress());
        call.resolve(ret);
    }

    private String getLocalIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                // Skip loopback and down interfaces
                if (intf.isLoopback() || !intf.isUp()) continue;
                String name = intf.getName().toLowerCase();
                if (name.contains("rmnet") || name.contains("dummy")) continue;

                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (addr instanceof Inet4Address) {
                        String ip = addr.getHostAddress();
                        if (ip != null && !ip.equals("127.0.0.1")) {
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting local IP", e);
        }

        // Fallback: try WifiManager
        try {
            Context ctx = getContext();
            if (ctx != null) {
                WifiManager wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    int ipInt = wm.getConnectionInfo().getIpAddress();
                    if (ipInt != 0) {
                        return String.format("%d.%d.%d.%d",
                                (ipInt & 0xff), (ipInt >> 8 & 0xff),
                                (ipInt >> 16 & 0xff), (ipInt >> 24 & 0xff));
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting wifi IP", e);
        }

        return "0.0.0.0";
    }

    // ===== Inner WebSocket Server =====

    private class SyncWebSocketServer extends NanoWSD {

        public SyncWebSocketServer(int port) {
            super(port);
        }

        @Override
        protected Response serveHttp(IHTTPSession session) {
            String uri = session.getUri();
            if ("/".equals(uri)) {
                String html = "<!DOCTYPE html>\n" +
                    "<html>\n" +
                    "<head>\n" +
                    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                    "  <title>Aster POS Dashboard</title>\n" +
                    "  <style>\n" +
                    "    body { font-family: system-ui; background: #0f172a; color: #f8fafc; padding: 20px; }\n" +
                    "    .card { background: #1e293b; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #334155; }\n" +
                    "    input { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: none; }\n" +
                    "    button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: bold; }\n" +
                    "  </style>\n" +
                    "</head>\n" +
                    "<body>\n" +
                    "  <h2>Aster POS Live Dashboard</h2>\n" +
                    "  <div id=\"auth\">\n" +
                    "    <p>Enter Master Code:</p>\n" +
                    "    <input type=\"password\" id=\"code\" placeholder=\"Master Code\">\n" +
                    "    <button onclick=\"connect()\">Connect</button>\n" +
                    "  </div>\n" +
                    "  <div id=\"dashboard\" style=\"display:none\">\n" +
                    "    <div class=\"card\"><b>Status:</b> <span id=\"status\">Connecting...</span></div>\n" +
                    "    <div class=\"card\"><b>Total Revenue:</b> <span id=\"revenue\">0</span></div>\n" +
                    "    <div class=\"card\"><b>Total Orders:</b> <span id=\"orders\">0</span></div>\n" +
                    "    <h3>Recent Logs</h3>\n" +
                    "    <div id=\"logs\" style=\"font-size:12px; color:#94a3b8; max-height:200px; overflow-y:auto;\"></div>\n" +
                    "  </div>\n" +
                    "  <script>\n" +
                    "    let ws;\n" +
                    "    function connect() {\n" +
                    "      if(document.getElementById('code').value !== 'AIRL092918') { alert('Invalid Code'); return; }\n" +
                    "      document.getElementById('auth').style.display = 'none';\n" +
                    "      document.getElementById('dashboard').style.display = 'block';\n" +
                    "      ws = new WebSocket('ws://' + location.host + '/ws');\n" +
                    "      ws.onopen = () => { document.getElementById('status').innerText = 'Connected 🟢'; ws.send(JSON.stringify({type:'SNAPSHOT_REQUEST'})); };\n" +
                    "      ws.onclose = () => { document.getElementById('status').innerText = 'Disconnected 🔴'; setTimeout(connect, 3000); };\n" +
                    "      ws.onmessage = (e) => {\n" +
                    "        const msg = JSON.parse(e.data);\n" +
                    "        if(msg.type === 'SNAPSHOT_RESPONSE' && msg.payload.registerSummary) {\n" +
                    "           document.getElementById('revenue').innerText = msg.payload.registerSummary.totalRevenue;\n" +
                    "           document.getElementById('orders').innerText = msg.payload.registerSummary.totalOrders;\n" +
                    "        }\n" +
                    "        if(msg.type === 'TRANSACTION_COMPLETED') {\n" +
                    "           const logs = document.getElementById('logs');\n" +
                    "           logs.innerHTML = '<div>New Sale: ' + msg.payload.total + '</div>' + logs.innerHTML;\n" +
                    "        }\n" +
                    "      };\n" +
                    "    }\n" +
                    "  </script>\n" +
                    "</body>\n" +
                    "</html>";
                return newFixedLengthResponse(Response.Status.OK, "text/html", html);
            }
            return super.serveHttp(session);
        }

        @Override
        protected WebSocket openWebSocket(IHTTPSession handshake) {
            return new SyncWebSocket(handshake);
        }
    }

    private class SyncWebSocket extends NanoWSD.WebSocket {

        private final String clientId;

        public SyncWebSocket(NanoHTTPD.IHTTPSession handshakeRequest) {
            super(handshakeRequest);
            this.clientId = handshakeRequest.getRemoteIpAddress() + ":" + handshakeRequest.getRemoteHostName() + "_" + System.currentTimeMillis();
        }

        @Override
        protected void onOpen() {
            connectedClients.put(clientId, this);
            Log.i(TAG, "Client connected: " + clientId + " (total: " + connectedClients.size() + ")");

            // Notify JS layer
            JSObject data = new JSObject();
            data.put("event", "client_connected");
            data.put("clientId", clientId);
            data.put("clientCount", connectedClients.size());
            notifyListeners("syncEvent", data);
        }

        @Override
        protected void onClose(NanoWSD.WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
            connectedClients.remove(clientId);
            Log.i(TAG, "Client disconnected: " + clientId + " (total: " + connectedClients.size() + ")");

            JSObject data = new JSObject();
            data.put("event", "client_disconnected");
            data.put("clientId", clientId);
            data.put("clientCount", connectedClients.size());
            notifyListeners("syncEvent", data);
        }

        @Override
        protected void onMessage(NanoWSD.WebSocketFrame message) {
            String payload = message.getTextPayload();
            Log.d(TAG, "Received from " + clientId + ": " + (payload.length() > 100 ? payload.substring(0, 100) + "..." : payload));

            // Forward incoming messages from Manager to JS layer
            JSObject data = new JSObject();
            data.put("event", "message_received");
            data.put("clientId", clientId);
            data.put("message", payload);
            notifyListeners("syncEvent", data);
        }

        @Override
        protected void onPong(NanoWSD.WebSocketFrame pong) {
            // Keep-alive acknowledged
        }

        @Override
        protected void onException(IOException exception) {
            connectedClients.remove(clientId);
            Log.w(TAG, "WebSocket error for " + clientId + ": " + exception.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (server != null) {
            server.stop();
            server = null;
        }
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
            multicastLock = null;
        }
        connectedClients.clear();
        super.handleOnDestroy();
    }
}
